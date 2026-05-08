// Vercel serverless proxy for Anthropic API calls.
//
// The browser client (src/ai/anthropic.ts) never holds ANTHROPIC_API_KEY.
// It POSTs an AnthropicCallInput here; this function signs the request with
// the server-side key and returns AnthropicCallOutput.
//
// To swap to Supabase Edge Functions later: rewrite this file in Deno syntax
// and update PROXY_PATH in src/ai/anthropic.ts to the edge function URL.
// The request/response contract is unchanged.

import Anthropic from '@anthropic-ai/sdk';
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

function toSdkContentBlock(block: ContentBlock): Anthropic.MessageParam['content'][number] {
  const cache = block.cacheControl === 'ephemeral'
    ? ({ type: 'ephemeral' } as const)
    : undefined;

  if (block.type === 'text') {
    return cache
      ? { type: 'text', text: block.text, cache_control: cache }
      : { type: 'text', text: block.text };
  }

  // image
  const imageBlock: Anthropic.ImageBlockParam = {
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

  const client = new Anthropic({ apiKey });
  const start = Date.now();

  const sdkParams: Anthropic.MessageCreateParamsNonStreaming = {
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
        input_schema: body.jsonSchema.schema as Anthropic.Tool['input_schema'],
      },
    ];
    sdkParams.tool_choice = { type: 'tool', name: body.jsonSchema.name };
  }

  const message = await client.messages.create(sdkParams);
  const latencyMs = Date.now() - start;

  // Extract content — tool_use block when jsonSchema was provided, text otherwise.
  let content: unknown;
  if (body.jsonSchema) {
    const toolBlock = message.content.find((b) => b.type === 'tool_use') as
      | Anthropic.ToolUseBlock
      | undefined;
    content = toolBlock?.input ?? null;
  } else {
    const textBlock = message.content.find((b) => b.type === 'text') as
      | Anthropic.TextBlock
      | undefined;
    content = textBlock?.text ?? '';
  }

  const usage = message.usage as Anthropic.Usage & { cache_read_input_tokens?: number };

  const output: AnthropicCallOutput = {
    content,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    latencyMs,
    cacheHit: (usage.cache_read_input_tokens ?? 0) > 0,
  };

  return send(res, 200, output);
}
