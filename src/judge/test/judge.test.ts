import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the entire pipeline — no WebGL in Node.js.
// Each test controls what compileAndRender returns via mockReturnValueOnce.
vi.mock('../pipeline', () => ({
  CANVAS_SIZE: 512,
  WATCHDOG_MS: 2000,
  compileAndRender: vi.fn(),
  compileShader: vi.fn(),
  render: vi.fn(),
  getContext: vi.fn(),
  getCanvas: vi.fn(),
}));

import { computeMAE, scoreFromMAE, computeMAEResult } from '../mae';
import { judge } from '../combiner';
import { withCache, clearCache } from '../llm';
import { compileAndRender } from '../pipeline';
import type { Challenge, LLMJudgeFn } from '../types';

const mockCAR = vi.mocked(compileAndRender);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PIXEL_COUNT = 512 * 512;
const BUF_SIZE    = PIXEL_COUNT * 4;

function solid(r: number, g: number, b: number): Uint8Array {
  const buf = new Uint8Array(BUF_SIZE);
  for (let i = 0; i < BUF_SIZE; i += 4) {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  }
  return buf;
}

const RED  = solid(255, 0,   0);
const BLUE = solid(0,   0, 255);
const BLACK = solid(0,   0,   0);

const CHALLENGE: Challenge = {
  id: 'test', slug: 'test', title: 'Test', description: '',
  difficulty: 'beginner', referenceShaderSrc: 'ref', tolerance: 10, useBlur: false,
};

const stubLLM: LLMJudgeFn = async () => ({ score: 75, reasoning: 'stub', flagged: false });

beforeEach(() => vi.clearAllMocks());

// ─── MAE math — pure functions, no mocking needed ─────────────────────────────

describe('computeMAE', () => {
  it('identical buffers → 0', () => {
    expect(computeMAE(RED, RED)).toBe(0);
  });

  it('black vs red → 85 (only R differs by 255, averaged over 3 channels)', () => {
    expect(computeMAE(BLACK, RED)).toBeCloseTo(255 / 3, 5);
  });

  it('mismatched buffer lengths throw', () => {
    expect(() => computeMAE(new Uint8Array(4), new Uint8Array(8))).toThrow();
  });
});

describe('scoreFromMAE', () => {
  it('mae = 0 → 100', ()         => expect(scoreFromMAE(0, 10)).toBe(100));
  it('mae = tolerance → 0', ()   => expect(scoreFromMAE(10, 10)).toBe(0));
  it('mae > tolerance → 0', ()   => expect(scoreFromMAE(20, 10)).toBe(0));
  it('mae = half tolerance → 50', () => expect(scoreFromMAE(5, 10)).toBe(50));
});

// ─── judge() — identical shaders ─────────────────────────────────────────────

describe('judge — identical shaders', () => {
  beforeEach(() => {
    mockCAR
      .mockReturnValueOnce({ pixels: RED, compileMs: 1, renderMs: 1 })
      .mockReturnValueOnce({ pixels: RED, compileMs: 1, renderMs: 1 });
  });

  it('scores 100, passes, skips LLM', async () => {
    const result = await judge('src', CHALLENGE, stubLLM);
    expect(result.maeScore).toBe(100);
    expect(result.finalScore).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.breakdown.stageTwoInvoked).toBe(false);
    expect(result.llmScore).toBeNull();
  });
});

// ─── judge() — slightly perturbed shader ─────────────────────────────────────
// RED vs RED+5 on G channel → rawMae ≈ 1.67, score ≈ 83 (borderline → LLM invoked)

describe('judge — slightly perturbed shader', () => {
  beforeEach(() => {
    const nudged = solid(255, 5, 0);
    mockCAR
      .mockReturnValueOnce({ pixels: RED,    compileMs: 1, renderMs: 1 })
      .mockReturnValueOnce({ pixels: nudged, compileMs: 1, renderMs: 1 });
  });

  it('maeScore is high but not 100', async () => {
    const result = await judge('src', CHALLENGE, stubLLM);
    expect(result.maeScore).toBeGreaterThan(50);
    expect(result.maeScore).toBeLessThan(100);
  });
});

// ─── judge() — wildly different shaders ──────────────────────────────────────
// RED vs BLUE → rawMae = (255+0+255)/3 = 170, score = 0 < MAE_LOW → fail, no LLM

describe('judge — wildly different shaders', () => {
  beforeEach(() => {
    mockCAR
      .mockReturnValueOnce({ pixels: RED,  compileMs: 1, renderMs: 1 })
      .mockReturnValueOnce({ pixels: BLUE, compileMs: 1, renderMs: 1 });
  });

  it('scores near 0, fails, skips LLM', async () => {
    const result = await judge('src', CHALLENGE, stubLLM);
    expect(result.maeScore).toBeLessThan(10);
    expect(result.passed).toBe(false);
    expect(result.breakdown.stageTwoInvoked).toBe(false);
  });
});

// ─── judge() — compile error ──────────────────────────────────────────────────

describe('judge — compile error', () => {
  beforeEach(() => {
    mockCAR.mockReturnValueOnce({
      type: 'compile_error',
      message: 'Shader compilation failed',
      errors: [{ line: 3, message: "undeclared identifier 'foo'" }],
    });
  });

  it('returns structured fail result, does not throw', async () => {
    const result = await judge('bad shader', CHALLENGE, stubLLM);
    expect(result.passed).toBe(false);
    expect(result.finalScore).toBe(0);
    expect(result.breakdown.llmReasoning).toContain('Shader compilation failed');
    expect(result.breakdown.stageTwoInvoked).toBe(false);
  });
});

// ─── judge() — context loss ───────────────────────────────────────────────────

describe('judge — context loss during render', () => {
  beforeEach(() => {
    mockCAR.mockReturnValueOnce({
      type: 'context_lost',
      message: 'WebGL context is lost — try again in a moment',
    });
  });

  it('returns structured fail result, does not throw', async () => {
    const result = await judge('src', CHALLENGE, stubLLM);
    expect(result.passed).toBe(false);
    expect(result.finalScore).toBe(0);
    expect(result.breakdown.stageTwoInvoked).toBe(false);
  });
});

// ─── LLM cache ───────────────────────────────────────────────────────────────

describe('LLM cache', () => {
  beforeEach(() => clearCache());

  it('identical shader + challenge → cache hit, inner judge called once', async () => {
    const inner = vi.fn(async () => ({ score: 80, reasoning: 'ok', flagged: false }));
    const cached = withCache(inner);
    const input = {
      userRender: RED, referenceRender: BLUE,
      userShaderSrc: 'void main(){}', challenge: CHALLENGE,
    };

    await cached(input);
    await cached(input);

    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('different shader sources → separate cache entries, inner judge called twice', async () => {
    const inner = vi.fn(async () => ({ score: 80, reasoning: 'ok', flagged: false }));
    const cached = withCache(inner);
    const base = { userRender: RED, referenceRender: BLUE, challenge: CHALLENGE };

    await cached({ ...base, userShaderSrc: 'shader A' });
    await cached({ ...base, userShaderSrc: 'shader B' });

    expect(inner).toHaveBeenCalledTimes(2);
  });
});
