import { compileAndRender } from './pipeline';
import { computeMAEResult } from './mae';
import type { Challenge, JudgeResult, LLMJudgeFn } from './types';
import { applyBandLogic, DEFAULT_BANDS, type BandConfig } from '../ai/bandLogic';

// ─── Plumbing only ────────────────────────────────────────────────────────────
// Band thresholds, weights, and the pass threshold live in src/ai/bandLogic.ts
// (owned by AI Systems & Integration). This file owns pipeline orchestration:
// compile both shaders, compute MAE, hand the decision to applyBandLogic, and
// shape the result as JudgeResult for consumers.
//
// Callers may pass a custom BandConfig for tests or experiments; production
// uses DEFAULT_BANDS.

export async function judge(
  userShaderSrc: string,
  challenge: Challenge,
  llmJudge: LLMJudgeFn,
  bandConfig: BandConfig = DEFAULT_BANDS,
): Promise<JudgeResult> {
  const judgeStart = performance.now();

  // Stage 0: compile and render both shaders, with watchdog
  const renderStart = performance.now();

  const userResult = compileAndRender(userShaderSrc);
  if ('type' in userResult) {
    return failResult(0, userResult.message, performance.now() - renderStart, 0);
  }

  const refResult = compileAndRender(challenge.referenceShaderSrc);
  if ('type' in refResult) {
    return failResult(0, `Reference shader error: ${refResult.message}`, performance.now() - renderStart, 0);
  }

  const userRender = userResult.pixels;
  const refRender  = refResult.pixels;
  const renderLatencyMs = performance.now() - renderStart;

  // Stage 1: MAE
  const maeResult = computeMAEResult(userRender, refRender, challenge.tolerance, challenge.useBlur);
  const maeScore  = maeResult.score;

  // Stage 2 decision tree — delegated to bandLogic so calibration and
  // production share a single source of truth for thresholds and weights.
  const band = await applyBandLogic({
    maeScore,
    config: bandConfig,
    callLLM: () => llmJudge({
      userRender,
      referenceRender: refRender,
      userShaderSrc,
      challenge,
    }),
  });

  return {
    maeScore,
    llmScore: band.llmResult?.score ?? null,
    finalScore: Math.round(band.finalScore),
    passed: band.passed,
    breakdown: {
      maeRaw: maeResult.rawMae,
      llmReasoning: band.llmResult?.reasoning,
      stageTwoInvoked: band.llmInvoked,
      llmUnavailable: band.llmUnavailable ? true : undefined,
    },
    renderLatencyMs,
    judgeLatencyMs: performance.now() - judgeStart,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function failResult(
  score: number,
  reason: string,
  renderLatencyMs: number,
  judgeLatencyMs: number,
): JudgeResult {
  return {
    maeScore: score,
    llmScore: null,
    finalScore: score,
    passed: false,
    breakdown: { maeRaw: 0, llmReasoning: reason, stageTwoInvoked: false },
    renderLatencyMs,
    judgeLatencyMs,
  };
}
