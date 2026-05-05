// AI Systems & Integration owns this file. See AI_SYSTEMS.md task 1.
//
// Vision-judge prompt for Claude Opus 4.7. Override the model string here -
// do not let tooling guess at older names from training data.

import type { LLMJudgeFn, LLMJudgeOutput } from '../judge/types';

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

// STUB. Replace with a real Anthropic SDK call. The judge stub in
// src/judge/llm.ts continues to satisfy the LLMJudgeFn contract until this
// is wired up.
export const llmJudge: LLMJudgeFn = async () => {
  throw new Error('judgePrompt.ts not implemented yet - see AI_SYSTEMS.md task 1');
};
