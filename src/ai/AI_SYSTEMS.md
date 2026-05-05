# Role: AI Systems & Integration

You own the AI layer end to end and fill integration gaps. The LLM judge prompt, the calibration harness, the hint system, and the score combination logic all live with you. You're also the floater for integration seams that don't have a clear owner.

Read `CLAUDE.md` first for shared context. This file describes your specific tasks.

## Why this role

You've built agent systems before and you're comfortable with iterative prompt design and eval harnesses. The LLM judge is the highest-leverage piece of the project, it's what makes the judge robust to GPU variance and adversarial inputs. Getting this right is the difference between a project that works and one that demos but falls apart under scrutiny.

## Tasks

### 1. LLM judge prompt

Create `src/ai/judgePrompt.ts`. Uses Claude Opus 4.7 (model string `claude-opus-4-7`) for the vision call.

Inputs to the prompt:
- User's rendered output as a PNG-encoded image.
- Reference rendered output as a PNG-encoded image.
- User's shader source as text.
- Challenge description and difficulty.

Output, structured JSON:

```json
{
  "visualMatchScore": 87,
  "codeQualityNote": "Shader uses a clean SDF approach...",
  "passReasoning": "Output closely matches the reference, minor edge softness differences...",
  "flagged": false,
  "flagReason": null
}
```

The prompt's job:

- Score visual similarity between user output and reference, 0-100.
- Inspect the shader source. Flag if the shader is cheating, e.g. sampling a hardcoded texture of the reference, returning a pre-baked color array, or otherwise not actually computing the image. Flagging forces a fail regardless of visual score.
- Give a brief reasoning sentence the UI can show.

Prompt design notes:

- Be explicit about what "cheating" means. Examples in the prompt help.
- Tell the model the user is learning, so feedback should be diagnostic not just judgmental.
- Force JSON output via a clear schema in the prompt and a JSON-mode flag if the API supports it.
- Don't try to one-shot this. Iterate against the eval harness (next task).

### 2. Calibration eval harness

Create `src/ai/eval/`. This is what proves the prompt works.

A folder of fixtures:

```
src/ai/eval/fixtures/
  correct/
    challenge-001-pass.glsl
    challenge-001-pass-2.glsl
    challenge-002-pass.glsl
    ...
  almost-correct/
    challenge-001-close.glsl     // small numeric tweak
    challenge-002-close.glsl     // slightly off color
    ...
  wrong/
    challenge-001-wrong.glsl     // clearly different output
    ...
  adversarial/
    challenge-001-cheat.glsl     // texture lookup of reference
    challenge-001-flat.glsl      // returns hardcoded average color
    ...
```

Aim for 20+ fixture pairs covering at least 4 challenges across the difficulty range.

A runner script `src/ai/eval/run.ts`:
- Renders each fixture against its challenge's reference using Judge & Rendering Lead's pipeline.
- Calls the LLM judge.
- Compares the result to the expected verdict (pass/fail/flag).
- Outputs a markdown report with confusion matrix, false-pass rate, false-fail rate, average latency, total API cost.

**Tune the prompt iteratively against this harness.** Target: false-pass rate < 10%, false-fail rate < 10%. Document the calibration process in `src/ai/eval/CALIBRATION.md` so reviewers can see your methodology. This is the artifact that proves the judge works.

### 3. Combiner band logic

Pair with Judge & Rendering Lead on `src/judge/combiner.ts`. They own the plumbing, you own the band logic.

The decision tree:

```
mae_score = stage_one(user, reference)

if mae_score >= upper_band:        // confidently pass, e.g. >= 92
  return pass without LLM call
if mae_score < lower_band:          // confidently fail, e.g. < 40
  return fail without LLM call
                                    // borderline, invoke LLM
llm_result = stage_two(user, reference, source)
if llm_result.flagged:
  return fail (cheating)
final_score = weighted_combine(mae_score, llm_result.visualMatchScore)
return pass if final_score >= 80 else fail
```

Tune `upper_band`, `lower_band`, and the combination weight against the eval harness. Document the chosen values in code comments with the empirical evidence behind them.

Cache LLM results by `(challenge_id, sha256(shader_source))`. Same shader submitted twice should hit cache, not the API. Use Supabase or in-memory cache, your call. Coordinate with Content & Backend if you want a `judge_cache` table.

### 4. Hint system

Create `src/ai/hintPrompt.ts`. Uses Claude Sonnet 4.6 (model string `claude-sonnet-4-6`), cheaper and faster than Opus.

Inputs:
- User's current shader source.
- Reference shader source (this is okay because hints don't need to be cheat-resistant, the judge handles cheating).
- Challenge description.
- Both rendered outputs as images.

Output: a single hint paragraph that nudges without revealing.

The "nudge without revealing" constraint is the whole game. Some patterns that work:

- Point at concepts, not solutions. "Have you considered using `smoothstep` for soft edges?" rather than "Replace `step` with `smoothstep` on line 12."
- Diagnose the visual delta. "Your output is more saturated than the reference, the issue is likely in your color mixing step."
- Ask leading questions. "What happens to the UV coordinates when you take the absolute value?"

Build a small eval harness for hints too. Show it 5-10 user-shader-plus-reference pairs and check whether the hint actually helps without giving the answer. This is more subjective than the judge eval, but you can spot-check.

Rate-limit per user (3 hints per challenge per hour, soft-cap). Cache by `(challenge_id, sha256(shader_source))` aggressively, identical shaders get identical hints.

### 5. Integration glue

The seams between modules will break. Own them.

- The `useChallenge(id)` hook lives in Content & Backend's territory but uses the judge's `Challenge` type. When the type changes, you make sure both sides stay aligned.
- The submit flow goes editor → combiner → backend. When a stage fails (LLM API down, Supabase unreachable), the user sees a clear error not a hung UI. Implement those error states.
- The challenge-list-to-challenge-page navigation passes data through Zustand. Define the store shape and keep it minimal.

Floater duties translate to: when something doesn't have a clear owner and is blocking the team, you pick it up. Don't wait to be assigned.

### 6. Cost and latency monitoring

Add lightweight telemetry: every LLM call logs `(model, input_tokens, output_tokens, latency_ms, cache_hit)` to Supabase. This is for the team's visibility into API spend and is genuinely useful at demo time when someone asks "what does this cost to run?"

Keep the schema simple, one table. Don't overbuild.

## Working with Claude Code

- **Prompt design is iterative, treat it like research.** This is the same playbook you ran for The Echo Chamber Effect. Build the eval harness first, then iterate the prompt against it. Don't try to write the perfect prompt up front.
- **Use opus 4.7 for the judge specifically.** Vision quality and reasoning matter more than cost here, and the call frequency is low (only borderline submissions).
- **Use sonnet 4.6 for hints.** Lower latency, lower cost, hints are more forgiving of small quality drops.
- **Don't let Claude Code guess model strings.** It will suggest older names from training data. Override with the strings above.
- **Prompt caching.** Anthropic supports prompt caching. If your judge prompt has a long system message, mark it cacheable to save cost. Worth checking the docs once you have a working prompt.
- **JSON mode.** Use structured output enforcement so you don't have to parse free-form text. Check the current Anthropic docs for the right pattern.

## What success looks like for your role

- The eval harness shows < 10% false-pass and < 10% false-fail rates on at least 20 fixtures.
- `CALIBRATION.md` documents the prompt iterations and final chosen prompt with evidence.
- Combiner band thresholds are tuned with empirical justification.
- Hint system produces hints that real users (your teammates, in testing) say are helpful without spoiling.
- LLM API spend stays under a target you set (suggestion: $5 for the entire eval run, $20 for the demo session).
- When the LLM API is down, the app degrades gracefully, MAE-only judging with a banner explaining.

## Coordinate with

- **Judge & Rendering Lead** on the `LLMJudgeFn` contract and the combiner. Pair on `combiner.ts`.
- **Editor & UI Lead** on submit flow loading states and error rendering when the LLM call fails.
- **Content & Backend** on the cache table schema and the telemetry table.

## Out of scope

- Fine-tuning or custom models. Use the API as is.
- Streaming responses for the judge, the result is JSON, batch is fine.
- Multimodal beyond image plus text. No audio, no video.
