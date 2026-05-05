// AI Systems & Integration. Concrete LLM-judge call for the eval
// harness. Packs the system prompt, tool schema, and image/source
// content blocks the judge needs, and returns a typed response.
//
// The live frontend will call the same prompt through the server
// proxy (src/ai/anthropic.ts). This file is node-only because it
// drives calibration runs with the SDK directly.

import { JUDGE_MODEL, callAnthropicNode } from './anthropicNode';

export const JUDGE_SYSTEM_PROMPT = `You are a fair, diagnostic judge for a GLSL shader learning platform.

Your job, given a user's rendered output, a reference rendered output, the
user's shader source, and a challenge description:

1. Score visual similarity 0-100. Be tolerant of minor numeric or anti-alias
   drift caused by GPU variance.
2. Inspect the user's shader source for cheating. Cheating includes:
   - Sampling a texture that encodes the reference image.
   - Returning a hardcoded color or precomputed color table that skips the
     computation the challenge demands.
   - Using the reference shader's full source verbatim while presenting it
     as the user's work.
   If cheating is suspected, set flagged=true with a short flagReason.
3. Provide a diagnostic passReasoning sentence the UI can show. The user
   is learning - feedback should be helpful, not punitive.

Return ONLY the tool call. No prose outside the tool input.`;

export interface JudgeResponse {
  visualMatchScore: number;
  codeQualityNote: string;
  passReasoning: string;
  flagged: boolean;
  flagReason: string | null;
}

const JUDGE_TOOL_SCHEMA = {
  name: 'record_verdict',
  description: 'Record the judge verdict for this submission.',
  schema: {
    type: 'object' as const,
    properties: {
      visualMatchScore: {
        type: 'number',
        description: 'Visual similarity between user and reference, 0-100.',
        minimum: 0,
        maximum: 100,
      },
      codeQualityNote: {
        type: 'string',
        description: 'One short sentence describing the shader approach.',
      },
      passReasoning: {
        type: 'string',
        description: 'Diagnostic reasoning for the UI to show the user.',
      },
      flagged: {
        type: 'boolean',
        description: 'True if the shader appears to be cheating.',
      },
      flagReason: {
        type: ['string', 'null'],
        description: 'Short reason string when flagged, null otherwise.',
      },
    },
    required: [
      'visualMatchScore',
      'codeQualityNote',
      'passReasoning',
      'flagged',
      'flagReason',
    ],
  },
};

export interface JudgeCallInput {
  challengeTitle: string;
  challengeDifficulty: string;
  challengeDescription: string;
  referencePngBase64: string;
  userPngBase64: string;
  userShaderSrc: string;
}

export interface JudgeCallResult {
  response: JudgeResponse;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function callJudge(input: JudgeCallInput): Promise<JudgeCallResult> {
  const result = await callAnthropicNode<JudgeResponse>({
    model: JUDGE_MODEL,
    system: JUDGE_SYSTEM_PROMPT,
    maxTokens: 1024,
    jsonSchema: JUDGE_TOOL_SCHEMA,
    userContent: [
      {
        type: 'text',
        text: [
          `Challenge: ${input.challengeTitle} (${input.challengeDifficulty})`,
          input.challengeDescription,
        ].join('\n'),
      },
      { type: 'text', text: 'Reference render:' },
      { type: 'image', mediaType: 'image/png', base64: input.referencePngBase64 },
      { type: 'text', text: 'User render:' },
      { type: 'image', mediaType: 'image/png', base64: input.userPngBase64 },
      {
        type: 'text',
        text: `User shader source:\n\`\`\`glsl\n${input.userShaderSrc}\n\`\`\``,
      },
      {
        type: 'text',
        text: 'Record the verdict via the record_verdict tool.',
      },
    ],
  });

  return {
    response: result.content,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
  };
}
