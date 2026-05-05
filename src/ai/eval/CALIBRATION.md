# LLM Judge Calibration

Living document. Owner: AI Systems & Integration. See `src/ai/AI_SYSTEMS.md` task 2.

## Methodology

1. Each fixture is a `.glsl` file under `fixtures/<verdict>/<challengeId>-<label>.glsl`
   where `<verdict>` is one of `correct`, `almost-correct`, `wrong`, `adversarial`.
   An optional `<challengeId>-<label>.png` sibling provides a captured render;
   when absent, `run.ts` substitutes a 1x1 magenta placeholder and flags the
   run so the report can tell you how many fixtures are PNG-complete.
2. Each challenge has a reference triple under `fixtures/challenges/`:
   `<challengeId>.glsl` (reference shader), `<challengeId>.json` (metadata),
   and optionally `<challengeId>.png` (captured reference render).
3. `run.ts` iterates every fixture, calls `callJudge` with the challenge
   description, reference render, user render, and user shader source,
   and records the response against the directory's expected verdict.
4. Expected verdict per directory:
   - `correct` -> `observedPass=true`, `flagged=false`
   - `almost-correct` -> `observedPass=true`, `flagged=false` (intentionally
     marginal; flipping this to `shouldPass=false` once the prompt tightens
     is a calibration decision)
   - `wrong` -> `observedPass=false`, `flagged=false`
   - `adversarial` -> `observedPass=false`, `flagged=true`
5. A fixture counts as a "correct verdict" only when both the pass decision
   AND the flag match expectations.

## Running the harness

```bash
# Discover fixtures, no API calls:
npx tsx src/ai/eval/run.ts

# Full run; writes src/ai/eval/REPORT.md and prints a summary:
ANTHROPIC_API_KEY=sk-ant-... npx tsx src/ai/eval/run.ts --live
```

Dry-run is the default to keep accidental invocations from costing money.

## Targets

- False-pass rate < 10%.
- False-fail rate < 10%.
- Adversarial leaks = 0 (every adversarial fixture must be flagged).
- Per-run cost ceiling: $5 while calibrating, $20 for the final demo run.

## Prompt iteration playbook

1. **Read the latest `REPORT.md`.** Look for the failure modes with the
   highest count, not the most interesting one.
2. **Reproduce the failure in isolation.** Copy the fixture's shader + the
   challenge description into an ad-hoc Anthropic playground chat. Verify
   the failure is reproducible before changing the prompt.
3. **Make one prompt change at a time.** Multi-change revisions make it
   impossible to attribute the improvement.
4. **Re-run the harness.** If the target metric moves in the right direction
   without regressing the others by more than 5 percentage points, keep
   the change. Otherwise revert.
5. **Log the revision below.** Date, fixtures count, scores, notes.

## Known limitations of the current setup

- **Placeholder PNGs.** Until judge's pipeline lands in `main`, the user
  and reference images passed to the judge are the same 1x1 magenta PNG
  for every fixture. The visual-similarity axis is effectively stubbed
  at "identical", so current calibration primarily exercises the
  source-inspection and cheating-detection paths.
- **One challenge.** Fixtures currently cover only `challenge-001`. We
  need at least 4 challenges across the difficulty range before
  confusion-matrix numbers are meaningful; see
  `src/backend/CONTENT_BACKEND.md` for the challenge authoring pipeline.
- **`almost-correct` expected to pass.** This is conservative. Once the
  prompt is well-calibrated we may want some of these to legitimately
  fail; the expected-outcome table in `run.ts` is the single point of
  change.

## Iteration log

_Each prompt revision gets an entry below._

### v0 (scaffolding)

- Date: 2026-05-04
- Fixtures: 4 / 20+ target (1 per verdict, 1 challenge).
- Result: not yet run against live API.
- Prompt: see `JUDGE_SYSTEM_PROMPT` in `src/ai/eval/judgeCall.ts`.
- Notes: harness exercises the full pipeline (discovery, verdict expectation,
  report emission) but cannot produce meaningful visual-similarity scores
  until fixture PNGs are captured. The adversarial fixture is the most
  useful signal at this stage; it should be flagged even with a placeholder
  image because the source contains an obvious `texture(uRef, vUv)` lookup.
