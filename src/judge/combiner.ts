import { compileShader, render } from './pipeline';
import { computeMAEResult } from './mae';
import type { Challenge, JudgeResult, LLMJudgeFn } from './types';

// ─── Band thresholds ──────────────────────────────────────────────────────────
// AI Systems & Integration owns calibration of these values.
// MAE score above HIGH → confident pass, skip LLM.
// MAE score below LOW  → confident fail, skip LLM.
// Between LOW and HIGH → borderline, invoke LLM to decide.
// Keeping the band narrow minimises API calls.

const MAE_HIGH = 90; // confident pass
const MAE_LOW  = 30; // confident fail

// Final score blend when LLM is invoked.
// MAE confirms the visual is in the right ballpark; LLM makes the qualitative call.
const MAE_WEIGHT = 0.4;
const LLM_WEIGHT = 0.6;

const PASS_THRESHOLD = 70;

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function judge(
  userShaderSrc: string,
  challenge: Challenge,
  llmJudge: LLMJudgeFn,
): Promise<JudgeResult> {
  const judgeStart = performance.now();

  // Stage 0: compile and render both shaders
  const renderStart = performance.now();

  const userProgram = compileShader(userShaderSrc);
  if ('type' in userProgram) {
    return failResult(0, userProgram.message, performance.now() - renderStart, 0);
  }

  const refProgram = compileShader(challenge.referenceShaderSrc);
  if ('type' in refProgram) {
    // Reference shader failing is a system error, not a user error — surface it clearly.
    return failResult(0, `Reference shader error: ${refProgram.message}`, performance.now() - renderStart, 0);
  }

  const userRender = render(userProgram);
  const refRender  = render(refProgram);
  const renderLatencyMs = performance.now() - renderStart;

  // Stage 1: MAE
  const maeResult = computeMAEResult(userRender, refRender, challenge.tolerance, challenge.useBlur);
  const maeScore  = maeResult.score;

  // Confident pass — skip LLM
  if (maeScore >= MAE_HIGH) {
    return {
      maeScore,
      llmScore: null,
      finalScore: maeScore,
      passed: true,
      breakdown: { maeRaw: maeResult.rawMae, stageTwoInvoked: false },
      renderLatencyMs,
      judgeLatencyMs: performance.now() - judgeStart,
    };
  }

  // Confident fail — skip LLM
  if (maeScore < MAE_LOW) {
    return {
      maeScore,
      llmScore: null,
      finalScore: maeScore,
      passed: false,
      breakdown: { maeRaw: maeResult.rawMae, stageTwoInvoked: false },
      renderLatencyMs,
      judgeLatencyMs: performance.now() - judgeStart,
    };
  }

  // Stage 2: borderline — invoke LLM
  const llmOutput = await llmJudge({
    userRender,
    referenceRender: refRender,
    userShaderSrc,
    challenge,
  });

  const llmScore   = llmOutput.score;
  const finalScore = Math.round(MAE_WEIGHT * maeScore + LLM_WEIGHT * llmScore);
  // A flagged shader (cheating detected) always fails, regardless of score.
  const passed = !llmOutput.flagged && finalScore >= PASS_THRESHOLD;

  return {
    maeScore,
    llmScore,
    finalScore,
    passed,
    breakdown: {
      maeRaw: maeResult.rawMae,
      llmReasoning: llmOutput.reasoning,
      stageTwoInvoked: true,
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
