# LeetShaders, Project Context

This file is shared context for every team member and every Claude Code session on this repo. Read it before starting work.

## What we are building

LeetShaders is a browser-native GLSL shader coding challenge platform. Users write fragment shaders in a Monaco editor, see their output rendered live, and submit against curated reference shaders. A hybrid judge (MAE pixel comparison plus an LLM vision model) decides whether the submission passes.

Think LeetCode for shader graphics. The hard problem is the judge.

## Tech stack, locked

| Layer | Choice |
| --- | --- |
| Frontend framework | React 19, Vite |
| Code editor | @monaco-editor/react v4.7.0, GLSL registered manually |
| WebGL runtime | Raw WebGL2, no abstraction |
| UI | Material UI v7.3.9 |
| State | Zustand 5.0.5 |
| Backend | Supabase, Auth plus Postgres |
| AI judge | Anthropic Claude Opus 4.7 vision |
| AI hints | Anthropic Claude Sonnet 4.6 |
| Deployment | Vercel for frontend, Supabase hosted for backend |

Do not introduce new libraries without team agreement. If a Claude Code session suggests adding a new dependency, push back and check with the team first.

## Architecture overview

Three big pieces.

**The render pipeline** lives in a framework-free TypeScript module owned by the Judge & Rendering Lead. It exposes a shared WebGL2 context, compiles GLSL fragment shaders, renders them to offscreen framebuffers at 512x512, and returns RGBA `Uint8Array` buffers via `readPixels`. The live preview in the editor and the submission judge both consume this same module. There is exactly one WebGL pipeline in this codebase.

**The hybrid judge** runs in two stages. Stage one is MAE per channel with optional Gaussian blur pre-pass, fast and cheap. Stage two is an LLM vision call that scores visual similarity and checks the shader source for cheats (e.g. texture lookup of a reference image). The combiner skips stage two when stage one is confidently pass or fail and only invokes the LLM in the borderline band. This keeps latency and cost manageable.

**The challenge bank** is a folder of `.glsl` reference shaders plus `.json` metadata, seeded into Supabase. Each challenge has its own tolerance value, hand-tuned by the content author.

## Shared interfaces

These are the contracts everyone codes against. The Judge & Rendering Lead owns the file that exports them and locks them by end of week one.

```ts
interface Challenge {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  referenceShaderSrc: string;
  tolerance: number;
  useBlur: boolean;
  hintText?: string;
}

interface JudgeResult {
  maeScore: number;
  llmScore: number | null;
  finalScore: number;
  passed: boolean;
  breakdown: {
    maeRaw: number;
    llmReasoning?: string;
    stageTwoInvoked: boolean;
  };
  renderLatencyMs: number;
  judgeLatencyMs: number;
}
```

If you need to add a field, talk to the Judge & Rendering Lead first.

## Repo layout

```
src/
  judge/          # owned by Judge & Rendering Lead
    pipeline.ts   # WebGL2 context, compile, render, readPixels
    mae.ts        # stage one scoring
    llm.ts        # stage two LLM judge interface (impl by AI Systems)
    combiner.ts   # decides which stages run (impl by AI Systems)
    types.ts      # Challenge, JudgeResult
    test/         # standalone HTML + Vitest harness
  editor/         # owned by Editor & UI Lead
    Monaco.tsx
    glsl-language.ts  # Monarch tokenizer
    LivePreview.tsx
    ErrorConsole.tsx
  pages/          # owned by Editor & UI Lead
    ChallengeList.tsx
    ChallengePage.tsx
  ai/             # owned by AI Systems & Integration
    judgePrompt.ts
    hintPrompt.ts
    eval/         # prompt calibration harness + fixtures
  backend/        # owned by Content & Backend
    supabase.ts
    useAuth.ts
    seed.ts
  challenges/     # owned by Content & Backend
    [slug].glsl
    [slug].json
    [slug].md
```

## Working with Claude Code, conventions for everyone

- **Read this file first** in every new Claude Code session. Paste it in or reference it. The model needs the architecture context.
- **Read your own role-specific .md** second. Your tasks live there.
- **One pipeline rule.** The live preview and the judge consume the same compile path. If Claude Code starts writing a second WebGL context manager, stop it.
- **Lock the contract first.** The `Challenge` and `JudgeResult` types above are the integration seam. Do not let Claude Code drift them silently.
- **Prefer scaffolding standalone.** When a module has a clear contract (judge, prompts, challenge files), build it in isolation with a test harness before integrating. This is faster than fighting React lifecycle while debugging WebGL or LLM calls.
- **Verify model strings.** The current Anthropic models are `claude-opus-4-7` and `claude-sonnet-4-6`. Claude Code may suggest older model names from its training data. Override.
- **Material UI v7 has API differences from v5.** Feed Claude Code the v7 docs URL when scaffolding components.
- **Supabase RLS.** Do not skip row-level security. Even though scoring is client-side, solve records and user data need policies.

## Code style

- TypeScript strict mode, no `any` without comment justification.
- Functional React, hooks, no class components.
- Prettier defaults, no debate.
- Commits follow `type(scope): message`, e.g. `feat(judge): add gaussian blur prepass`.

## Branching

- `main` is protected. PRs required, one reviewer minimum.
- Feature branches: `feature/[scope]`, e.g. `feature/judge-mae`, `feature/editor-monaco`.
- Vercel preview deployments per PR. Use these for visual review, the screenshot or live link is part of the PR description.

## Communication

- Discord for sync, Notion for async progress.
- If you are blocked on someone else's interface, post in Discord and tag them. Do not silently work around it, that creates integration debt.
- The `Challenge` and `JudgeResult` contracts are the most likely friction point. If you want to change them, propose in Discord, do not just edit the file.

## Milestones

This project ships across midterm and final.

**Midterm (Dec 4):** Core features only. MAE judge working with calibrated tolerances on at least 6 challenges. Editor live preview functional. Auth and submit flow wired. LLM judge can be stubbed if needed but the seam must exist.

**Final:** LLM judge stage two live and calibrated. AI hint system. Diff overlay. Leaderboard. 8 challenges minimum.

Stretch goals from the original proposal (community submissions, animated challenges) are out of scope. If they come up, defer.

## Risks to keep in mind

- **GPU/driver variance.** Same shader renders slightly differently across machines. The LLM judge stage absorbs this; MAE alone does not. Do not over-tighten MAE tolerances.
- **LLM latency and cost.** Every borderline submission is an API call. Cache aggressively by `(challenge_id, shader_hash)`.
- **Adversarial shaders.** A user can sample a hardcoded texture of the reference. The LLM judge prompt must inspect the shader source, not just the render.
- **Authoring time.** Writing a good challenge with a calibrated tolerance is harder than writing the shader. Budget accordingly.

## When in doubt

Ask in Discord before changing a shared interface, adding a dependency, or expanding scope. The project is bounded; new ideas go in the "future work" file, not in this sprint.
