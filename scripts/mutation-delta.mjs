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

function generateBaseline(metrics, baselineFile) {
  const baseline = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'Stryker reports/mutation/mutation.json',
    score: Math.round(metrics.score * 10) / 10,
    coveredScore: Math.round(metrics.coveredScore * 10) / 10,
    mutants: metrics.total,
    detected: metrics.detected,
  };
  fs.mkdirSync(fileURLToPath(new URL('../mutation/', import.meta.url)), { recursive: true });
  fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`Recorded mutation baseline -> ${baselineFile}`);
  return baseline;
}

function compareToBaseline(metrics, baseline) {
  const { failed, armed, current, floor } = evaluateMutationDelta(metrics, baseline, parseDelta());
  console.log('');
  console.log('='.repeat(72));
  console.log(`Mutation compare: score ${current.toFixed(1)}%, covered ${metrics.coveredScore.toFixed(1)}%`);
  console.log('='.repeat(72));
  console.log(
    `  detected ${metrics.detected} / ${metrics.valid} valid mutants (${metrics.survived} survived, ${metrics.noCoverage} uncovered)`,
  );
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
  const metrics = computeMutationMetrics(loadReport(reportFile));
  if (process.argv.includes('--generate')) {
    generateBaseline(metrics, baselineFile);
    return;
  }
  const baseline = loadBaseline(baselineFile);
  if (!baseline || typeof baseline.score !== 'number') {
    generateBaseline(metrics, baselineFile);
    console.log('No committed baseline existed; recorded this run as the reference (gate armed next run).');
    return;
  }
  if (compareToBaseline(metrics, baseline)) {
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
