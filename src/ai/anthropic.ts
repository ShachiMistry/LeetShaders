// AI Systems & Integration. Shared in-browser Anthropic client.
//
// The browser never holds ANTHROPIC_API_KEY. Every call POSTs to the
// server-side proxy described in .env.example, which signs the request
// with the key and forwards to Anthropic. The eval harness under
// src/ai/eval/ uses the SDK directly under node and lives in its own
// tsconfig project; do not import this file from there.
//
// Model strings are pinned here. CLAUDE.md warns that tooling will
// suggest older names from training data; override at call sites by
// importing JUDGE_MODEL or HINT_MODEL.

export const JUDGE_MODEL = 'claude-opus-4-7';
export const HINT_MODEL = 'claude-sonnet-4-6';

export type AnthropicModel = typeof JUDGE_MODEL | typeof HINT_MODEL;

export interface TextContent {
  type: 'text';
  text: string;
  cacheControl?: 'ephemeral';
}

export interface ImageContent {
  type: 'image';
  mediaType: 'image/png' | 'image/jpeg';
  base64: string;
  cacheControl?: 'ephemeral';
}

export type ContentBlock = TextContent | ImageContent;

// Structured-output tool schema. Anthropic enforces JSON via a forced
// tool call, see https://docs.anthropic.com/claude/docs/tool-use.
export interface JsonSchemaTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface AnthropicCallInput {
  model: AnthropicModel;
  system: string;
  userContent: ContentBlock[];
  maxTokens: number;
  jsonSchema?: JsonSchemaTool;
  timeoutMs?: number;
}

export interface AnthropicCallOutput<T = string> {
  content: T;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cacheHit: boolean;
}

export interface TelemetryEvent {
  model: AnthropicModel;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cacheHit: boolean;
}

type TelemetryListener = (event: TelemetryEvent) => void | Promise<void>;

const telemetryListeners: TelemetryListener[] = [];

export function onTelemetry(listener: TelemetryListener): () => void {
  telemetryListeners.push(listener);
  return () => {
    const i = telemetryListeners.indexOf(listener);
    if (i >= 0) telemetryListeners.splice(i, 1);
  };
}

async function emitTelemetry(event: TelemetryEvent): Promise<void> {
  if (telemetryListeners.length === 0) return;
  await Promise.allSettled(
    telemetryListeners.map((fn) => Promise.resolve(fn(event))),
  );
}

const PROXY_PATH = '/api/anthropic';
const DEFAULT_TIMEOUT_MS = 30_000;

export class AnthropicCallError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AnthropicCallError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handle = setTimeout(() => {
      reject(new AnthropicCallError(`anthropic call timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(handle);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(handle);
        reject(err);
      },
    );
  });
}

/**
 * Calls the server-side Anthropic proxy. Returns parsed JSON when
 * `jsonSchema` is provided, otherwise the assistant's text content.
 *
 * The proxy is expected to accept this exact JSON body and return a
 * matching `AnthropicCallOutput`. Coordinate with Content & Backend on
 * the proxy contract.
 */
export async function callAnthropic<T = string>(
  input: AnthropicCallInput,
): Promise<AnthropicCallOutput<T>> {
  const start = performance.now();
  const timeout = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const response = await withTimeout(
    fetch(PROXY_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
    timeout,
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new AnthropicCallError(
      `anthropic proxy error ${response.status}: ${detail}`,
      response.status,
    );
  }

  const body = (await response.json()) as AnthropicCallOutput<T>;
  const latencyMs = body.latencyMs ?? performance.now() - start;

  await emitTelemetry({
    model: input.model,
    inputTokens: body.inputTokens,
    outputTokens: body.outputTokens,
    latencyMs,
    cacheHit: body.cacheHit ?? false,
  });

  return { ...body, latencyMs };
}
