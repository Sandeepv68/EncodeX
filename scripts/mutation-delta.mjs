/**
 * @fileoverview Mutation-resistance regression gate (Phase 9).
 *
 * Reads the Stryker report produced by `npm run test:mutate`
 * (`reports/mutation/mutation.json`), computes the standard
 * mutation-testing-metrics score, then compares it against the committed
 * baseline (`mutation/baseline.json`). Fails when the current score is more
 * than `MUTATION_DELTA` points below the baseline, so a PR cannot regress
 * mutation resistance while the weekly backlog-drain job keeps raising the
 * number. With `--generate`, writes a fresh baseline from the current report
 * (used to record the first one and to ratchet it up).
 *
 * "Advisory for 4 weeks, then blocks" per the plan: the CI job is wired
 * continue-on-error until the baseline has stabilized, then a single-line
 * change promotes it to blocking.
 */

import * as fs from 'fs';
import { fileURLToPath } from 'url';

const DEFAULT_DELTA = 2.0;

/**
 * Computes the standard mutation-testing-metrics aggregates from a parsed
 * Stryker report (mutation-testing-report-schema v1.0).
 * @param {object} report - Parsed report (`{ files: { [path]: { mutants } } }`).
 * @returns {object} Metric counts and percentage scores.
 */
export function computeMutationMetrics(report) {
  const mutants = Object.values(report?.files ?? {}).flatMap((f) => f.mutants ?? []);
  const count = (status) => mutants.filter((m) => m.status === status).length;
  const killed = count('Killed');
  const timedOut = count('Timeout');
  const runtimeErrors = count('RuntimeError');
  const survived = count('Survived');
  const noCoverage = count('NoCoverage');
  const ignored = count('Ignored');
  const compileErrors = count('CompileError');
  const totalDetected = killed + timedOut + runtimeErrors;
  const totalUndetected = survived + noCoverage;
  const totalValid = totalDetected + totalUndetected;
  const totalCovered = totalDetected + survived;
  const totalMutants = totalValid + ignored + compileErrors;
  const score = totalValid === 0 ? 100 : (totalDetected / totalValid) * 100;
  const coveredScore = totalCovered === 0 ? 100 : (totalDetected / totalCovered) * 100;
  return {
    detected: totalDetected,
    survived,
    noCoverage,
    ignored,
    compileErrors,
    total: totalMutants,
    valid: totalValid,
    covered: totalCovered,
    score,
    coveredScore,
  };
}

/**
 * Computes {@link computeMutationMetrics} per source file. A scoped CI run
 * (only the files a PR touched) is compared against per-file baselines rather
 * than the whole-project number, which a subset of files cannot be measured
 * against.
 * @param {object} report - Parsed report (`{ files: { [path]: { mutants } } }`).
 * @returns {Object<string, object>} Metrics keyed by repo-relative path.
 */
export function computeFileMetrics(report) {
  const result = {};
  for (const [file, data] of Object.entries(report?.files ?? {})) {
    result[file] = computeMutationMetrics({ files: { [file]: data } });
  }
  return result;
}

/**
 * Applies the delta rule: the current score may not fall more than `delta`
 * points below the baseline score. A missing baseline counts as "record
 * first, arm next run" and never fails.
 * @param {object} metrics - Result of {@link computeMutationMetrics}.
 * @param {object | null} baseline - Committed baseline, or null when none.
 * @param {number} delta - Maximum allowed drop in percentage points.
 * @returns {{ failed: boolean, armed: boolean, current: number, floor: number }}
 */
export function evaluateMutationDelta(metrics, baseline, delta) {
  const current = Math.round(metrics.score * 10) / 10;
  if (!baseline || typeof baseline.score !== 'number') {
    return { failed: false, armed: false, current, floor: current };
  }
  const floor = baseline.score - delta;
  return { failed: current < floor, armed: true, current, floor };
}

/**
 * Applies the delta rule per file: every file in the current report may not
 * fall more than `delta` points below its recorded per-file score. Files the
 * baseline has never seen are reported as `new` and never fail (they have no
 * floor yet); files absent from the report are not compared (they were not
 * mutated on this run).
 * @param {Object<string, object>} fileMetrics - Result of {@link computeFileMetrics}.
 * @param {Object<string, { score: number }> | undefined} baselineFiles - Per-file baseline entries.
 * @param {number} delta - Maximum allowed drop in percentage points.
 * @returns {{ failed: boolean, comparisons: Array<{ file: string, current: number, floor: number|null, status: string }> }}
 */
export function evaluateFileDeltas(fileMetrics, baselineFiles, delta) {
  const comparisons = [];
  let failed = false;
  for (const [file, metrics] of Object.entries(fileMetrics)) {
    const current = Math.round(metrics.score * 10) / 10;
    const base = baselineFiles?.[file];
    if (!base || typeof base.score !== 'number') {
      comparisons.push({ file, current, floor: null, status: 'new' });
      continue;
    }
    const floor = Math.round((base.score - delta) * 10) / 10;
    const fileFailed = current < floor;
    if (fileFailed) failed = true;
    comparisons.push({ file, current, floor, status: fileFailed ? 'fail' : 'pass' });
  }
  return { failed, comparisons };
}

export function parseDelta(raw = process.env.MUTATION_DELTA) {
  if (raw === undefined || raw === '') return DEFAULT_DELTA;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    console.error(`Invalid MUTATION_DELTA '${raw}'; expected a non-negative number.`);
    process.exit(2);
  }
  return value;
}

function loadReport(reportFile) {
  if (!fs.existsSync(reportFile)) {
    console.error(`No mutation report at ${reportFile}; run 'npm run test:mutate' first.`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(reportFile, 'utf8'));
}

function loadBaseline(baselineFile) {
  if (!fs.existsSync(baselineFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  } catch {
    return null;
  }
}

function generateBaseline(metrics, fileMetrics, baselineFile) {
  const files = {};
  for (const [file, entry] of Object.entries(fileMetrics)) {
    files[file] = {
      score: Math.round(entry.score * 10) / 10,
      coveredScore: Math.round(entry.coveredScore * 10) / 10,
      mutants: entry.total,
      detected: entry.detected,
    };
  }
  const baseline = {
    version: 2,
    updatedAt: new Date().toISOString(),
    source: 'Stryker reports/mutation/mutation.json',
    score: Math.round(metrics.score * 10) / 10,
    coveredScore: Math.round(metrics.coveredScore * 10) / 10,
    mutants: metrics.total,
    detected: metrics.detected,
    files,
  };
  fs.mkdirSync(fileURLToPath(new URL('../mutation/', import.meta.url)), { recursive: true });
  fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`Recorded mutation baseline -> ${baselineFile} (${Object.keys(files).length} file(s))`);
  return baseline;
}

function compareToBaseline(metrics, fileMetrics, baseline) {
  const delta = parseDelta();
  console.log('');
  console.log('='.repeat(72));
  console.log(`Mutation compare: score ${metrics.score.toFixed(1)}%, covered ${metrics.coveredScore.toFixed(1)}%`);
  console.log('='.repeat(72));
  console.log(
    `  detected ${metrics.detected} / ${metrics.valid} valid mutants (${metrics.survived} survived, ${metrics.noCoverage} uncovered)`,
  );

  if (baseline.files && typeof baseline.files === 'object') {
    const { failed, comparisons } = evaluateFileDeltas(fileMetrics, baseline.files, delta);
    const regressions = comparisons.filter((comparison) => comparison.status === 'fail');
    const fresh = comparisons.filter((comparison) => comparison.status === 'new');
    console.log(`  per-file compare over ${comparisons.length} file(s), delta ${delta} point(s)`);
    for (const comparison of regressions) {
      console.log(`    FAIL ${comparison.file}: ${comparison.current}% < floor ${comparison.floor}%`);
    }
    if (fresh.length > 0) console.log(`    ${fresh.length} file(s) not in the baseline yet (no floor)`);
    console.log('='.repeat(72));
    return failed;
  }

  // Legacy v1 baseline: a single whole-project score, only meaningful for a
  // full-scope run.
  const { failed, armed, current, floor } = evaluateMutationDelta(metrics, baseline, delta);
  if (armed) {
    console.log(`  baseline ${baseline.score.toFixed(1)}% -> floor ${floor.toFixed(1)}%`);
  } else {
    console.log('  no committed baseline: gate not armed yet');
  }
  console.log('='.repeat(72));
  return failed;
}

const main = () => {
  const reportFile = fileURLToPath(new URL('../reports/mutation/mutation.json', import.meta.url));
  const baselineFile = fileURLToPath(new URL('../mutation/baseline.json', import.meta.url));
  const report = loadReport(reportFile);
  const metrics = computeMutationMetrics(report);
  const fileMetrics = computeFileMetrics(report);
  if (process.argv.includes('--generate')) {
    generateBaseline(metrics, fileMetrics, baselineFile);
    return;
  }
  const baseline = loadBaseline(baselineFile);
  if (!baseline) {
    console.log('No committed baseline yet; nothing to compare (the weekly ratchet records it).');
    return;
  }
  if (compareToBaseline(metrics, fileMetrics, baseline)) {
    console.error('FAIL: mutation score dropped below the baseline floor.');
    process.exit(1);
  }
};

const isMain =
  import.meta.main ??
  (process.argv[1] !== undefined && new URL(process.argv[1], 'file://').pathname === fileURLToPath(import.meta.url).replace(/\\/g, '/'));

if (isMain) {
  main();
}
