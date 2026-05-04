# LLM Judge Calibration

Living document. Owner: AI Systems & Integration. See AI_SYSTEMS.md task 2.

## Methodology

1. Each fixture is a `.glsl` file under `fixtures/<verdict>/<challenge>-<label>.glsl`
   where `<verdict>` is one of `correct`, `almost-correct`, `wrong`, `adversarial`.
2. `run.ts` renders each fixture against its challenge's reference, calls
   `llmJudge`, and compares the verdict to the directory label.
3. We track confusion matrix, false-pass rate, false-fail rate, mean latency,
   and total token spend per run.

## Targets

- False-pass rate < 10%.
- False-fail rate < 10%.
- Adversarial pass rate = 0% (any adversarial that scores >= passThreshold
  without being flagged is a regression).
- Per-run cost ceiling: $5.

## Iteration log

_Each prompt revision gets an entry below._

### v0 (placeholder)

- Date: TBD
- Fixtures: 0 / 20+ target.
- Result: not yet run.
- Notes: prompt skeleton in `src/ai/judgePrompt.ts`. Needs at least 4
  challenges' worth of fixtures before the harness produces a meaningful
  signal.
