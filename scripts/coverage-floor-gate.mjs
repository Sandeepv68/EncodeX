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
 * ## Platform-aware comparison
 *
 * Branch coverage depends on the platform: a `process.platform === 'win32'`
 * branch is covered on Windows and not on Linux, so the same commit measures
 * differently on the two. The baseline therefore records one entry per
 * platform, and this gate compares a run against its own platform's entry. A
 * platform with no entry of its own falls back to the most conservative number
 * recorded for any platform, which still catches a real regression.
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
const platforms = baseline?.platforms ?? {};
const platformNames = Object.keys(platforms);

/**
 * The platform whose recorded numbers this run is compared against.
 *
 * `COVERAGE_PLATFORM` overrides the detection, which is what lets a run be
 * checked against another platform's entry - the CI job sets it explicitly
 * rather than relying on the runner's OS.
 */
const runPlatform = process.env.COVERAGE_PLATFORM ?? process.platform;

if (platformNames.length === 0) {
  console.error(`The coverage baseline at ${BASELINE_FILE} records no platform. Regenerate it.`);
  process.exit(1);
}

const { entries, tiers, skipped } = merged;

if (skipped.length > 0) {
  console.warn(`No raw report in: ${skipped.join(', ')}. Only the measured tiers are gated.`);
}
console.log(`Tiers merged: ${tiers.join(', ')}`);
console.log(`Platforms on record: ${platformNames.join(', ')}`);
console.log(`Comparing against the '${runPlatform}' entry.`);

/**
 * The recorded floor for a file on the platform this run happened on.
 *
 * The run's own platform is used when it has an entry; otherwise the most
 * conservative number recorded for any platform, which is the only safe
 * comparison for a platform the baseline has never seen.
 *
 * @param {string} file - Repo-relative source path.
 * @returns {{lines: number, branches: number} | null} The floor, or null when no platform recorded the file.
 */
function floorFor(file) {
  const own = platforms[runPlatform]?.files?.[file];
  if (own) return { lines: own.lines, branches: own.branches };

  let lines = Infinity;
  let branches = Infinity;
  let found = false;
  for (const name of platformNames) {
    const entry = platforms[name].files?.[file];
    if (!entry) continue;
    found = true;
    lines = Math.min(lines, entry.lines);
    branches = Math.min(branches, entry.branches);
  }
  return found ? { lines, branches } : null;
}

const failures = [];
const grandfathered = [];

for (const entry of entries) {
  const recorded = floorFor(entry.file);

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
const stale = new Set();
for (const name of platformNames) {
  for (const file of Object.keys(platforms[name].files ?? {})) {
    if (!measured.has(file)) stale.add(file);
  }
}

const avgLines = entries.reduce((sum, e) => sum + e.lines, 0) / entries.length;
const avgBranches = entries.reduce((sum, e) => sum + e.branches, 0) / entries.length;

let totalLines = Infinity;
let totalBranches = Infinity;
for (const name of platformNames) {
  const total = platforms[name].total;
  if (!total) continue;
  totalLines = Math.min(totalLines, total.lines);
  totalBranches = Math.min(totalBranches, total.branches);
}
if (totalLines !== Infinity && avgLines < totalLines - TOLERANCE) {
  failures.push({
    file: '(repository total)',
    reason: `average line coverage ${avgLines.toFixed(1)}% fell below the recorded ${totalLines.toFixed(1)}%`,
  });
}
if (totalBranches !== Infinity && avgBranches < totalBranches - TOLERANCE) {
  failures.push({
    file: '(repository total)',
    reason: `average branch coverage ${avgBranches.toFixed(1)}% fell below the recorded ${totalBranches.toFixed(1)}%`,
  });
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

if (stale.size > 0) {
  console.log(`Baseline entries for ${stale.size} file(s) that no longer exist (deleted?).`);
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
