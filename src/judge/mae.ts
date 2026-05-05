import type { MAEResult } from './types';
import { getContext, CANVAS_SIZE } from './pipeline';

// ─── Gaussian blur (GPU, two-pass separable) ──────────────────────────────────

const BLUR_VERT = `#version 300 es
void main() {
  float x = float(gl_VertexID & 1) * 4.0 - 1.0;
  float y = float((gl_VertexID >> 1) & 1) * 4.0 - 1.0;
  gl_Position = vec4(x, y, 0.0, 1.0);
}`;

// Single blur pass parameterised by direction uniform (vec2).
// 5-tap separable Gaussian kernel: [0.061, 0.245, 0.388, 0.245, 0.061]
const BLUR_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_direction;
out vec4 fragColor;
void main() {
  vec2 texel = 1.0 / vec2(textureSize(u_tex, 0));
  vec2 uv = gl_FragCoord.xy * texel;
  vec4 c = vec4(0.0);
  c += texture(u_tex, uv + u_direction * texel * -2.0) * 0.06136;
  c += texture(u_tex, uv + u_direction * texel * -1.0) * 0.24477;
  c += texture(u_tex, uv                             ) * 0.38774;
  c += texture(u_tex, uv + u_direction * texel *  1.0) * 0.24477;
  c += texture(u_tex, uv + u_direction * texel *  2.0) * 0.06136;
  fragColor = c;
}`;

interface BlurState {
  prog: WebGLProgram;
  texA: WebGLTexture;
  texB: WebGLTexture;
  fboA: WebGLFramebuffer;
  fboB: WebGLFramebuffer;
  locDir: WebGLUniformLocation;
  locTex: WebGLUniformLocation;
}

let blurState: BlurState | null = null;

function makeTexFBO(gl: WebGL2RenderingContext): [WebGLTexture, WebGLFramebuffer] {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CANVAS_SIZE, CANVAS_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return [tex, fbo];
}

function getBlurState(): BlurState {
  if (blurState) return blurState;

  const gl = getContext();

  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, BLUR_VERT);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, BLUR_FRAG);
  gl.compileShader(fs);

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Blur shader link failed: ${gl.getProgramInfoLog(prog)}`);
  }

  const [texA, fboA] = makeTexFBO(gl);
  const [texB, fboB] = makeTexFBO(gl);

  blurState = {
    prog,
    texA, texB,
    fboA, fboB,
    locDir: gl.getUniformLocation(prog, 'u_direction')!,
    locTex: gl.getUniformLocation(prog, 'u_tex')!,
  };
  return blurState;
}

function blurPass(
  gl: WebGL2RenderingContext,
  state: BlurState,
  srcTex: WebGLTexture,
  dstFBO: WebGLFramebuffer,
  direction: [number, number],
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO);
  gl.viewport(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  gl.useProgram(state.prog);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.uniform1i(state.locTex, 0);
  gl.uniform2f(state.locDir, direction[0], direction[1]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// Upload a Uint8Array pixel buffer into a WebGL texture.
function uploadTexture(gl: WebGL2RenderingContext, tex: WebGLTexture, pixels: Uint8Array): void {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CANVAS_SIZE, CANVAS_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
}

export function blurBuffer(pixels: Uint8Array): Uint8Array {
  const gl = getContext();
  const state = getBlurState();

  // Upload source into texA, horizontal blur → fboB, vertical blur → fboA
  uploadTexture(gl, state.texA, pixels);
  blurPass(gl, state, state.texA, state.fboB, [1, 0]);
  blurPass(gl, state, state.texB, state.fboA, [0, 1]);

  // Read result back from fboA
  const result = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.fboA);
  gl.readPixels(0, 0, CANVAS_SIZE, CANVAS_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, result);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return result;
}

// ─── MAE scoring ─────────────────────────────────────────────────────────────

// Per-channel RGB mean absolute error. Alpha is ignored.
export function computeMAE(bufferA: Uint8Array, bufferB: Uint8Array): number {
  if (bufferA.length !== bufferB.length) {
    throw new Error(`Buffer size mismatch: ${bufferA.length} vs ${bufferB.length}`);
  }
  let sum = 0;
  const pixelCount = bufferA.length / 4;
  for (let i = 0; i < bufferA.length; i += 4) {
    sum += Math.abs(bufferA[i]     - bufferB[i]);
    sum += Math.abs(bufferA[i + 1] - bufferB[i + 1]);
    sum += Math.abs(bufferA[i + 2] - bufferB[i + 2]);
  }
  return sum / (pixelCount * 3);
}

export function scoreFromMAE(rawMae: number, tolerance: number): number {
  return Math.max(0, 100 - (rawMae / tolerance) * 100);
}

export function computeMAEResult(
  bufferA: Uint8Array,
  bufferB: Uint8Array,
  tolerance: number,
  useBlur: boolean = false,
): MAEResult {
  const a = useBlur ? blurBuffer(bufferA) : bufferA;
  const b = useBlur ? blurBuffer(bufferB) : bufferB;
  const rawMae = computeMAE(a, b);
  const score  = scoreFromMAE(rawMae, tolerance);
  return { score, rawMae, blurApplied: useBlur };
}
