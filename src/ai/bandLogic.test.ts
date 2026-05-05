import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_BANDS,
  applyBandLogic,
  classifyByBand,
  combineScores,
} from './bandLogic';

describe('classifyByBand', () => {
  it('returns confident-pass at and above upperBand', () => {
    expect(classifyByBand(92).kind).toBe('confident-pass');
    expect(classifyByBand(100).kind).toBe('confident-pass');
  });

  it('returns confident-fail strictly below lowerBand', () => {
    expect(classifyByBand(0).kind).toBe('confident-fail');
    expect(classifyByBand(39.9).kind).toBe('confident-fail');
  });

  it('returns needs-llm in the borderline band', () => {
    expect(classifyByBand(40).kind).toBe('needs-llm');
    expect(classifyByBand(91.9).kind).toBe('needs-llm');
  });
});

describe('combineScores', () => {
  it('weights mae and llm with the configured coefficients', () => {
    expect(combineScores(80, 60)).toBe(70);
  });

  it('clamps to [0, 100]', () => {
    const cfg = { ...DEFAULT_BANDS, maeWeight: 10, llmWeight: 10 };
    expect(combineScores(50, 50, cfg)).toBe(100);
  });
});

describe('applyBandLogic', () => {
  it('skips the LLM when MAE is confidently pass', async () => {
    const callLLM = vi.fn();
    const result = await applyBandLogic({ maeScore: 95, callLLM });
    expect(result.llmInvoked).toBe(false);
    expect(result.passed).toBe(true);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('skips the LLM when MAE is confidently fail', async () => {
    const callLLM = vi.fn();
    const result = await applyBandLogic({ maeScore: 10, callLLM });
    expect(result.llmInvoked).toBe(false);
    expect(result.passed).toBe(false);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('invokes the LLM and combines scores in the borderline band', async () => {
    const callLLM = vi.fn(async () => ({ score: 85, reasoning: 'close', flagged: false }));
    const result = await applyBandLogic({ maeScore: 75, callLLM });
    expect(result.llmInvoked).toBe(true);
    expect(result.finalScore).toBe(80);
    expect(result.passed).toBe(true);
    expect(callLLM).toHaveBeenCalledOnce();
  });

  it('forces fail when the LLM flags the shader for cheating', async () => {
    const callLLM = vi.fn(async () => ({
      score: 100,
      reasoning: 'samples reference texture directly',
      flagged: true,
    }));
    const result = await applyBandLogic({ maeScore: 80, callLLM });
    expect(result.passed).toBe(false);
    expect(result.finalScore).toBe(0);
    expect(result.trace).toMatch(/Flagged/);
  });
});
