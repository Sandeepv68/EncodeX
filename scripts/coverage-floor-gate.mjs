import fs from 'node:fs';
import { mergeCoverage, assertMergeIsSane, misses, DEFAULT_LINE_FLOOR, DEFAULT_BRANCH_FLOOR } from './coverage-summary.mjs';

/**
 * @fileoverview Blocking per-file coverage ratchet.
 *
 * The fixed 80/70 per-file floor could not be switched on: dozens of files
 * have never been lifted to it, so a fixed floor fails every build and
 * enforces nothing. This gate enforces the same *property* - no file may lose
 * coverage - with a mechanism that can be adopted today.
 *
 * The rules:
 *
 *  1. A file recorded in the baseline may not fall below its recorded line or
 *     branch coverage (within {@link TOLERANCE} percentage points, which
 *     absorbs the float noise of a merged report).
 *  2. A file that is *not* in the baseline - a new source file - is held to the
 *     global floor (80% lines / 70% branches). New code starts at the bar;
 *     only old code gets a grandfathered number.
 *  3. The repository-wide average may not fall below the recorded average.
 *
 * Rule 2 is what makes the ratchet climb: every file added from now on has to
 * meet the floor, and rule 1 stops the existing files from sliding back while
 * they are being lifted.
 *
 * The baseline is committed and regenerated explicitly with
 * `npm run coverage:baseline`.
 *
 * Usage: `npm run test:coverage:floor`.
 */

const BASELINE_FILE = process.env.COVERAGE_BASELINE_FILE ?? 'coverage-baseline.json';
const dirs = (process.env.COVERAGE_DIRS ?? 'coverage,coverage-integration').split(',').map((d) => d.trim());

/** Percentage points of slack allowed when comparing against the baseline. */
const TOLERANCE = 0.5;

const lineFloor = Number(process.env.COVERAGE_LINE_FLOOR ?? DEFAULT_LINE_FLOOR);
const branchFloor = Number(process.env.COVERAGE_BRANCH_FLOOR ?? DEFAULT_BRANCH_FLOOR);

/**
 * Reads the committed baseline.
 *
 * @returns {object | null} The parsed baseline, or null when there is none.
 */
function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return null;
  return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
}

if (!fs.existsSync(BASELINE_FILE)) {
  console.error(
    `No coverage baseline at ${BASELINE_FILE}.\n` +
      'Record one with `npm run coverage:baseline` (after running both coverage tiers) and commit it.',
  );
  process.exit(1);
}

let merged;
try {
  merged = mergeCoverage(dirs);
  assertMergeIsSane(merged.entries, dirs);
} catch (error) {
  // A bad merge reports *high* coverage, so it would quietly disable the gate.
  console.error(`Coverage floor gate aborted: ${error.message}`);
  process.exit(1);
}

const baseline = loadBaseline();
const baselineFiles = baseline?.files ?? {};
const { entries, tiers, skipped } = merged;

if (skipped.length > 0) {
  console.warn(`No raw report in: ${skipped.join(', ')}. Only the measured tiers are gated.`);
}
console.log(`Tiers merged: ${tiers.join(', ')}\n`);

const failures = [];
const regressions = [];
const grandfathered = [];

for (const entry of entries) {
  const recorded = baselineFiles[entry.file];

  if (!recorded) {
    // A file the baseline has never seen: it is new code, and new code is
    // held to the global floor.
    const verdict = misses(entry, lineFloor, branchFloor);
    if (verdict.lines || verdict.branches) {
      const lines = Math.min(entry.lines, entry.statements);
      failures.push({
        file: entry.file,
        reason: verdict.lines
          ? `new file below the ${lineFloor}% line floor (${lines.toFixed(1)}%)`
          : `new file below the ${branchFloor}% branch floor (${entry.branches.toFixed(1)}%)`,
      });
    }
    continue;
  }

  const lineFloorForFile = recorded.lines - TOLERANCE;
  const branchFloorForFile = recorded.branches - TOLERANCE;
  const lines = Math.min(entry.lines, entry.statements);

  if (lines < lineFloorForFile) {
    failures.push({
      file: entry.file,
      reason: `lines ${lines.toFixed(1)}% fell below the recorded ${recorded.lines.toFixed(1)}%`,
    });
  } else if (entry.branches < branchFloorForFile) {
    failures.push({
      file: entry.file,
      reason: `branches ${entry.branches.toFixed(1)}% fell below the recorded ${recorded.branches.toFixed(1)}%`,
    });
  }

  if (lines < lineFloor || entry.branches < branchFloor) {
    grandfathered.push({ file: entry.file, lines, branches: entry.branches });
  }
}

// Files the baseline records that are no longer measured were deleted. That is
// legitimate, but the baseline then carries an entry for a file that does not
// exist, so it is worth naming.
const measured = new Set(entries.map((entry) => entry.file));
const stale = Object.keys(baselineFiles).filter((file) => !measured.has(file));

const avgLines = entries.reduce((sum, e) => sum + e.lines, 0) / entries.length;
const avgBranches = entries.reduce((sum, e) => sum + e.branches, 0) / entries.length;
const recordedTotal = baseline?.total;
if (recordedTotal) {
  if (avgLines < recordedTotal.lines - TOLERANCE) {
    failures.push({
      file: '(repository total)',
      reason: `average line coverage ${avgLines.toFixed(1)}% fell below the recorded ${recordedTotal.lines.toFixed(1)}%`,
    });
  }
  if (avgBranches < recordedTotal.branches - TOLERANCE) {
    failures.push({
      file: '(repository total)',
      reason: `average branch coverage ${avgBranches.toFixed(1)}% fell below the recorded ${recordedTotal.branches.toFixed(1)}%`,
    });
  }
}

console.log(`Measured ${entries.length} file(s).`);
console.log(`Average: lines ${avgLines.toFixed(1)}%, branches ${avgBranches.toFixed(1)}%.`);
console.log(`New files held to the floor: lines >= ${lineFloor}%, branches >= ${branchFloor}%.`);
console.log(`Grandfathered files below the floor: ${grandfathered.length}.\n`);

if (grandfathered.length > 0) {
  console.log('Below the global floor but grandfathered by the baseline (lift them with tests):');
  for (const item of grandfathered.sort((a, b) => a.lines - b.lines)) {
    console.log(`  ${item.file.padEnd(70)} lines ${item.lines.toFixed(1)}%  branches ${item.branches.toFixed(1)}%`);
  }
  console.log('');
}

if (stale.length > 0) {
  console.log(`Baseline entries for ${stale.length} file(s) that no longer exist (deleted?).`);
  console.log('Regenerate the baseline with `npm run coverage:baseline` to drop them.\n');
}

if (failures.length > 0) {
  console.error(`${failures.length} coverage regression(s):\n`);
  for (const failure of failures) {
    console.error(`  ${failure.file}\n    ${failure.reason}`);
  }
  console.error(
    '\nAdd tests for the uncovered code, or - if the change is deliberate - raise the\n' +
      'recorded number with `npm run coverage:baseline` and explain it in the review.',
  );
  process.exit(1);
}

console.log('No coverage regression against the baseline.');
process.exit(0);
