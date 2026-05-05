import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Challenge } from '../judge/types';
import { generateHint, HintRateLimitError } from './hintPrompt';
import { InMemoryCache } from './cache';
import { InMemoryRateLimiter } from './rateLimit';

// jsdom has no canvas backend; mock the encoder so the suite never
// touches OffscreenCanvas or HTMLCanvasElement 2d contexts.
vi.mock('./imageEncode', () => ({
  rgbaToPngBase64: vi.fn(async () => 'ZmFrZV9wbmc='),
}));

const challenge: Challenge = {
  id: 'challenge-001',
  slug: 'starter',
  title: 'Starter',
  description: 'Fill the screen with a gradient.',
  difficulty: 'beginner',
  referenceShaderSrc: 'void main() { gl_FragColor = vec4(1.0); }',
  tolerance: 0.1,
  useBlur: false,
};

const baseInput = {
  userId: 'user-1',
  userShaderSrc: 'void main() { gl_FragColor = vec4(0.5); }',
  referenceShaderSrc: challenge.referenceShaderSrc,
  challenge,
  userRender: new Uint8Array(16),
  referenceRender: new Uint8Array(16),
  renderWidth: 2,
  renderHeight: 2,
};

function mockFetchResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('generateHint', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () =>
      mockFetchResponse({
        content: 'Consider smoothstep when softening edges.',
        inputTokens: 150,
        outputTokens: 25,
        latencyMs: 480,
        cacheHit: false,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the proxy and returns a hint paragraph', async () => {
    const cache = new InMemoryCache<string>();
    const limiter = new InMemoryRateLimiter();

    const result = await generateHint(baseInput, { cache, rateLimiter: limiter });

    expect(result.hint).toBe('Consider smoothstep when softening edges.');
    expect(result.cacheHit).toBe(false);
    expect(result.remainingHints).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/anthropic',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('serves subsequent identical requests from cache', async () => {
    const cache = new InMemoryCache<string>();
    const limiter = new InMemoryRateLimiter();

    await generateHint(baseInput, { cache, rateLimiter: limiter });
    fetchMock.mockClear();

    const second = await generateHint(baseInput, { cache, rateLimiter: limiter });

    expect(second.cacheHit).toBe(true);
    expect(second.remainingHints).toBe(-1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws HintRateLimitError once the per-user cap is hit', async () => {
    const cache = new InMemoryCache<string>();
    const limiter = new InMemoryRateLimiter(1, 60_000);

    await generateHint(baseInput, { cache, rateLimiter: limiter });

    const differentShader = {
      ...baseInput,
      userShaderSrc: 'void main() { gl_FragColor = vec4(0.25); }',
    };

    await expect(
      generateHint(differentShader, { cache, rateLimiter: limiter }),
    ).rejects.toBeInstanceOf(HintRateLimitError);
  });

  it('surfaces proxy errors to the caller', async () => {
    fetchMock.mockImplementationOnce(async () =>
      new Response('upstream down', { status: 502 }),
    );
    const cache = new InMemoryCache<string>();
    const limiter = new InMemoryRateLimiter();

    await expect(
      generateHint(baseInput, { cache, rateLimiter: limiter }),
    ).rejects.toThrow(/anthropic proxy error 502/);
  });
});
