// AI Systems & Integration. Band logic for the two-stage judge.
// See AI_SYSTEMS.md task 3.
//
// This module owns the decision tree only. Judge & Rendering Lead's
// combiner.ts (which doesn't exist yet on this branch) will call
// `applyBandLogic` after stage-one MAE scoring and pass a thunk that
// invokes the LLM judge with the renders it already has in hand.
//
// Defaults below are the starting values suggested by AI_SYSTEMS.md
// task 3. They get tuned against the eval harness (slice 3) and the
// tuned values replace these constants with empirical justification
// in the comment.

import type { LLMJudgeOutput } from '../judge/llm';

export interface BandConfig {
  /** MAE score >= this returns pass without invoking the LLM. */
  upperBand: number;
  /** MAE score < this returns fail without invoking the LLM. */
  lowerBand: number;
  /** Weight on MAE in the final combined score. maeWeight + llmWeight should sum to 1. */
  maeWeight: number;
  /** Weight on the LLM visualMatchScore in the final combined score. */
  llmWeight: number;
  /** Final score threshold for passing when both stages ran. */
  passThreshold: number;
}

export const DEFAULT_BANDS: BandConfig = {
  upperBand: 92,
  lowerBand: 40,
  maeWeight: 0.5,
  llmWeight: 0.5,
  passThreshold: 80,
};

export type BandClassification =
  | { kind: 'confident-pass' }
  | { kind: 'confident-fail' }
  | { kind: 'needs-llm' };

/**
 * Classify an MAE score against the band thresholds. Pure function,
 * no side effects, safe to call from anywhere.
 */
export function classifyByBand(
  maeScore: number,
  config: BandConfig = DEFAULT_BANDS,
): BandClassification {
  if (maeScore >= config.upperBand) return { kind: 'confident-pass' };
  if (maeScore < config.lowerBand) return { kind: 'confident-fail' };
  return { kind: 'needs-llm' };
}

/**
 * Weighted combine of MAE and LLM scores. Both inputs are 0-100.
 * Result clamped to [0, 100]. Pure.
 */
export function combineScores(
  maeScore: number,
  llmScore: number,
  config: BandConfig = DEFAULT_BANDS,
): number {
  const combined = maeScore * config.maeWeight + llmScore * config.llmWeight;
  return Math.max(0, Math.min(100, combined));
}

export interface ApplyBandLogicInput {
  maeScore: number;
  /** Thunk the caller (combiner.ts) provides. Kept as a zero-arg
   *  function so judge can close over the renders it already has
   *  without bandLogic needing to know about Uint8Arrays. */
  callLLM: () => Promise<LLMJudgeOutput>;
  config?: BandConfig;
}

export interface ApplyBandLogicResult {
  llmInvoked: boolean;
  llmResult: LLMJudgeOutput | null;
  finalScore: number;
  passed: boolean;
  /** Short human-readable trace for the breakdown field on JudgeResult. */
  trace: string;
}

/**
 * Run the full decision tree. Short-circuits the LLM call when MAE
 * is confidently one side of the bands. When flagged by the LLM,
 * returns fail regardless of the visual score - cheating overrides
 * pixel accuracy.
 */
export async function applyBandLogic(
  input: ApplyBandLogicInput,
): Promise<ApplyBandLogicResult> {
  const config = input.config ?? DEFAULT_BANDS;
  const classification = classifyByBand(input.maeScore, config);

  if (classification.kind === 'confident-pass') {
    return {
      llmInvoked: false,
      llmResult: null,
      finalScore: input.maeScore,
      passed: true,
      trace: `MAE ${input.maeScore.toFixed(1)} >= upperBand ${config.upperBand}, skipped LLM.`,
    };
  }

  if (classification.kind === 'confident-fail') {
    return {
      llmInvoked: false,
      llmResult: null,
      finalScore: input.maeScore,
      passed: false,
      trace: `MAE ${input.maeScore.toFixed(1)} < lowerBand ${config.lowerBand}, skipped LLM.`,
    };
  }

  const llmResult = await input.callLLM();

  if (llmResult.flagged) {
    return {
      llmInvoked: true,
      llmResult,
      finalScore: 0,
      passed: false,
      trace: `Flagged by LLM (${llmResult.reasoning}); forced fail.`,
    };
  }

  const finalScore = combineScores(input.maeScore, llmResult.score, config);
  const passed = finalScore >= config.passThreshold;
  return {
    llmInvoked: true,
    llmResult,
    finalScore,
    passed,
    trace: `MAE ${input.maeScore.toFixed(1)} + LLM ${llmResult.score} -> ${finalScore.toFixed(1)} (threshold ${config.passThreshold}).`,
  };
}
