// AI Systems & Integration owns this file. See AI_SYSTEMS.md task 4.
//
// Hint generation, Claude Sonnet 4.6 (cheaper, faster than Opus). Hints
// nudge without revealing the answer. Output is plain text - no JSON
// schema. The judge prompt enforces structured output, hints don't.

import type { Challenge } from '../judge/types';
import {
  HINT_MODEL,
  callAnthropic,
  type ContentBlock,
} from './anthropic';
import {
  InMemoryCache,
  cacheKey,
  shaderHash,
  type AICache,
} from './cache';
import { rgbaToPngBase64 } from './imageEncode';
import {
  InMemoryRateLimiter,
  hintRateKey,
  type RateLimiter,
} from './rateLimit';

export { HINT_MODEL };

export interface HintInput {
  userId: string;
  userShaderSrc: string;
  referenceShaderSrc: string;
  challenge: Challenge;
  userRender: Uint8Array;
  referenceRender: Uint8Array;
  /** Render dimensions for the RGBA buffers above. Pipeline is fixed
   *  at 512x512 today; passing it explicitly keeps us honest if that
   *  changes. */
  renderWidth: number;
  renderHeight: number;
}

export interface HintResult {
  hint: string;
  cacheHit: boolean;
  /** -1 when the result was served from cache and no rate-limit slot
   *  was consumed. */
  remainingHints: number;
}

export class HintRateLimitError extends Error {
  constructor(public readonly resetMs: number) {
    super(`hint rate limit reached, retry in ${Math.ceil(resetMs / 1000)}s`);
    this.name = 'HintRateLimitError';
  }
}

export interface HintDeps {
  cache?: AICache<string>;
  rateLimiter?: RateLimiter;
}

// Module-level singletons. Tests should pass their own deps via the
// HintDeps argument rather than reaching into these.
const defaultCache: AICache<string> = new InMemoryCache<string>();
const defaultLimiter: RateLimiter = new InMemoryRateLimiter();

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

function buildUserContent(
  input: HintInput,
  userPng: string,
  referencePng: string,
): ContentBlock[] {
  const challengeBlock = [
    `Challenge: ${input.challenge.title} (${input.challenge.difficulty})`,
    input.challenge.description,
  ].join('\n');

  return [
    // The challenge description and reference shader are stable per
    // challenge id, so mark them cacheable. Anthropic's prompt cache
    // is per-system+content prefix; the user shader and renders below
    // the marker change per call and will not be cached.
    { type: 'text', text: challengeBlock, cacheControl: 'ephemeral' },
    {
      type: 'text',
      text: `Reference shader source:\n\`\`\`glsl\n${input.referenceShaderSrc}\n\`\`\``,
      cacheControl: 'ephemeral',
    },
    { type: 'text', text: 'Reference render:' },
    { type: 'image', mediaType: 'image/png', base64: referencePng },
    { type: 'text', text: 'User render:' },
    { type: 'image', mediaType: 'image/png', base64: userPng },
    {
      type: 'text',
      text: `User shader source:\n\`\`\`glsl\n${input.userShaderSrc}\n\`\`\``,
    },
    {
      type: 'text',
      text: 'Write one hint paragraph following the system rules. Plain text only, no markdown headings.',
    },
  ];
}

/**
 * Produce a single hint paragraph for the user. Cache hits short-
 * circuit before the rate limiter so a repeat submission of an
 * unchanged shader returns the same hint without consuming a slot.
 *
 * Throws HintRateLimitError when the user is over the soft cap.
 */
export async function generateHint(
  input: HintInput,
  deps: HintDeps = {},
): Promise<HintResult> {
  const cache = deps.cache ?? defaultCache;
  const limiter = deps.rateLimiter ?? defaultLimiter;

  const hash = await shaderHash(input.userShaderSrc);
  const key = cacheKey(input.challenge.id, hash);

  const cached = await cache.get(key);
  if (cached !== null) {
    return { hint: cached, cacheHit: true, remainingHints: -1 };
  }

  const decision = await limiter.check(
    hintRateKey(input.userId, input.challenge.id),
  );
  if (!decision.allowed) {
    throw new HintRateLimitError(decision.resetMs);
  }

  const [userPng, referencePng] = await Promise.all([
    rgbaToPngBase64(input.userRender, input.renderWidth, input.renderHeight),
    rgbaToPngBase64(
      input.referenceRender,
      input.renderWidth,
      input.renderHeight,
    ),
  ]);

  const result = await callAnthropic<string>({
    model: HINT_MODEL,
    system: HINT_SYSTEM_PROMPT,
    userContent: buildUserContent(input, userPng, referencePng),
    maxTokens: 200,
  });

  const hint = result.content.trim();
  await cache.set(key, hint);
  return { hint, cacheHit: false, remainingHints: decision.remaining };
}
