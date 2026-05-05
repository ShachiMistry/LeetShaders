import type { ShaderError } from './types';

export const CANVAS_SIZE = 512;

// Full-screen large triangle — covers NDC clip space with 3 vertices, no buffer needed.
// VertexID 0 → (-1,-1), 1 → (3,-1), 2 → (-1,3)
const VERT_SRC = `#version 300 es
out vec2 v_uv;
void main() {
  float x = float(gl_VertexID & 1) * 4.0 - 1.0;
  float y = float((gl_VertexID >> 1) & 1) * 4.0 - 1.0;
  v_uv = vec2(x, y) * 0.5 + 0.5;
  gl_Position = vec4(x, y, 0.0, 1.0);
}`;

export interface Uniforms {
  u_time?: number;
  u_resolution?: [number, number];
  u_mouse?: [number, number];
}

// Singleton GL state — one context for the entire app lifetime.
let gl: WebGL2RenderingContext | null = null;
let fbo: WebGLFramebuffer | null = null;
let vertShader: WebGLShader | null = null;

function initGL(): WebGL2RenderingContext {
  const canvas = document.createElement('canvas');
  canvas.width  = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('webgl2');
  if (!ctx) throw new Error('WebGL2 not supported in this environment');

  // FBO with RGBA8 (sized internal format required by WebGL2 for color-renderable
  // attachments). Chrome/ANGLE does not reliably support readPixels from the
  // default framebuffer on macOS — FBO is the correct solution.
  const tex = ctx.createTexture()!;
  ctx.bindTexture(ctx.TEXTURE_2D, tex);
  ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA8, CANVAS_SIZE, CANVAS_SIZE, 0, ctx.RGBA, ctx.UNSIGNED_BYTE, null);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
  ctx.bindTexture(ctx.TEXTURE_2D, null);

  const fb = ctx.createFramebuffer()!;
  ctx.bindFramebuffer(ctx.FRAMEBUFFER, fb);
  ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, tex, 0);

  const status = ctx.checkFramebufferStatus(ctx.FRAMEBUFFER);
  if (status !== ctx.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);
  }
  ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);

  const vs = ctx.createShader(ctx.VERTEX_SHADER)!;
  ctx.shaderSource(vs, VERT_SRC);
  ctx.compileShader(vs);
  if (!ctx.getShaderParameter(vs, ctx.COMPILE_STATUS)) {
    throw new Error(`Internal vertex shader failed: ${ctx.getShaderInfoLog(vs)}`);
  }

  fbo = fb;
  vertShader = vs;
  return ctx;
}

function getGL(): WebGL2RenderingContext {
  if (!gl) gl = initGL();
  return gl;
}

export function getContext(): WebGL2RenderingContext {
  return getGL();
}

// Parses GLSL info log lines into structured errors.
// Handles both ANGLE format "ERROR: 0:5: msg" and bare "0:5: msg".
function parseInfoLog(log: string): { line: number; message: string }[] {
  const results: { line: number; message: string }[] = [];
  for (const raw of log.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/(?:ERROR:\s*\d+:(\d+):|(\d+):(\d+):)\s*(.+)/);
    if (m) {
      const lineNum = parseInt(m[1] ?? m[3], 10);
      const msg = (m[4] ?? '').trim();
      results.push({ line: lineNum, message: msg });
    } else {
      results.push({ line: 0, message: line });
    }
  }
  return results;
}

export function compileShader(fragSrc: string): WebGLProgram | ShaderError {
  const ctx = getGL();

  const fs = ctx.createShader(ctx.FRAGMENT_SHADER)!;
  ctx.shaderSource(fs, fragSrc);
  ctx.compileShader(fs);

  if (!ctx.getShaderParameter(fs, ctx.COMPILE_STATUS)) {
    const log = ctx.getShaderInfoLog(fs) ?? '';
    ctx.deleteShader(fs);
    return {
      type: 'compile_error',
      message: 'Shader compilation failed',
      errors: parseInfoLog(log),
    };
  }

  const prog = ctx.createProgram()!;
  ctx.attachShader(prog, vertShader!);
  ctx.attachShader(prog, fs);
  ctx.linkProgram(prog);
  ctx.deleteShader(fs);

  if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
    const log = ctx.getProgramInfoLog(prog) ?? '';
    ctx.deleteProgram(prog);
    return {
      type: 'compile_error',
      message: 'Program link failed',
      errors: parseInfoLog(log),
    };
  }

  return prog;
}

function setUniforms(ctx: WebGL2RenderingContext, prog: WebGLProgram, uniforms: Uniforms): void {
  const time = uniforms.u_time ?? 0;
  const res   = uniforms.u_resolution ?? [CANVAS_SIZE, CANVAS_SIZE];
  const mouse = uniforms.u_mouse ?? [0, 0];

  const locTime  = ctx.getUniformLocation(prog, 'u_time');
  if (locTime)  ctx.uniform1f(locTime, time);

  const locRes   = ctx.getUniformLocation(prog, 'u_resolution');
  if (locRes)   ctx.uniform2f(locRes, res[0], res[1]);

  const locMouse = ctx.getUniformLocation(prog, 'u_mouse');
  if (locMouse) ctx.uniform2f(locMouse, mouse[0], mouse[1]);
}

export function render(program: WebGLProgram, uniforms: Uniforms = {}): Uint8Array {
  const ctx = getGL();

  ctx.bindFramebuffer(ctx.FRAMEBUFFER, fbo);
  ctx.viewport(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.useProgram(program);
  setUniforms(ctx, program, uniforms);
  ctx.drawArrays(ctx.TRIANGLES, 0, 3);

  const pixels = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE * 4);
  ctx.readPixels(0, 0, CANVAS_SIZE, CANVAS_SIZE, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
  ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
  return pixels;
}

export const WATCHDOG_MS = 2000;

export interface RenderResult {
  pixels: Uint8Array;
  compileMs: number;
  renderMs: number;
}

// Wraps compileShader + render with a wall-clock watchdog.
// readPixels is synchronous — an infinite-loop shader blocks until the browser's
// GPU watchdog kills the context. This detects the timeout after the fact.
export function compileAndRender(
  fragSrc: string,
  uniforms: Uniforms = {},
  timeoutMs: number = WATCHDOG_MS,
): RenderResult | ShaderError {
  const start = performance.now();

  const program = compileShader(fragSrc);
  if ('type' in program) return program;

  const compileMs = performance.now() - start;
  if (compileMs > timeoutMs) {
    return { type: 'timeout', message: `Compilation took ${compileMs.toFixed(0)}ms, limit is ${timeoutMs}ms` };
  }

  const renderStart = performance.now();
  const pixels = render(program, uniforms);
  const renderMs = performance.now() - renderStart;

  const total = performance.now() - start;
  if (total > timeoutMs) {
    return { type: 'timeout', message: `Render took ${renderMs.toFixed(0)}ms, total ${total.toFixed(0)}ms exceeded ${timeoutMs}ms limit` };
  }

  return { pixels, compileMs, renderMs };
}
