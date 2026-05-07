// AI Systems & Integration owns this file. See AI_SYSTEMS.md task 1.
//
// Vision-judge prompt for Claude Opus 4.7. Override the model string here -
// do not let tooling guess at older names from training data.

import type { LLMJudgeFn, LLMJudgeInput, LLMJudgeOutput } from '../judge/types';
import { JUDGE_MODEL, callAnthropic, type ContentBlock } from './anthropic';
import { rgbaToPngBase64 } from './imageEncode';

// Re-export from the shared client to keep a single source of truth.
export { JUDGE_MODEL } from './anthropic';

export interface JudgePromptResponse {
  visualMatchScore: number;
  codeQualityNote: string;
  passReasoning: string;
  flagged: boolean;
  flagReason: string | null;
}

// Adapter: bridges the prompt's structured JSON response to the
// LLMJudgeFn contract the combiner consumes. Flagged shaders carry
// the flagReason in `reasoning` so the UI can surface it.
export function toLLMJudgeOutput(response: JudgePromptResponse): LLMJudgeOutput {
  return {
    score: response.visualMatchScore,
    reasoning: response.flagged
      ? (response.flagReason ?? response.passReasoning)
      : response.passReasoning,
    flagged: response.flagged,
  };
}

export const JUDGE_SYSTEM_PROMPT = `You are a fair, diagnostic judge for a GLSL shader learning platform.

Your job, given a user's rendered output, a reference rendered output, the
user's shader source, and a challenge description:

1. Score visual similarity 0-100. Be tolerant of minor numeric or anti-alias
   drift caused by GPU variance.
2. Inspect the user's shader source for cheating, e.g. sampling a hardcoded
   texture of the reference, returning a pre-baked color array, or otherwise
   not actually computing the image. If you detect cheating, set flagged=true.
3. Provide a short diagnostic reasoning sentence the UI can show. The user is
   learning - feedback should be helpful, not punitive.

Return ONLY valid JSON matching this schema:
{
  "visualMatchScore": number 0-100,
  "codeQualityNote": string,
  "passReasoning": string,
  "flagged": boolean,
  "flagReason": string | null
}`;

const RENDER_SIZE = 512;

const JUDGE_TOOL = {
  name: 'judge_output',
  description: 'Return structured judge result',
  schema: {
    type: 'object',
    properties: {
      visualMatchScore: { type: 'number' },
      codeQualityNote: { type: 'string' },
      passReasoning: { type: 'string' },
      flagged: { type: 'boolean' },
      flagReason: { type: ['string', 'null'] },
    },
    required: ['visualMatchScore', 'codeQualityNote', 'passReasoning', 'flagged', 'flagReason'],
  },
};

function buildUserContent(
  input: LLMJudgeInput,
  userPng: string,
  referencePng: string,
): ContentBlock[] {
  const challengeBlock = [
    `Challenge: ${input.challenge.title} (${input.challenge.difficulty})`,
    input.challenge.description,
  ].join('\n');

  return [
    // Challenge description is stable per challenge — mark cacheable.
    { type: 'text', text: challengeBlock, cacheControl: 'ephemeral' },
    { type: 'text', text: 'Reference render:' },
    { type: 'image', mediaType: 'image/png', base64: referencePng, cacheControl: 'ephemeral' },
    { type: 'text', text: 'User render:' },
    { type: 'image', mediaType: 'image/png', base64: userPng },
    {
      type: 'text',
      text: `User shader source:\n\`\`\`glsl\n${input.userShaderSrc}\n\`\`\``,
    },
    {
      type: 'text',
      text: 'Call judge_output with your verdict.',
    },
  ];
}

export const llmJudge: LLMJudgeFn = async (input: LLMJudgeInput): Promise<LLMJudgeOutput> => {
  const [userPng, referencePng] = await Promise.all([
    rgbaToPngBase64(input.userRender, RENDER_SIZE, RENDER_SIZE),
    rgbaToPngBase64(input.referenceRender, RENDER_SIZE, RENDER_SIZE),
  ]);

  const result = await callAnthropic<JudgePromptResponse>({
    model: JUDGE_MODEL,
    system: JUDGE_SYSTEM_PROMPT,
    userContent: buildUserContent(input, userPng, referencePng),
    maxTokens: 512,
    jsonSchema: JUDGE_TOOL,
  });

  return toLLMJudgeOutput(result.content);
};
