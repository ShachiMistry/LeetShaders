// Calibration eval harness entry point. See AI_SYSTEMS.md task 2.
// Run via: npx tsx src/ai/eval/run.ts
//
// Walks src/ai/eval/fixtures/, runs each fixture through the judge, computes
// the confusion matrix vs expected verdicts, writes a markdown report.

async function main() {
  // TODO:
  // 1. Discover fixtures by directory: correct/, almost-correct/, wrong/, adversarial/.
  // 2. For each fixture, load its challenge metadata, render via the pipeline,
  //    call the LLM judge, compare vs expected verdict.
  // 3. Aggregate: confusion matrix, false-pass rate, false-fail rate, mean
  //    latency, total token spend. Target: < 10% false-pass and < 10% false-fail.
  // 4. Emit markdown report at src/ai/eval/REPORT.md.
  //
  // See CALIBRATION.md (to be authored) for prompt iteration methodology.
  console.log('eval harness not implemented yet - see AI_SYSTEMS.md task 2');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
