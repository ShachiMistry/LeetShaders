import type { LLMJudgeFn, LLMJudgeInput, LLMJudgeOutput } from './types';

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

// ─── Stub ─────────────────────────────────────────────────────────────────────
// AI Systems & Integration replaces this with the real Anthropic API call.
// The stub lets the rest of the pipeline (combiner, test harness) work without
// burning any API credits.

const stubJudge: LLMJudgeFn = async (_input: LLMJudgeInput): Promise<LLMJudgeOutput> => {
  return { score: 75, reasoning: 'stub — AI Systems will replace this', flagged: false };
};

// ─── Cached wrapper ───────────────────────────────────────────────────────────
// This is what the combiner calls. It checks the cache first and only invokes
// the inner judge on a miss. AI Systems should wrap their real implementation
// with this same pattern when they replace the stub.

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

// Default export: stub wrapped in cache.
// Combiner imports this. AI Systems swaps the inner function when ready.
export const llmJudge: LLMJudgeFn = withCache(stubJudge);
