import { describe, it, expect, vi, beforeEach } from 'vitest';

// Pipeline is mocked — no WebGL in Node. Each test controls the
// returned pixel buffers via mockReturnValueOnce to steer the
// combiner into a specific band (confident pass / borderline / fail).
vi.mock('../pipeline', () => ({
  CANVAS_SIZE: 512,
  WATCHDOG_MS: 2000,
  compileAndRender: vi.fn(),
  compileShader: vi.fn(),
  render: vi.fn(),
  getContext: vi.fn(),
  getCanvas: vi.fn(),
}));

import { judge } from '../combiner';
import { compileAndRender } from '../pipeline';
import { DEFAULT_BANDS } from '../../ai/bandLogic';
import { toLLMJudgeOutput, type JudgePromptResponse } from '../../ai/judgePrompt';
import { withCache, clearCache } from '../llm';
import type { JudgeResponse } from '../../ai/eval/judgeCall';
import type { Challenge, LLMJudgeFn } from '../types';

const mockCAR = vi.mocked(compileAndRender);

// ─── Type-equality check for the two response shapes ────────────────────────
// `JudgeResponse` lives in the eval harness and `JudgePromptResponse` lives
// in the in-app prompt module. They must stay structurally identical so the
// adapter has exactly one shape to handle.
//
// Two layers of defence:
//   1. Compile-time: these double assignments fail `tsc` if either side drifts.
//   2. Runtime: the adapter test below feeds a `JudgeResponse` into
//      `toLLMJudgeOutput` (typed for `JudgePromptResponse`); under vitest's
//      esbuild transform the types are stripped, but when `npm run typecheck`
//      is run the mismatch surfaces there.
const _judgeResponseEquivA: JudgePromptResponse = {} as JudgeResponse;
const _judgeResponseEquivB: JudgeResponse = {} as JudgePromptResponse;
void _judgeResponseEquivA;
void _judgeResponseEquivB;

const PIXEL_COUNT = 512 * 512;
const BUF_SIZE = PIXEL_COUNT * 4;

function solid(r: number, g: number, b: number): Uint8Array {
  const buf = new Uint8Array(BUF_SIZE);
  for (let i = 0; i < BUF_SIZE; i += 4) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = 255;
  }
  return buf;
}

const RED = solid(255, 0, 0);
const BLUE = solid(0, 0, 255);
// Perturbed: one-channel diff of 5 over tolerance 10 lands maeScore at
// ~83, which sits inside DEFAULT_BANDS.lowerBand..upperBand and forces
// the combiner to invoke the LLM thunk.
const PERTURBED = solid(255, 5, 0);

const BORDERLINE_CHALLENGE: Challenge = {
  id: 'integration-borderline',
  slug: 'integration-borderline',
  title: 'Integration',
  description: '',
  difficulty: 'beginner',
  referenceShaderSrc: 'ref',
  tolerance: 10,
  useBlur: false,
};

beforeEach(() => vi.clearAllMocks());

// ─── combiner × bandLogic ────────────────────────────────────────────────────
// These tests prove combiner delegates to applyBandLogic end-to-end. If
// anyone reintroduces hardcoded thresholds inside combiner, the pass/fail
// behaviour here diverges from bandLogic.test.ts and both suites fail.

describe('combiner × bandLogic — borderline band invokes LLM', () => {
  beforeEach(() => {
    mockCAR
      .mockReturnValueOnce({ pixels: RED,       compileMs: 1, renderMs: 1 })
      .mockReturnValueOnce({ pixels: PERTURBED, compileMs: 1, renderMs: 1 });
  });

  it('calls the LLM thunk exactly once with user+reference renders', async () => {
    const llm = vi.fn<LLMJudgeFn>(async () => ({ score: 85, reasoning: 'close', flagged: false }));
    await judge('src', BORDERLINE_CHALLENGE, llm);
    expect(llm).toHaveBeenCalledTimes(1);
    const arg = llm.mock.calls[0]?.[0];
    expect(arg?.userRender).toBe(RED);
    expect(arg?.referenceRender).toBe(PERTURBED);
    expect(arg?.userShaderSrc).toBe('src');
    expect(arg?.challenge).toBe(BORDERLINE_CHALLENGE);
  });

  it('combines mae=83.33 with llm=85 into finalScore=84 and passes', async () => {
    // mae = (100 - (5/3)/10 * 100) ≈ 83.3333; with DEFAULT_BANDS weights 0.5/0.5:
    // finalScore = round((83.3333 + 85) / 2) = round(84.1667) = 84, ≥ 80 → pass.
    const llm: LLMJudgeFn = async () => ({ score: 85, reasoning: 'close', flagged: false });
    const result = await judge('src', BORDERLINE_CHALLENGE, llm);
    expect(result.breakdown.stageTwoInvoked).toBe(true);
    expect(result.maeScore).toBeCloseTo(83.333, 2);
    expect(result.llmScore).toBe(85);
    expect(result.finalScore).toBe(84);
    expect(result.passed).toBe(true);
  });

  it('combines mae=83.33 with llm=70 into finalScore=77 and fails', async () => {
    // finalScore = round((83.3333 + 70) / 2) = round(76.6667) = 77, < 80 → fail.
    const llm: LLMJudgeFn = async () => ({ score: 70, reasoning: 'off', flagged: false });
    const result = await judge('src', BORDERLINE_CHALLENGE, llm);
    expect(result.llmScore).toBe(70);
    expect(result.finalScore).toBe(77);
    expect(result.passed).toBe(false);
  });
});

describe('combiner × bandLogic — flagged shader forces fail', () => {
  beforeEach(() => {
    mockCAR
      .mockReturnValueOnce({ pixels: RED,       compileMs: 1, renderMs: 1 })
      .mockReturnValueOnce({ pixels: PERTURBED, compileMs: 1, renderMs: 1 });
  });

  it('sets finalScore=0 and passed=false even with a perfect visual score', async () => {
    const llm: LLMJudgeFn = async () => ({
      score: 100,
      reasoning: 'samples reference texture',
      flagged: true,
    });
    const result = await judge('src', BORDERLINE_CHALLENGE, llm);
    expect(result.passed).toBe(false);
    expect(result.finalScore).toBe(0);
    expect(result.breakdown.stageTwoInvoked).toBe(true);
    expect(result.breakdown.llmReasoning).toContain('reference');
  });
});

describe('combiner — custom BandConfig overrides DEFAULT_BANDS', () => {
  it('flips a fail to a pass without mutating inputs or DEFAULT_BANDS', async () => {
    mockCAR
      .mockReturnValueOnce({ pixels: RED,       compileMs: 1, renderMs: 1 })
      .mockReturnValueOnce({ pixels: PERTURBED, compileMs: 1, renderMs: 1 });
    const llm: LLMJudgeFn = async () => ({ score: 70, reasoning: '', flagged: false });
    const snapshot = { ...DEFAULT_BANDS };
    // Same llm=70 as the fail case above; finalScore still 77, but now threshold is 50.
    const result = await judge('src', BORDERLINE_CHALLENGE, llm, {
      ...DEFAULT_BANDS,
      passThreshold: 50,
    });
    expect(result.finalScore).toBe(77);
    expect(result.passed).toBe(true);
    // DEFAULT_BANDS must not be mutated by a custom config.
    expect(DEFAULT_BANDS).toEqual(snapshot);
  });
});

// ─── JudgePromptResponse → LLMJudgeOutput adapter ────────────────────────────
// This is the seam that will matter once AI Systems wires the real
// Anthropic call into judgePrompt.ts. Keep the shape contract locked
// so the combiner keeps working regardless of what the prompt returns.

describe('toLLMJudgeOutput adapter', () => {
  const happy: JudgePromptResponse = {
    visualMatchScore: 82,
    codeQualityNote: 'clean SDF',
    passReasoning: 'close but saturation is high',
    flagged: false,
    flagReason: null,
  };

  it('maps the happy path onto the LLMJudgeFn contract', () => {
    const out = toLLMJudgeOutput(happy);
    expect(out.score).toBe(82);
    expect(out.reasoning).toBe('close but saturation is high');
    expect(out.flagged).toBe(false);
  });

  it('surfaces flagReason in `reasoning` when the shader is flagged', () => {
    const flagged: JudgePromptResponse = {
      ...happy,
      flagged: true,
      flagReason: 'texture lookup of a baked reference',
    };
    const out = toLLMJudgeOutput(flagged);
    expect(out.flagged).toBe(true);
    expect(out.reasoning).toBe('texture lookup of a baked reference');
  });

  it('falls back to passReasoning when flagged but flagReason is null', () => {
    const flaggedNoReason: JudgePromptResponse = {
      ...happy,
      flagged: true,
      flagReason: null,
    };
    const out = toLLMJudgeOutput(flaggedNoReason);
    expect(out.flagged).toBe(true);
    expect(out.reasoning).toBe(happy.passReasoning);
  });

  it('accepts a JudgeResponse from the eval harness (structural equality)', () => {
    // Eval-harness JudgeResponse value literally assigned into the adapter,
    // which is typed for JudgePromptResponse. If the shapes ever drift, tsc
    // flags this line; the runtime assertion below keeps the intent visible
    // during esbuild-only vitest runs.
    const fromEval: JudgeResponse = {
      visualMatchScore: 91,
      codeQualityNote: 'from eval',
      passReasoning: 'looks identical',
      flagged: false,
      flagReason: null,
    };
    const out = toLLMJudgeOutput(fromEval);
    expect(out.score).toBe(91);
    expect(out.flagged).toBe(false);
  });

  it('feeds cleanly into the combiner via an LLMJudgeFn stub', async () => {
    mockCAR
      .mockReturnValueOnce({ pixels: RED,       compileMs: 1, renderMs: 1 })
      .mockReturnValueOnce({ pixels: PERTURBED, compileMs: 1, renderMs: 1 });
    const promptFn = async (): Promise<JudgePromptResponse> => ({
      visualMatchScore: 88,
      codeQualityNote: '',
      passReasoning: 'looks right',
      flagged: false,
      flagReason: null,
    });
    const llm: LLMJudgeFn = async () => toLLMJudgeOutput(await promptFn());
    const result = await judge('src', BORDERLINE_CHALLENGE, llm);
    expect(result.llmScore).toBe(88);
    expect(result.breakdown.llmReasoning).toBe('looks right');
  });
});

// ─── withCache × toLLMJudgeOutput composition ───────────────────────────────
// The production call order is: prompt → toLLMJudgeOutput → withCache.
// This verifies the adapter's output is cacheable under the djb2 key
// scheme in src/judge/llm.ts, which keys on (challenge_id, shader_src)
// and therefore ignores minor LLM response variation for the same input.

// ─── LLM failure graceful degradation ───────────────────────────────────────
// When the LLM call rejects (network, rate limit, key issue), borderline
// submissions fall back to MAE-only scoring so the submit flow never hangs.
// The breakdown.llmUnavailable flag surfaces this to the UI for a banner.

describe('combiner × bandLogic — LLM failure fallback', () => {
  it('borderline MAE + LLM throws → falls back to MAE-only, passes if mae ≥ threshold', async () => {
    mockCAR
      .mockReturnValueOnce({ pixels: RED,       compileMs: 1, renderMs: 1 })
      .mockReturnValueOnce({ pixels: PERTURBED, compileMs: 1, renderMs: 1 });
    const llm: LLMJudgeFn = async () => {
      throw new Error('Anthropic API rate limit exceeded');
    };
    const result = await judge('src', BORDERLINE_CHALLENGE, llm);
    // mae ≈ 83.33 ≥ 80 → pass on MAE alone. Combiner rounds finalScore.
    expect(result.passed).toBe(true);
    expect(result.maeScore).toBeCloseTo(83.333, 2);
    expect(result.finalScore).toBe(83); // round(83.333)
    expect(result.llmScore).toBeNull();
    expect(result.breakdown.stageTwoInvoked).toBe(false);
    expect(result.breakdown.llmUnavailable).toBe(true);
  });

  it('borderline MAE + LLM throws → falls back to MAE-only, fails if mae < threshold', async () => {
    // Need a score in (40, 80). G differs by 30 → rawMae = 30/3 = 10.
    // score = 100 - (10/10)*100 = 0. Still too low.
    // Try G=15: rawMae = 15/3 = 5, score = 100 - (5/10)*100 = 50. That's borderline.
    const WEAK = solid(255, 15, 0);
    mockCAR
      .mockReturnValueOnce({ pixels: RED,  compileMs: 1, renderMs: 1 })
      .mockReturnValueOnce({ pixels: WEAK, compileMs: 1, renderMs: 1 });
    const llm: LLMJudgeFn = async () => {
      throw new Error('Network timeout');
    };
    const result = await judge('src', BORDERLINE_CHALLENGE, llm);
    expect(result.maeScore).toBeCloseTo(50, 1);
    expect(result.maeScore).toBeLessThan(DEFAULT_BANDS.passThreshold);
    expect(result.passed).toBe(false);
    expect(result.breakdown.llmUnavailable).toBe(true);
  });

  it('confident-pass MAE + LLM throws → still passes, LLM never invoked', async () => {
    const IDENTICAL = RED;
    mockCAR
      .mockReturnValueOnce({ pixels: RED,       compileMs: 1, renderMs: 1 })
      .mockReturnValueOnce({ pixels: IDENTICAL, compileMs: 1, renderMs: 1 });
    const llm = vi.fn<LLMJudgeFn>(async () => {
      throw new Error('should not be called');
    });
    const result = await judge('src', BORDERLINE_CHALLENGE, llm);
    expect(result.passed).toBe(true);
    expect(result.maeScore).toBe(100);
    expect(result.breakdown.stageTwoInvoked).toBe(false);
    expect(result.breakdown.llmUnavailable).toBeUndefined();
    expect(llm).not.toHaveBeenCalled();
  });

  it('confident-fail MAE + LLM throws → still fails, LLM never invoked', async () => {
    mockCAR
      .mockReturnValueOnce({ pixels: RED,  compileMs: 1, renderMs: 1 })
      .mockReturnValueOnce({ pixels: BLUE, compileMs: 1, renderMs: 1 });
    const llm = vi.fn<LLMJudgeFn>(async () => {
      throw new Error('should not be called');
    });
    const result = await judge('src', BORDERLINE_CHALLENGE, llm);
    expect(result.passed).toBe(false);
    expect(result.maeScore).toBeLessThan(DEFAULT_BANDS.lowerBand);
    expect(result.breakdown.stageTwoInvoked).toBe(false);
    expect(result.breakdown.llmUnavailable).toBeUndefined();
    expect(llm).not.toHaveBeenCalled();
  });
});

describe('withCache × toLLMJudgeOutput', () => {
  beforeEach(() => clearCache());

  it('serves adapter output from cache on repeat submission of the same shader', async () => {
    const prompt = vi.fn(async (): Promise<JudgePromptResponse> => ({
      visualMatchScore: 77,
      codeQualityNote: '',
      passReasoning: 'close but off',
      flagged: false,
      flagReason: null,
    }));
    const cachedFn: LLMJudgeFn = withCache(async () => toLLMJudgeOutput(await prompt()));
    const args = {
      userRender: RED,
      referenceRender: PERTURBED,
      userShaderSrc: 'void main() {}',
      challenge: BORDERLINE_CHALLENGE,
    };

    const first = await cachedFn(args);
    const second = await cachedFn(args);

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.score).toBe(77);
  });

  it('different shader source → separate cache entry, prompt called again', async () => {
    const prompt = vi.fn(async (): Promise<JudgePromptResponse> => ({
      visualMatchScore: 60,
      codeQualityNote: '',
      passReasoning: '',
      flagged: false,
      flagReason: null,
    }));
    const cachedFn: LLMJudgeFn = withCache(async () => toLLMJudgeOutput(await prompt()));
    const base = { userRender: RED, referenceRender: PERTURBED, challenge: BORDERLINE_CHALLENGE };

    await cachedFn({ ...base, userShaderSrc: 'shader A' });
    await cachedFn({ ...base, userShaderSrc: 'shader B' });

    expect(prompt).toHaveBeenCalledTimes(2);
  });
});
