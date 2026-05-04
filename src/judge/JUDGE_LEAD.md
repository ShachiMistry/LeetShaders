# Role: Judge & Rendering Lead

You own the technical core of LeetShaders. The judge and the WebGL2 render pipeline are your responsibility, and the project's credibility hinges on them working correctly.

Read `CLAUDE.md` first for shared context. This file describes your specific tasks.

## Why this role

The judge is what makes LeetShaders different from a Shadertoy clone. If it scores correctly across the challenge bank with low false-pass and false-fail rates, the project lands. If it doesn't, nothing else matters. GPU and rendering work plays directly to your strength here.

## Tasks

### 1. WebGL2 render pipeline

Build a framework-free TypeScript module at `src/judge/pipeline.ts`. No React, no Material UI, just WebGL2.

Requirements:

- A shared WebGL2 context bound to an offscreen canvas at 512x512.
- A `compileShader(fragSrc: string)` function that compiles a fragment shader against a fixed vertex shader (full-screen quad) and returns either a `WebGLProgram` or a structured error with line numbers parsed from the GLSL info log.
- A `render(program, uniforms)` function that draws to a `WebGLFramebuffer` and returns the RGBA `Uint8Array` from `readPixels`.
- Standard uniforms exposed automatically: `u_time`, `u_resolution`, `u_mouse`. Default `u_time` to 0 unless caller specifies otherwise.
- Context-loss recovery. Listen for `webglcontextlost`, prevent default, recreate on `webglcontextrestored`. The page must not crash if a user submits a shader that nukes the context.
- A wall-clock watchdog using `performance.now`. If compile plus first frame exceeds 2 seconds, abort and return a timeout error. Do not bother with `EXT_disjoint_timer_query`, it's not universally available and you don't need GPU timing for this.

This module is consumed by both the live preview (Editor & UI Lead's code) and the judge. There is exactly one render pipeline in the codebase.

### 2. MAE scoring (stage one judge)

Build `src/judge/mae.ts`.

- `computeMAE(bufferA: Uint8Array, bufferB: Uint8Array): number`, per-channel mean absolute error across RGB. Skip alpha unless we decide otherwise.
- Gaussian blur pre-pass implemented as a separate WebGL shader program. Apply to both buffers before MAE. Toggleable via the challenge's `useBlur` field.
- Score formula: `score = max(0, 100 - (mae / tolerance) * 100)`.
- The function returns a `MAEResult` with `{ score, rawMae, blurApplied }`. Don't decide pass/fail here, the combiner does that.

### 3. Shared types

Create `src/judge/types.ts` with the `Challenge` and `JudgeResult` interfaces from `CLAUDE.md`. Lock these by end of week one, ideally sooner. Once locked, changes go through Discord proposal, not silent edits.

### 4. LLM judge interface

You don't write the prompt or the calibration logic, AI Systems & Integration owns that. You write the seam.

In `src/judge/llm.ts`, expose:

```ts
interface LLMJudgeInput {
  userRender: Uint8Array;
  referenceRender: Uint8Array;
  userShaderSrc: string;
  challenge: Challenge;
}

interface LLMJudgeOutput {
  score: number;
  reasoning: string;
  flagged: boolean;
}

type LLMJudgeFn = (input: LLMJudgeInput) => Promise<LLMJudgeOutput>;
```

Implement a stub that returns a fixed `{ score: 75, reasoning: 'stub', flagged: false }` so the rest of the pipeline can be tested without burning API credits. AI Systems will replace the stub with the real implementation.

### 5. Combiner (collaborate with AI Systems)

`src/judge/combiner.ts` orchestrates stage one and stage two. AI Systems owns the band logic (when to invoke the LLM), you own the plumbing. Pair on this file rather than treating it as either of your sole responsibilities.

The exported function:

```ts
async function judge(
  userShaderSrc: string,
  challenge: Challenge,
  llmJudge: LLMJudgeFn
): Promise<JudgeResult>
```

### 6. Test harness

This is the artifact that proves the judge works before the rest of the app exists. Two pieces:

**Standalone HTML page** at `src/judge/test/manual.html`. Two textareas (user shader, reference shader), a "judge" button, output panel showing both renders side by side, MAE score, and (when wired up) LLM score. Run with Vite dev server. This is what you demo to the team to prove the pipeline works end to end before integration.

**Vitest suite** at `src/judge/test/judge.test.ts`. Fixture-based tests:
- Identical shaders score 100.
- Slightly perturbed shader (e.g. reference plus 0.01 offset) scores high but not 100.
- Wildly different shaders score low.
- Shader that fails to compile returns a structured error, not a crash.
- Context loss simulation (force-kill the context via `WEBGL_lose_context` extension) recovers cleanly.

The Vitest suite must pass in CI before any PR merges to `main`.

## Working with Claude Code

- **Scaffold standalone first.** Build the entire judge in a separate Vite project with no React. Get MAE working, get the test harness green, then plug in the LLM stub, then port the module into the main app. Trying to debug WebGL state and React lifecycle simultaneously is a trap.
- **Feed it the WebGL2 spec links.** Claude Code's WebGL knowledge is patchy. When something doesn't work, paste the relevant MDN page into the conversation rather than letting it guess.
- **Don't accept "should work" answers.** WebGL fails silently in a thousand ways. If Claude Code writes a shader pipeline, run it and check the output buffer manually. `console.log(buffer.slice(0, 16))` is your friend.
- **Reject suggestions to add Three.js or regl.** The proposal commits to raw WebGL2 for shader fidelity. If Claude Code suggests an abstraction, push back.

## What success looks like for your role

- The render pipeline module is imported by the editor's live preview and works without modification.
- The Vitest suite is green and runs in CI.
- Calibrated MAE tolerances on at least 6 challenges produce sensible pass/fail at midterm.
- Stage two LLM seam works with the stub, ready for AI Systems to drop in the real implementation.
- No `any` types in the public API of `src/judge/`.

## Coordinate with

- **AI Systems & Integration** on `combiner.ts` and the `LLMJudgeFn` contract.
- **Editor & UI Lead** on what the live preview needs from `pipeline.ts`. Pair early, before they are blocked.
- **Content & Backend** on the `Challenge` interface, especially the tolerance and blur fields.

## Out of scope

- Server-side rendering of any kind. The judge runs in the browser.
- Animated challenges. Single-frame only for now, time uniform defaults to 0.
- Performance optimization beyond the latency targets in `CLAUDE.md`. Get it working first.
