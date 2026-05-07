import type { LLMJudgeFn, LLMJudgeInput, LLMJudgeOutput } from './types';
import { llmJudge as realJudge } from '../ai/judgePrompt';

// ─── Cache ────────────────────────────────────────────────────────────────────
// Keyed by (challenge_id, shader_hash) so identical submissions never hit the
// API twice. This is the primary cost-control mechanism — most re-submissions
// are the same shader with minor whitespace edits, which still hash the same.

// djb2 hash — fast, good enough for cache keys (not security-sensitive).
function hashShader(src: string): string {
  let h = 5381;
  for (let i = 0; i < src.length; i++) {
    h = ((h << 5) + h) ^ src.charCodeAt(i);
    h |= 0; // keep 32-bit
  }
  return (h >>> 0).toString(36);
}

function cacheKey(challengeId: string, shaderSrc: string): string {
  return `${challengeId}:${hashShader(shaderSrc)}`;
}

const cache = new Map<string, LLMJudgeOutput>();

// ─── Cached wrapper ───────────────────────────────────────────────────────────
// This is what the combiner calls. It checks the cache first and only invokes
// the inner judge on a miss.

export function withCache(judge: LLMJudgeFn): LLMJudgeFn {
  return async (input: LLMJudgeInput): Promise<LLMJudgeOutput> => {
    const key = cacheKey(input.challenge.id, input.userShaderSrc);
    const hit = cache.get(key);
    if (hit) return hit;
    const result = await judge(input);
    cache.set(key, result);
    return result;
  };
}

export function clearCache(): void {
  cache.clear();
}

// Default export: real judge wrapped in cache.
export const llmJudge: LLMJudgeFn = withCache(realJudge);
