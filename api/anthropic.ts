// Vercel serverless proxy for Anthropic API calls.
//
// The browser client (src/ai/anthropic.ts) never holds ANTHROPIC_API_KEY.
// It POSTs an AnthropicCallInput here; this function signs the request with
// the server-side key and returns AnthropicCallOutput.
//
// To swap to Supabase Edge Functions later: rewrite this file in Deno syntax
// and update PROXY_PATH in src/ai/anthropic.ts to the edge function URL.
// The request/response contract is unchanged.
//
// Uses require() instead of import to ensure CJS compatibility with Vercel's
// Node.js runtime, which conflicts with "type": "module" in the root package.json.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Anthropic = require('@anthropic-ai/sdk').default ?? require('@anthropic-ai/sdk');

import type { IncomingMessage, ServerResponse } from 'node:http';

// Extend the default 10s limit — Opus vision calls can take 15–20s.
export const maxDuration = 60;

// ─── Request / response types (mirrors src/ai/anthropic.ts) ──────────────────

interface TextContent {
  type: 'text';
  text: string;
  cacheControl?: 'ephemeral';
}

interface ImageContent {
  type: 'image';
  mediaType: 'image/png' | 'image/jpeg';
  base64: string;
  cacheControl?: 'ephemeral';
}

type ContentBlock = TextContent | ImageContent;

interface JsonSchemaTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

interface AnthropicCallInput {
  model: string;
  system: string;
  userContent: ContentBlock[];
  maxTokens: number;
  jsonSchema?: JsonSchemaTool;
}

interface AnthropicCallOutput {
  content: unknown;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cacheHit: boolean;
}

// ─── Content block translation ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSdkContentBlock(block: ContentBlock): any {
  const cache = block.cacheControl === 'ephemeral'
    ? { type: 'ephemeral' }
    : undefined;

  if (block.type === 'text') {
    return cache
      ? { type: 'text', text: block.text, cache_control: cache }
      : { type: 'text', text: block.text };
  }

  const imageBlock: Record<string, unknown> = {
    type: 'image',
    source: { type: 'base64', media_type: block.mediaType, data: block.base64 },
  };
  if (cache) imageBlock.cache_control = cache;
  return imageBlock;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(json);
}

function readBody(req: IncomingMessage): Promise<AnthropicCallInput> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()) as AnthropicCallInput);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return send(res, 500, { error: 'ANTHROPIC_API_KEY is not configured' });
  }

  let body: AnthropicCallInput;
  try {
    // vercel pre-parses JSON onto req.body; raw Node streams do not.
    const raw = (req as unknown as { body?: unknown }).body;
    body = raw !== undefined ? (raw as AnthropicCallInput) : await readBody(req);
  } catch {
    return send(res, 400, { error: 'Invalid JSON body' });
  }

  if (!body?.model || !body?.userContent || !body?.maxTokens) {
    return send(res, 400, { error: 'Invalid request body' });
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const client = new Anthropic({ apiKey });
  const start = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdkParams: Record<string, any> = {
    model: body.model,
    system: body.system,
    max_tokens: body.maxTokens,
    messages: [
      {
        role: 'user',
        content: body.userContent.map(toSdkContentBlock),
      },
    ],
  };

  if (body.jsonSchema) {
    sdkParams.tools = [
      {
        name: body.jsonSchema.name,
        description: body.jsonSchema.description,
        input_schema: body.jsonSchema.schema,
      },
    ];
    sdkParams.tool_choice = { type: 'tool', name: body.jsonSchema.name };
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const message = await client.messages.create(sdkParams);
  const latencyMs = Date.now() - start;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgContent: any[] = (message as any).content;
  let content: unknown;
  if (body.jsonSchema) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolBlock = msgContent.find((b: any) => b.type === 'tool_use');
    content = toolBlock?.input ?? null;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textBlock = msgContent.find((b: any) => b.type === 'text');
    content = textBlock?.text ?? '';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usage: any = (message as any).usage;

  const output: AnthropicCallOutput = {
    content,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    latencyMs,
    cacheHit: (usage.cache_read_input_tokens ?? 0) > 0,
  };

  return send(res, 200, output);
}
