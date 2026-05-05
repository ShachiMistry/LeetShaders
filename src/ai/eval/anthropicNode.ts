// AI Systems & Integration. Node-side Anthropic call for the eval
// harness. Mirrors the shape of src/ai/anthropic.ts but uses the SDK
// directly because this runs via `tsx`, not in a browser.
//
// The browser path (src/ai/anthropic.ts) POSTs to /api/anthropic.
// This file holds ANTHROPIC_API_KEY, so keep it behind the eval
// folder and never import from src/ai/anthropic.ts here (that one is
// typed against lib.dom).

import Anthropic from '@anthropic-ai/sdk';

export const JUDGE_MODEL = 'claude-opus-4-7';
export const HINT_MODEL = 'claude-sonnet-4-6';

export type AnthropicModel = typeof JUDGE_MODEL | typeof HINT_MODEL;

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ImageBlock {
  type: 'image';
  mediaType: 'image/png' | 'image/jpeg';
  base64: string;
}

export type ContentBlock = TextBlock | ImageBlock;

export interface JsonSchemaTool {
  name: string;
  description: string;
  schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface CallInput {
  model: AnthropicModel;
  system: string;
  userContent: ContentBlock[];
  maxTokens: number;
  jsonSchema?: JsonSchemaTool;
  timeoutMs?: number;
}

export interface CallOutput<T = string> {
  content: T;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Export it before running the eval harness.',
    );
  }
  return new Anthropic({ apiKey });
}

function toSdkContent(
  block: ContentBlock,
): Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam {
  if (block.type === 'text') {
    return { type: 'text', text: block.text };
  }
  return {
    type: 'image',
    source: { type: 'base64', media_type: block.mediaType, data: block.base64 },
  };
}

/**
 * Invoke Claude with optional forced JSON output via a tool call.
 * Returns parsed tool input when `jsonSchema` is set, otherwise the
 * first text block's text.
 */
export async function callAnthropicNode<T = string>(
  input: CallInput,
): Promise<CallOutput<T>> {
  const client = getClient();
  const start = performance.now();

  const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model: input.model,
    max_tokens: input.maxTokens,
    system: input.system,
    messages: [
      { role: 'user', content: input.userContent.map(toSdkContent) },
    ],
  };

  if (input.jsonSchema) {
    params.tools = [
      {
        name: input.jsonSchema.name,
        description: input.jsonSchema.description,
        input_schema: input.jsonSchema.schema,
      },
    ];
    params.tool_choice = { type: 'tool', name: input.jsonSchema.name };
  }

  const message = await client.messages.create(params);
  const latencyMs = performance.now() - start;

  let content: T;
  if (input.jsonSchema) {
    const toolBlock = message.content.find((b) => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      throw new Error('expected tool_use block in response');
    }
    content = toolBlock.input as T;
  } else {
    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('expected text block in response');
    }
    content = textBlock.text as unknown as T;
  }

  return {
    content,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    latencyMs,
  };
}
