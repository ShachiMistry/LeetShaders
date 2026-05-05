// Calibration eval harness entry point. See AI_SYSTEMS.md task 2.
//
// Usage:
//   npx tsx src/ai/eval/run.ts              # dry run, reports fixture counts
//   npx tsx src/ai/eval/run.ts --live       # actually call the judge API
//
// The dry run is the default so casual invocations don't burn credits.
//
// Output: console summary + src/ai/eval/REPORT.md (live runs only).

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callJudge, type JudgeResponse } from './judgeCall';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, 'fixtures');
const REPORT_PATH = join(HERE, 'REPORT.md');

// Pass threshold used by the combiner's band logic. Keep this in sync
// with DEFAULT_BANDS.passThreshold in src/ai/bandLogic.ts.
const PASS_THRESHOLD = 80;

// 1x1 magenta PNG. Placeholder for missing `.png` siblings. See
// fixtures/README.md for the capture workflow that replaces this.
const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

type Verdict = 'correct' | 'almost-correct' | 'wrong' | 'adversarial';
const VERDICTS: readonly Verdict[] = [
  'correct',
  'almost-correct',
  'wrong',
  'adversarial',
] as const;

interface ChallengeMeta {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tolerance: number;
  useBlur: boolean;
}

interface Fixture {
  verdict: Verdict;
  challengeId: string;
  label: string;
  sourcePath: string;
  pngPath: string | null;
}

interface ExpectedOutcome {
  /** True if this fixture is expected to pass the judge. */
  shouldPass: boolean;
  /** True if the judge is expected to flag as cheating. */
  shouldFlag: boolean;
}

function expectedOutcome(v: Verdict): ExpectedOutcome {
  switch (v) {
    case 'correct':
      return { shouldPass: true, shouldFlag: false };
    case 'almost-correct':
      // Borderline - prompt calibration decides. For the report we treat
      // "pass" as expected so any fail here counts toward false-fail rate.
      return { shouldPass: true, shouldFlag: false };
    case 'wrong':
      return { shouldPass: false, shouldFlag: false };
    case 'adversarial':
      return { shouldPass: false, shouldFlag: true };
  }
}

async function loadChallenges(): Promise<Map<string, ChallengeMeta & { referenceShaderSrc: string; referencePngBase64: string }>> {
  const dir = join(FIXTURES_DIR, 'challenges');
  const entries = await readdir(dir);
  const map = new Map<string, ChallengeMeta & { referenceShaderSrc: string; referencePngBase64: string }>();

  const metaFiles = entries.filter((f) => f.endsWith('.json'));
  for (const metaFile of metaFiles) {
    const metaPath = join(dir, metaFile);
    const raw = await readFile(metaPath, 'utf8');
    const meta = JSON.parse(raw) as ChallengeMeta;
    const glslPath = join(dir, `${meta.id}.glsl`);
    const pngPath = join(dir, `${meta.id}.png`);

    const referenceShaderSrc = await readFile(glslPath, 'utf8');
    const referencePngBase64 = await tryReadPngBase64(pngPath);
    map.set(meta.id, {
      ...meta,
      referenceShaderSrc,
      referencePngBase64: referencePngBase64 ?? PLACEHOLDER_PNG_BASE64,
    });
  }
  return map;
}

async function tryReadPngBase64(path: string): Promise<string | null> {
  try {
    const buf = await readFile(path);
    return buf.toString('base64');
  } catch {
    return null;
  }
}

async function discoverFixtures(
  knownChallengeIds: Set<string>,
): Promise<Fixture[]> {
  const out: Fixture[] = [];
  for (const verdict of VERDICTS) {
    const verdictDir = join(FIXTURES_DIR, verdict);
    let entries: string[];
    try {
      entries = await readdir(verdictDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.glsl')) continue;
      const stem = basename(entry, '.glsl');
      const challengeId = findChallengeId(stem, knownChallengeIds);
      if (!challengeId) {
        console.warn(
          `[eval] skipping ${verdict}/${entry}: no matching challenge id prefix`,
        );
        continue;
      }
      const label = stem.slice(challengeId.length + 1);
      const sourcePath = join(verdictDir, entry);
      const pngCandidate = join(verdictDir, `${stem}.png`);
      const pngPath = (await tryReadPngBase64(pngCandidate)) ? pngCandidate : null;
      out.push({ verdict, challengeId, label: label || 'default', sourcePath, pngPath });
    }
  }
  return out;
}

function findChallengeId(stem: string, known: Set<string>): string | null {
  // Prefer the longest matching prefix so `challenge-001-extra` doesn't
  // collide with a hypothetical `challenge-001-extra` challenge id.
  const candidates = [...known]
    .filter((id) => stem === id || stem.startsWith(`${id}-`))
    .sort((a, b) => b.length - a.length);
  return candidates[0] ?? null;
}

interface FixtureRun {
  fixture: Fixture;
  expected: ExpectedOutcome;
  response: JudgeResponse;
  observedPass: boolean;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  usedPlaceholderPng: boolean;
}

async function runFixture(
  fixture: Fixture,
  challenges: Awaited<ReturnType<typeof loadChallenges>>,
): Promise<FixtureRun> {
  const challenge = challenges.get(fixture.challengeId);
  if (!challenge) {
    throw new Error(`no challenge metadata for id ${fixture.challengeId}`);
  }
  const userShaderSrc = await readFile(fixture.sourcePath, 'utf8');
  const userPngBase64 = fixture.pngPath
    ? (await tryReadPngBase64(fixture.pngPath)) ?? PLACEHOLDER_PNG_BASE64
    : PLACEHOLDER_PNG_BASE64;

  const { response, inputTokens, outputTokens, latencyMs } = await callJudge({
    challengeTitle: challenge.title,
    challengeDifficulty: challenge.difficulty,
    challengeDescription: challenge.description,
    referencePngBase64: challenge.referencePngBase64,
    userPngBase64,
    userShaderSrc,
  });

  const observedPass =
    !response.flagged && response.visualMatchScore >= PASS_THRESHOLD;

  return {
    fixture,
    expected: expectedOutcome(fixture.verdict),
    response,
    observedPass,
    inputTokens,
    outputTokens,
    latencyMs,
    usedPlaceholderPng: fixture.pngPath === null,
  };
}

interface Aggregate {
  total: number;
  correctVerdicts: number;
  falsePasses: number;
  falseFails: number;
  adversarialLeaks: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalLatencyMs: number;
  placeholderPngRuns: number;
}

function aggregate(runs: FixtureRun[]): Aggregate {
  const agg: Aggregate = {
    total: runs.length,
    correctVerdicts: 0,
    falsePasses: 0,
    falseFails: 0,
    adversarialLeaks: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalLatencyMs: 0,
    placeholderPngRuns: 0,
  };
  for (const run of runs) {
    agg.totalInputTokens += run.inputTokens;
    agg.totalOutputTokens += run.outputTokens;
    agg.totalLatencyMs += run.latencyMs;
    if (run.usedPlaceholderPng) agg.placeholderPngRuns += 1;

    const verdictMatch = run.observedPass === run.expected.shouldPass;
    const flagMatch = run.response.flagged === run.expected.shouldFlag;
    if (verdictMatch && flagMatch) agg.correctVerdicts += 1;
    if (run.observedPass && !run.expected.shouldPass) agg.falsePasses += 1;
    if (!run.observedPass && run.expected.shouldPass) agg.falseFails += 1;
    if (run.fixture.verdict === 'adversarial' && !run.response.flagged) {
      agg.adversarialLeaks += 1;
    }
  }
  return agg;
}

function rate(numerator: number, denominator: number): string {
  if (denominator === 0) return 'n/a';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function renderReport(
  runs: FixtureRun[],
  agg: Aggregate,
  startedAt: Date,
): string {
  const lines: string[] = [];
  lines.push('# LLM Judge Eval Report');
  lines.push('');
  lines.push(`Run started: ${startedAt.toISOString()}`);
  lines.push(`Fixtures: ${agg.total}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Correct verdicts: ${agg.correctVerdicts} / ${agg.total} (${rate(agg.correctVerdicts, agg.total)})`);
  lines.push(`- False-pass rate: ${rate(agg.falsePasses, agg.total)} (target < 10%)`);
  lines.push(`- False-fail rate: ${rate(agg.falseFails, agg.total)} (target < 10%)`);
  lines.push(`- Adversarial leaks: ${agg.adversarialLeaks} (target 0)`);
  lines.push(`- Total input tokens: ${agg.totalInputTokens}`);
  lines.push(`- Total output tokens: ${agg.totalOutputTokens}`);
  lines.push(`- Mean latency: ${agg.total ? (agg.totalLatencyMs / agg.total).toFixed(0) : '-'} ms`);
  lines.push(`- Runs using placeholder PNG: ${agg.placeholderPngRuns} / ${agg.total}`);
  lines.push('');
  lines.push('## Per-fixture detail');
  lines.push('');
  lines.push('| Verdict | Challenge | Label | Observed pass | Flagged | Score | Reasoning |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const run of runs) {
    const reasoning = run.response.passReasoning
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ')
      .slice(0, 120);
    lines.push(
      `| ${run.fixture.verdict} | ${run.fixture.challengeId} | ${run.fixture.label} | ${run.observedPass} | ${run.response.flagged} | ${run.response.visualMatchScore} | ${reasoning} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const live = process.argv.includes('--live');

  const challenges = await loadChallenges();
  if (challenges.size === 0) {
    console.log('No challenges in fixtures/challenges/. Nothing to evaluate.');
    return;
  }
  const knownIds = new Set(challenges.keys());
  const fixtures = await discoverFixtures(knownIds);

  console.log(`Challenges: ${challenges.size}`);
  console.log(`Fixtures discovered: ${fixtures.length}`);
  for (const v of VERDICTS) {
    const count = fixtures.filter((f) => f.verdict === v).length;
    console.log(`  ${v}: ${count}`);
  }
  const missingPng = fixtures.filter((f) => f.pngPath === null).length;
  if (missingPng > 0) {
    console.log(
      `Note: ${missingPng} fixtures are missing PNG siblings; placeholder will be used.`,
    );
  }

  if (!live) {
    console.log('');
    console.log('Dry run. Pass --live to call the Anthropic API.');
    return;
  }

  if (fixtures.length === 0) {
    console.log('No fixtures to run.');
    return;
  }

  const startedAt = new Date();
  const runs: FixtureRun[] = [];
  for (const fixture of fixtures) {
    process.stdout.write(
      `[${runs.length + 1}/${fixtures.length}] ${fixture.verdict}/${fixture.challengeId}-${fixture.label} ... `,
    );
    const run = await runFixture(fixture, challenges);
    runs.push(run);
    process.stdout.write(
      `score=${run.response.visualMatchScore} flagged=${run.response.flagged} pass=${run.observedPass}\n`,
    );
  }

  const agg = aggregate(runs);
  const report = renderReport(runs, agg, startedAt);
  await writeFile(REPORT_PATH, report, 'utf8');
  console.log('');
  console.log(`Report written to ${REPORT_PATH}`);
  console.log(
    `Correct ${agg.correctVerdicts}/${agg.total}, false-pass ${rate(agg.falsePasses, agg.total)}, false-fail ${rate(agg.falseFails, agg.total)}, adversarial leaks ${agg.adversarialLeaks}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
