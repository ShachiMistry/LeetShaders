# Role: Content & Backend

You own the challenge bank and the backend infrastructure. The challenges you write are what users actually solve, and the Supabase setup is what lets us track auth, solves, and cached judgments.

Read `CLAUDE.md` first for shared context. This file describes your specific tasks.

## Why this role

The challenge bank is the most self-contained piece of the project. You can work on it without waiting for anyone else's code to be done, and your output is files (`.glsl` and `.json`) that everyone consumes. The backend work is approachable, Supabase handles most of the hard parts (auth, Postgres, RLS), and you mostly need to set up schemas and wire hooks.

Tackle the challenge authoring first, it's the more important deliverable and it's the one that takes hand-tuning that nobody else can do for you.

## Tasks

### 1. Challenge authoring (primary scope)

Author **6 challenges minimum, 8 target**. Across three difficulty tiers.

**Beginner (4 challenges):**
- `solid-color`: render a specific solid color across the canvas. (Tests: do you understand `gl_FragColor`?)
- `uv-gradient`: linear gradient based on UV coordinates. (Tests: do you understand UV space?)
- `checkerboard`: black and white checkerboard pattern. (Tests: `mod`, `step`.)
- `circle-sdf`: a filled circle in the center using a signed distance function. (Tests: `length`, `step`.)

**Intermediate (3 challenges):**
- `radial-gradient`: gradient from a center point outward. (Tests: distance math, color mixing.)
- `value-noise`: simple grid-based noise pattern. (Tests: `floor`, `fract`, hashing.)
- `polar-pattern`: a radial pattern using polar coordinates. (Tests: `atan`, polar conversion.)

**Advanced (1 challenge, your pick):**
- `raymarched-sphere`: a 2D-projected sphere using basic raymarching. (Hard.)
- `procedural-brick`: brick or wood pattern with offset rows. (Easier than raymarching, more pattern-design heavy.)

Pick one. If you're not comfortable with raymarching, do brick. Don't try to do both unless the others are done early.

For each challenge, produce three files in `src/challenges/`:

**`[slug].glsl`**, the reference fragment shader. Must compile with WebGL2 GLSL ES 3.0. Header:

```glsl
#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

out vec4 fragColor;

void main() {
  // your reference shader here
}
```

**`[slug].json`**, the metadata:

```json
{
  "id": "uuid-v4-here",
  "slug": "circle-sdf",
  "title": "Circle SDF",
  "description": "Render a filled white circle, radius 0.3 in UV space, centered at (0.5, 0.5), on a black background.",
  "difficulty": "beginner",
  "tolerance": 8.0,
  "useBlur": true,
  "hintText": "Think about distance from a point. The length() function gives you that, and step() turns it into a binary cutoff."
}
```

**`[slug].md`**, a short README documenting the intended solution approach. This is for the team and for testing the judge. Describe the algorithmic approach, what built-ins are likely used, and what a passing user solution looks like. Include a sample passing shader so the Judge & Rendering Lead can run it through the test harness.

### 2. Tolerance calibration (the actual hard part)

Writing the reference shader is easy. Tuning `tolerance` so the judge passes good submissions and fails bad ones is the real work.

For each challenge:

1. Write the reference shader.
2. Render it via the Judge & Rendering Lead's test harness.
3. Write a "close" variant, slightly off but visually similar. Render it and submit through the judge.
4. Write a "wrong" variant, clearly different. Submit it.
5. Adjust `tolerance` so the close variant scores 80+ (passes) and the wrong variant scores well below 80 (fails).
6. Record the calibration in the `[slug].md` file: what tolerance you ended up with and why.

For challenges with smooth gradients or anti-aliased edges, set `useBlur: true`. For sharp pattern challenges (checkerboard), `useBlur: false` is fine since you want crisp boundaries. Test both ways and pick what gives stable scores.

### 3. Shadertoy adaptations and licensing

If you adapt anything from Shadertoy:

- **Check the license per shader.** Most are CC-BY-NC-SA. That has implications: NC means non-commercial (we're a course project, fine), SA means share-alike (anything we publish based on it is also CC-BY-NC-SA), BY means we credit the author.
- **Credit in the metadata.** Add a `"credit"` field to the JSON: `"credit": "Adapted from [Author Name]'s [Shader Title], https://shadertoy.com/view/XXXX, CC-BY-NC-SA"`.
- **Flag ambiguous cases to the team.** If you're not sure about a license, ask before adapting.

It's better to write your own simple challenges than to adapt complex Shadertoy ones with messy licensing.

### 4. Supabase schema

Create a Supabase project (free tier is fine for development).

Tables:

```sql
-- users handled by Supabase Auth, no custom table needed

create table challenges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  reference_shader_src text not null,
  tolerance float not null,
  use_blur boolean not null default false,
  hint_text text,
  credit text,
  created_at timestamptz default now()
);

create table solves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  challenge_id uuid references challenges(id) not null,
  final_score float not null,
  mae_score float not null,
  llm_score float,
  submitted_shader_src text not null,
  passed boolean not null,
  solved_at timestamptz default now()
);

create table judge_cache (
  cache_key text primary key,  -- sha256(challenge_id || shader_src)
  llm_score float not null,
  llm_reasoning text,
  flagged boolean not null,
  cached_at timestamptz default now()
);

create table api_telemetry (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  latency_ms int not null,
  cache_hit boolean not null,
  call_type text not null,  -- 'judge' | 'hint'
  called_at timestamptz default now()
);
```

Set up Row Level Security policies:
- `challenges`: anyone can read.
- `solves`: users can read their own solves and aggregate stats; only the authenticated user can insert their own.
- `judge_cache`: any authenticated user can read and write.
- `api_telemetry`: only authenticated users insert.

Do not skip RLS. AI Systems and Editor will both depend on it.

### 5. Auth integration

`src/backend/useAuth.ts`, a React hook returning:

```ts
interface AuthState {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

Supabase Auth handles email/password and Google OAuth out of the box. Wire both. Add a route guard component that wraps the submit endpoint, so unauthenticated users are redirected to login when they try to submit.

### 6. Data hooks for the editor

The Editor & UI Lead consumes these:

```ts
function useChallenges(): { data: Challenge[]; loading: boolean; error: Error | null }
function useChallenge(slug: string): { data: Challenge | null; loading: boolean; error: Error | null }
function useUserSolves(userId: string): { data: Solve[]; loading: boolean }
function useSubmitSolve(): (result: JudgeResult, shaderSrc: string, challengeId: string) => Promise<void>
```

Keep the API simple and abstract Supabase behind it. The editor never imports `@supabase/supabase-js` directly.

### 7. Seed script

`src/backend/seed.ts`. A one-shot script that reads every `[slug].json` in `src/challenges/` and inserts/upserts into the `challenges` table. Run via `npm run seed`.

This is what makes your challenge files actually appear in the app. Test it.

### 8. Vercel deployment

Connect the repo to Vercel. Configure:
- Production deploys from `main`.
- Preview deploys from every PR.
- Environment variables set for both: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (server-side only, never `VITE_` prefixed for the API key).

The Anthropic API key is the security-sensitive one. It must never be exposed to the client. Either route LLM calls through a Vercel serverless function or a Supabase Edge Function, do not put `ANTHROPIC_API_KEY` in any `VITE_` variable. Coordinate with AI Systems on this.

## Working with Claude Code

- **Generate shaders, then verify in a browser.** Claude Code is good at writing GLSL but it's not running it. Take its output, paste into Shadertoy or the team's local test harness, confirm it actually renders before saving the file.
- **Don't trust the LLM's first-pass tolerance number.** It has no way to know what tolerance is correct. Always tune by hand using the judge harness.
- **Supabase scaffolding.** Claude Code handles the Supabase SDK well. The risk is on the deployment side, env var scoping for preview vs production. Walk through that step by step.
- **Don't let it skip RLS.** Some scaffolds will set up tables without policies. Always add RLS, even for the judge cache.

## What success looks like for your role

- 6 to 8 challenges authored, each with `.glsl`, `.json`, `.md`, and calibrated tolerances.
- Supabase schema deployed with RLS in place.
- Auth working with email and Google.
- `useChallenges` and `useChallenge` hooks consumed cleanly by the Editor & UI Lead's pages.
- Seed script populates the database from challenge files.
- Vercel deploys cleanly on every PR with preview URLs visible.

## Coordinate with

- **Judge & Rendering Lead** on the `Challenge` interface and the test harness, you'll use it for tolerance calibration.
- **AI Systems & Integration** on the cache table and telemetry table, plus how the API key is exposed (serverless function design).
- **Editor & UI Lead** on the data hooks and the auth flow.

## Out of scope

- Custom user profile pages. Auth is for tracking solves, not building a social platform.
- Community challenge submissions. That was a stretch goal and it's been dropped.
- Animated challenges. Single frame, time uniform defaults to 0.

## Start here

If you don't know where to start, do this in order:

1. Set up the Supabase project and the `challenges` table only. Don't worry about auth or RLS yet, just get a database running.
2. Write the first beginner challenge, `solid-color`. Get it as a `.glsl`, `.json`, and `.md`. Don't worry about tolerance yet, set it to a placeholder.
3. Wait for the Judge & Rendering Lead to publish the first version of the test harness.
4. Use the harness to calibrate `solid-color`'s tolerance. This will teach you the workflow.
5. Then knock out the rest of the beginner challenges, then intermediate, then advanced.
6. Set up auth, RLS, hooks, seed script, Vercel deployment.

The challenges are the gating deliverable. The backend can be built in parallel once the schema is up.
