import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Challenge } from '../judge/types';
import { llmJudge, JUDGE_MODEL, JUDGE_SYSTEM_PROMPT, type JudgePromptResponse } from './judgePrompt';

// jsdom has no canvas backend; mock the encoder the same way hintPrompt.test.ts does.
vi.mock('./imageEncode', () => ({
  rgbaToPngBase64: vi.fn(async () => 'ZmFrZV9wbmc='),
}));

const CHALLENGE: Challenge = {
  id: 'circle-sdf',
  slug: 'circle-sdf',
  title: 'Circle SDF',
  description: 'Draw a hard-edged circle using a signed distance field.',
  difficulty: 'beginner',
  referenceShaderSrc: 'void main() { gl_FragColor = vec4(1.0); }',
  tolerance: 10,
  useBlur: false,
};

const BUF = new Uint8Array(512 * 512 * 4);

const BASE_INPUT = {
  userRender: BUF,
  referenceRender: BUF,
  userShaderSrc: 'void main() { gl_FragColor = vec4(0.9, 0.1, 0.1, 1.0); }',
  challenge: CHALLENGE,
};

function proxyResponse(content: JudgePromptResponse, status = 200): Response {
  return new Response(
    JSON.stringify({
      content,
      inputTokens: 1200,
      outputTokens: 80,
      latencyMs: 1800,
      cacheHit: false,
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

describe('llmJudge', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () =>
      proxyResponse({
        visualMatchScore: 88,
        codeQualityNote: 'Clean SDF approach.',
        passReasoning: 'Output closely matches reference, minor anti-alias drift.',
        flagged: false,
        flagReason: null,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to /api/anthropic with the correct model and tool schema', async () => {
    await llmJudge(BASE_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/anthropic');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(JUDGE_MODEL);
    expect(body.system).toBe(JUDGE_SYSTEM_PROMPT);
    expect(body.jsonSchema).toBeDefined();
    expect(body.jsonSchema.name).toBe('judge_output');
  });

  it('sends both renders as base64 images in the content blocks', async () => {
    await llmJudge(BASE_INPUT);

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    const imageBlocks = body.userContent.filter((b: { type: string }) => b.type === 'image');
    expect(imageBlocks).toHaveLength(2);
    // Both encoded by the mock encoder
    expect(imageBlocks[0].base64).toBe('ZmFrZV9wbmc=');
    expect(imageBlocks[1].base64).toBe('ZmFrZV9wbmc=');
  });

  it('includes the shader source as a text block', async () => {
    await llmJudge(BASE_INPUT);

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    const textBlocks: { type: string; text: string }[] = body.userContent.filter(
      (b: { type: string }) => b.type === 'text',
    );
    const hasShader = textBlocks.some((b) => b.text.includes(BASE_INPUT.userShaderSrc));
    expect(hasShader).toBe(true);
  });

  it('maps the proxy response onto the LLMJudgeFn contract', async () => {
    const result = await llmJudge(BASE_INPUT);

    expect(result.score).toBe(88);
    expect(result.reasoning).toBe('Output closely matches reference, minor anti-alias drift.');
    expect(result.flagged).toBe(false);
  });

  it('sets flagged=true and surfaces flagReason when the shader is cheating', async () => {
    fetchMock.mockImplementationOnce(async () =>
      proxyResponse({
        visualMatchScore: 99,
        codeQualityNote: '',
        passReasoning: '',
        flagged: true,
        flagReason: 'Shader samples a hardcoded reference texture.',
      }),
    );

    const result = await llmJudge(BASE_INPUT);

    expect(result.flagged).toBe(true);
    expect(result.reasoning).toBe('Shader samples a hardcoded reference texture.');
    expect(result.score).toBe(99);
  });

  it('throws AnthropicCallError on a non-OK proxy response', async () => {
    fetchMock.mockImplementationOnce(async () =>
      new Response('Service unavailable', { status: 503 }),
    );

    await expect(llmJudge(BASE_INPUT)).rejects.toThrow(/anthropic proxy error 503/);
  });
});
