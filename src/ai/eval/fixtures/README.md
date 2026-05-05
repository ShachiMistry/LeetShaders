# Eval Fixtures

Fixture layout, matching AI_SYSTEMS.md task 2:

```
fixtures/
  challenges/
    <challengeId>.glsl       reference shader source
    <challengeId>.json       challenge metadata (see shape below)
    <challengeId>.png        reference render (optional; placeholder used when absent)
  correct/
    <challengeId>-<label>.glsl     [.png optional]
  almost-correct/
    <challengeId>-<label>.glsl
  wrong/
    <challengeId>-<label>.glsl
  adversarial/
    <challengeId>-<label>.glsl
```

Fixture filename parses as `<challengeId>-<label>.glsl` where `<challengeId>`
must match a file in `challenges/`. Everything after that, before `.glsl`, is
a freeform label for identification in the report.

## Challenge metadata shape

```json
{
  "id": "challenge-001",
  "title": "Solid Magenta",
  "description": "Render a solid magenta color across the entire quad.",
  "difficulty": "beginner",
  "tolerance": 0.02,
  "useBlur": false
}
```

## Render PNGs

Today this folder ships without PNG renders; `run.ts` supplies a 1x1 magenta
placeholder for both user and reference when no `.png` sibling exists. The
visual-similarity axis of the judge prompt is therefore stubbed to "identical"
until real PNGs are captured via judge's pipeline.

Capture workflow, once judge's `src/judge/pipeline.ts` is in main:

1. Open the manual harness at `src/judge/test/manual.html`.
2. Paste each fixture's shader, screenshot the 512x512 render, save as
   `<fixture-path>.png` next to the `.glsl`.
3. Commit. The eval harness picks them up automatically on next run.

See `../CALIBRATION.md` for calibration methodology.
