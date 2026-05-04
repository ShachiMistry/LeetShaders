// AI Systems & Integration owns this file. See AI_SYSTEMS.md task 4.
//
// Hint generation, Claude Sonnet 4.6 (cheaper, faster than Opus). Hints
// nudge without revealing the answer.

import type { Challenge } from '../judge/types';

export const HINT_MODEL = 'claude-sonnet-4-6';

export interface HintInput {
  userShaderSrc: string;
  referenceShaderSrc: string;
  challenge: Challenge;
  userRender: Uint8Array;
  referenceRender: Uint8Array;
}

export const HINT_SYSTEM_PROMPT = `You are a tutor for a GLSL shader learning platform.

Given a user's current shader, the reference shader, and the challenge
description, write ONE short paragraph that nudges the user without revealing
the solution.

Hard rules:
- Never write fixed code or specific line edits.
- Point at concepts and built-ins, not specific values.
- Diagnose the visual delta when possible (saturation, sharpness, alignment).
- Ask leading questions. The user should still have to think.
- Stay under 80 words.`;

export async function generateHint(_input: HintInput): Promise<string> {
  throw new Error('hintPrompt.ts not implemented yet - see AI_SYSTEMS.md task 4');
}
