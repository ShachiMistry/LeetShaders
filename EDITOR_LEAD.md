# Role: Editor & UI Lead

You own everything the user touches. The Monaco editor, the live preview panel, the challenge list, the result UI, the layout. If a user opens LeetShaders and it feels rough, that's on you.

Read `CLAUDE.md` first for shared context. This file describes your specific tasks.

## Why this role

The editor experience is what makes LeetShaders feel like a tool people actually want to use. Monaco integration, GLSL syntax registration, and the live preview wiring are non-trivial engineering. Your CLI and Rust background means you're comfortable with low-level integration work, which is what Monaco's API actually is once you scratch past the React wrapper.

## Tasks

### 1. Monaco integration with GLSL language

Install and integrate `@monaco-editor/react` v4.7.0. Create `src/editor/Monaco.tsx`.

The non-trivial part: GLSL is not a built-in Monaco language. You register it manually.

Create `src/editor/glsl-language.ts`:

```ts
import * as monaco from 'monaco-editor';

export function registerGLSL() {
  monaco.languages.register({ id: 'glsl' });
  monaco.languages.setMonarchTokensProvider('glsl', {
    // Monarch tokenizer definition
  });
  monaco.languages.setLanguageConfiguration('glsl', {
    // brackets, comments, autoClosing
  });
}
```

The Monarch tokenizer needs to cover, at minimum:

- **Keywords:** `void`, `bool`, `int`, `uint`, `float`, `double`, `vec2`, `vec3`, `vec4`, `bvec2-4`, `ivec2-4`, `uvec2-4`, `mat2`, `mat3`, `mat4`, `mat2x3`, `mat3x2`, `mat3x4`, `mat4x3`, `sampler2D`, `samplerCube`, `uniform`, `varying`, `attribute`, `in`, `out`, `inout`, `precision`, `lowp`, `mediump`, `highp`, `if`, `else`, `for`, `while`, `do`, `return`, `break`, `continue`, `discard`, `struct`, `const`.
- **Built-in functions:** `texture`, `texture2D`, `textureCube`, `mix`, `smoothstep`, `step`, `clamp`, `min`, `max`, `abs`, `sign`, `floor`, `ceil`, `fract`, `mod`, `length`, `normalize`, `dot`, `cross`, `reflect`, `refract`, `pow`, `exp`, `log`, `sqrt`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `radians`, `degrees`.
- **Built-in variables:** `gl_FragCoord`, `gl_FragColor`, `gl_Position`, `gl_PointCoord`, `gl_FrontFacing`.
- **Number literals:** including scientific notation and the `f` suffix (e.g. `1.0`, `1.0e-3`, `1.5f`).
- **Comments:** `//` line, `/* */` block.
- **Operators:** standard math, comparison, swizzle access (`.xyz`, `.rgba`, `.stpq`).

Don't try to write this from memory. Use a reference like the GLSL ES 3.0 spec or copy a known-good Monarch grammar from a public repo (check the license, MIT is fine, GPL is not).

Wire compile errors from the render pipeline into `monaco.editor.setModelMarkers`, so errors show inline in the gutter with line numbers.

### 2. Three-pane layout

`src/pages/ChallengePage.tsx`. Material UI v7.3.9 Grid, or CSS grid if MUI fights you.

```
+----------------------+----------------------+
|                      |   Live preview       |
|   Monaco editor      |   (user's shader)    |
|                      +----------------------+
|                      |   Reference output   |
|                      |   (target image)     |
+----------------------+----------------------+
|   Error console (collapsible)               |
+---------------------------------------------+
|   [Submit]  Score panel (after submit)      |
+---------------------------------------------+
```

Resizable split would be nice but not required. Make sure it doesn't break on tablet width, mobile is out of scope.

### 3. Live preview

Wire the editor's `onChange` to a debounced (300ms) call into the Judge & Rendering Lead's `pipeline.compileShader` and `pipeline.render`.

**Critical: do not write a second WebGL context.** Import from `src/judge/pipeline.ts`. If Claude Code suggests creating one in your component, push back.

Animate `u_time` in the live preview using `requestAnimationFrame`. The reference output also animates if its shader uses `u_time`. Both panels share the same time clock.

### 4. Error console

`src/editor/ErrorConsole.tsx`.

- Subscribes to compile errors emitted by the pipeline.
- Renders each error with line number, column, and message.
- Clicking an error jumps Monaco's cursor to that line via `editor.revealLineInCenter` and `editor.setPosition`.
- Collapsible. Default expanded when there are errors, collapsed when clean.

### 5. Submit flow

A submit button that:

1. Calls the combiner from `src/judge/combiner.ts` with the user's current shader and the active challenge.
2. Shows a loading state. The LLM stage can take 3-8 seconds. **Don't hide that.** Show a progress indicator with stage labels: "Running pixel comparison..." then "Asking model for visual judgment..." Honest feedback beats a hung spinner.
3. Renders the result panel: final score (large, prominent), pass/fail badge with accessible color choices, MAE breakdown, LLM reasoning if invoked, latency stats (small, for debugging).
4. On pass, calls the backend submit endpoint to record the solve. Coordinate with Content & Backend on the API.

### 6. Challenge list page

`src/pages/ChallengeList.tsx`.

Cards in a grid. Each card:
- Difficulty badge (color-blind safe, use shape or text in addition to color).
- Title and short description.
- Completion status (locked, unsolved, solved with score).
- Solve count (community total).

Pull data through Content & Backend's `useChallenges()` hook. Don't query Supabase directly from this component, that's their abstraction.

### 7. Accessibility

Lighthouse a11y score >= 90. WCAG 2.1 AA.

Specifically:
- All interactive elements keyboard navigable, including Monaco itself (it has good keyboard support out of the box, just don't break it with custom event handlers).
- Pass/fail uses icon + text, not color alone.
- Focus indicators visible on all controls.
- ARIA labels on icon-only buttons.
- Color contrast >= 4.5:1 for normal text, 3:1 for large text.

Run Lighthouse before every PR. If the score drops below 90, fix it before merging.

## Working with Claude Code

- **Material UI v7 has API differences from v5.** Feed Claude Code the v7 docs URL when scaffolding components, especially for Grid (the API changed) and the new `sx` prop conventions.
- **Don't let it guess at Monarch syntax.** Monaco's tokenizer DSL is finicky. When something doesn't tokenize correctly, ask Claude Code to consult the Monaco source examples directly rather than reasoning from first principles.
- **Test in a real browser, not just dev mode.** Monaco behaves differently with Vite's HMR than with a production build. Check the Vercel preview before declaring a feature done.
- **Resist auto-formatting Monaco's content.** Some Claude Code suggestions will try to wire prettier into the editor. Don't, GLSL doesn't have a prettier plugin and you'll just produce broken output.

## What success looks like for your role

- A user can open a challenge, write a shader, see it render live as they type, hit submit, and get a result with a clear score.
- Monaco has working GLSL syntax highlighting, error annotations, and keyboard nav.
- Lighthouse a11y >= 90.
- The submit flow handles the LLM latency gracefully without feeling broken.
- No second WebGL context anywhere in your code.

## Coordinate with

- **Judge & Rendering Lead** on the `pipeline.ts` API. Pair early on what the live preview needs.
- **AI Systems & Integration** on the submit flow's loading states and error handling for LLM failures.
- **Content & Backend** on the `useChallenges` and `useChallenge(id)` hooks, plus the auth-aware submit endpoint.

## Out of scope

- Mobile layout. Tablet minimum.
- Diff overlay between user and reference renders. That's a final-milestone feature, not midterm.
- A dark/light mode toggle. Pick one (probably dark, it's a code editor) and ship it.
