// Vercel serverless proxy for Anthropic API calls.
// CJS only — no import statements. "type":"module" in root package.json is
// overridden by api/package.json {"type":"commonjs"}.

/* eslint-disable @typescript-eslint/no-require-imports */
const Anthropic = require('@anthropic-ai/sdk');

interface TextContent { type: 'text'; text: string; cacheControl?: 'ephemeral' }
interface ImageContent { type: 'image'; mediaType: string; base64: string; cacheControl?: 'ephemeral' }
type ContentBlock = TextContent | ImageContent;
interface JsonSchemaTool { name: string; description: string; schema: Record<string, unknown> }
interface AnthropicCallInput {
  model: string; system: string; userContent: ContentBlock[];
  maxTokens: number; jsonSchema?: JsonSchemaTool;
}
interface AnthropicCallOutput {
  content: unknown; inputTokens: number; outputTokens: number;
  latencyMs: number; cacheHit: boolean;
}

function send(res: any, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: any): Promise<AnthropicCallInput> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function toBlock(block: ContentBlock): unknown {
  const cache = block.cacheControl === 'ephemeral' ? { type: 'ephemeral' } : undefined;
  if (block.type === 'text') {
    return cache ? { type: 'text', text: block.text, cache_control: cache }
                 : { type: 'text', text: block.text };
  }
  const b: any = { type: 'image', source: { type: 'base64', media_type: block.mediaType, data: block.base64 } };
  if (cache) b.cache_control = cache;
  return b;
}

module.exports = async function handler(req: any, res: any) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return send(res, 500, { error: 'ANTHROPIC_API_KEY is not configured' });

  let body: AnthropicCallInput;
  try {
    body = req.body ?? await readBody(req);
  } catch {
    return send(res, 400, { error: 'Invalid JSON body' });
  }

  if (!body?.model || !body?.userContent || !body?.maxTokens)
    return send(res, 400, { error: 'Invalid request body' });

  const client = new Anthropic({ apiKey });
  const start = Date.now();

  const params: any = {
    model: body.model,
    system: body.system,
    max_tokens: body.maxTokens,
    messages: [{ role: 'user', content: body.userContent.map(toBlock) }],
  };

  if (body.jsonSchema) {
    params.tools = [{ name: body.jsonSchema.name, description: body.jsonSchema.description, input_schema: body.jsonSchema.schema }];
    params.tool_choice = { type: 'tool', name: body.jsonSchema.name };
  }

  const message = await client.messages.create(params);
  const latencyMs = Date.now() - start;
  const msgContent: any[] = message.content;

  let content: unknown;
  if (body.jsonSchema) {
    content = msgContent.find((b: any) => b.type === 'tool_use')?.input ?? null;
  } else {
    content = msgContent.find((b: any) => b.type === 'text')?.text ?? '';
  }

  const usage: any = message.usage;
  const output: AnthropicCallOutput = {
    content,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    latencyMs,
    cacheHit: (usage.cache_read_input_tokens ?? 0) > 0,
  };

  return send(res, 200, output);
};
