import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { mergeCoverage, mergedLineSets, assertMergeIsSane, misses, DEFAULT_LINE_FLOOR, DEFAULT_BRANCH_FLOOR } from './coverage-summary.mjs';

/**
 * @fileoverview Blocking coverage gate for the files a pull request touched.
 *
 * A global coverage number says nothing about *this* change. A PR can leave the
 * total at 88% while adding 200 uncovered lines to one file, and the global
 * threshold stays green. This gate measures only the source files the branch
 * changed and fails if any of them miss the floor - which is the property a
 * ratchet actually needs.
 *
 * Design notes:
 *  - It reads `coverage/coverage-summary.json` produced by a coverage run
 *    scoped to the changed files, so the floor is enforced in JS with a real
 *    error message instead of via `--coverage.thresholds`, whose per-file CLI
 *    form is awkward and whose output does not name the offending file.
 *  - Exits 0 when the branch changes no source files, so it is safe to require
 *    unconditionally.
 *
 * Usage: `npm run test:coverage:diff [base-ref]`.
 */

const lineFloor = Number(process.env.COVERAGE_LINE_FLOOR ?? DEFAULT_LINE_FLOOR);
const branchFloor = Number(process.env.COVERAGE_BRANCH_FLOOR ?? DEFAULT_BRANCH_FLOOR);

const base = process.argv[2] ?? resolveDefaultBase();

/**
 * Guesses the branch point: the merge base with the upstream default branch.
 * @returns {string} A git ref to diff against.
 */
function resolveDefaultBase() {
  for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
    try {
      git(['rev-parse', '--verify', '--quiet', candidate]);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return 'HEAD';
}

/**
 * Paths that exist in `src` but are deliberately outside the coverage scope, so
 * no coverage number can ever be produced for them. Gating them would fail the
 * build for a file that can never pass. Mirrors `COVERAGE_EXCLUDE` in
 * vitest.coverage-scope.ts - keep the two in step.
 */
const UNCOVERABLE = [
  /^src\/test-utils\//,
  /^src\/renderer\/i18n\//,
  /^src\/test-setup(\.crash)?\.ts$/,
  /^src\/renderer\/main\.tsx$/,
  /\.styles\.ts$/,
];

/**
 * Runs a git command, discarding its stderr.
 *
 * With `core.autocrlf` set, git prints one "LF will be replaced by CRLF"
 * warning per touched file. Those are advisory, they go to stderr, and a
 * diff-coverage gate that lists 20 changed files would bury its own verdict
 * under them.
 *
 * @param {string[]} args - Arguments for git.
 * @returns {string} Trimmed stdout.
 * @throws {Error} Propagates git's failure so callers can fall back.
 */
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/**
 * Lists source files this branch added or modified, plus files it deleted.
 *
 * Renames come back as a delete plus an add from `git diff --name-status`, so
 * the added side is what gets measured and the deleted side is skipped.
 *
 * @param {string} ref - The ref to diff against.
 * @returns {{changed: string[], deleted: Set<string>}} Repo-relative POSIX paths.
 */
function changedSources(ref) {
  let out;
  try {
    out = git(['diff', '--name-only', '--diff-filter=ACMR', ref, '--', 'src']);
  } catch {
    out = git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--', 'src']);
  }
  let removed = '';
  try {
    removed = git(['diff', '--name-only', '--diff-filter=D', ref, '--', 'src']);
  } catch {
    // A deleted file is not measured; ignore the failure.
  }
  const changed = out
    .split('\n')
    .map((l) => l.trim().split('\\').join('/'))
    .filter(
      (l) =>
        l &&
        /\.(ts|tsx)$/.test(l) &&
        !/\.(test|spec)\.tsx?$/.test(l) &&
        !/\.d\.ts$/.test(l) &&
        !l.includes('__tests__') &&
        !UNCOVERABLE.some((pattern) => pattern.test(l)),
    );
  const deleted = new Set(
    removed
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );
  return { changed, deleted };
}

/**
 * Line numbers this branch *added* to a file, in the new file's numbering.
 *
 * Parsed from a zero-context diff: `@@ -old,len +new,len @@` followed by
 * `+` lines. Zero context means every `+` line is one the change introduced, so
 * no untouched line can be mistaken for new. A hunk with an empty `len` is a
 * pure insertion starting at `new`, which the `|| 1` default handles.
 *
 * @param {string} ref - The ref to diff against.
 * @param {string} file - Repo-relative POSIX path.
 * @returns {number[]} Sorted, de-duplicated new-file line numbers.
 */
function addedLines(ref, file) {
  let out = '';
  try {
    out = git(['diff', '-U0', '--no-color', '--diff-filter=ACMR', ref, '--', file]);
  } catch {
    return [];
  }
  const lines = new Set();
  let newStart = null;
  for (const row of out.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(row);
    if (hunk) {
      newStart = Number(hunk[1]);
      continue;
    }
    if (newStart === null) continue;
    if (row.startsWith('+')) {
      lines.add(newStart);
      newStart += 1;
    } else if (row.startsWith(' ')) {
      newStart += 1;
    }
  }
  return [...lines].sort((a, b) => a - b);
}

const { changed, deleted } = changedSources(base);

if (changed.length === 0) {
  console.log(`No source files changed against ${base} - nothing to gate.`);
  process.exit(0);
}

console.log(`Gating ${changed.length} changed source file(s) against ${base}`);
console.log(`Floor: lines >= ${lineFloor}%, branches >= ${branchFloor}%\n`);

// Scope the run to the changed files. `--coverage.include` replaces the config
// list, so untested files elsewhere in `src` are neither measured nor counted
// against the thresholds. One flag per file: vitest treats a repeated array
// option as a list but does NOT split a comma-joined value, so
// `--coverage.include=a.ts,b.ts` is a single glob that matches nothing - the
// report then contains zero files and every changed file reads as
// "not measured (no module loaded it)".
const includes = changed.map((file) => `--coverage.include=${file}`);
const reporters = ['--coverage.reporter=json', '--coverage.reporter=json-summary'];

// The config's global thresholds (85/75/80/85) describe the whole suite, not
// the handful of files being gated here. Scoping the run to a few files makes
// those global numbers meaningless, and leaving them on makes the run fail for
// a handful of changed files that the real per-file floor below is about to
// judge. Zero them so the only verdict is this gate's own.
const disableGlobalThresholds = [
  '--coverage.thresholds.statements=0',
  '--coverage.thresholds.branches=0',
  '--coverage.thresholds.functions=0',
  '--coverage.thresholds.lines=0',
];

// Run vitest through its own entry point with the current Node binary instead
// of shelling out to `npx`. `execFileSync` cannot execute `npx.cmd` without a
// shell, so the npx form fails outright on Windows, and `npx` adds a network
// lookup that CI does not need. This is the same binary, by path.
const VITEST_BIN = 'node_modules/vitest/vitest.mjs';

/**
 * Runs vitest with the given extra CLI arguments.
 * @param {string[]} args - Arguments after the binary path.
 * @returns {void}
 * @throws {Error} Propagates vitest's non-zero exit.
 */
function runVitest(args) {
  execFileSync(process.execPath, [VITEST_BIN, ...args], { stdio: 'inherit' });
}

try {
  runVitest(['run', '--coverage', '--silent', ...includes, ...reporters, ...disableGlobalThresholds]);
} catch (error) {
  // A test failure already failed the run; do not mask it with a coverage error.
  console.error('\nThe unit-tier coverage run failed (tests or collection error). See output above.');
  process.exit(error.status ?? 1);
}

// The unit tier deliberately skips `*.integration.test.ts`, which is where much
// of `src/main/cli` and `src/main/mcp` is actually driven. Gating on the unit
// tier alone would fail any PR that legitimately edits a file whose only tests
// are integration tests, so the integration tier is measured too and merged.
console.log('\nMeasuring the integration tier for the same files...');
try {
  runVitest([
    'run',
    '--coverage',
    '--config',
    'vitest.integration.config.ts',
    '--silent',
    ...includes,
    ...reporters,
    ...disableGlobalThresholds,
  ]);
} catch (error) {
  // Integration tests need real FFmpeg binaries and a `node` environment; if
  // they cannot run here, fall back to the unit tier rather than blocking on an
  // environment the gate does not own. The CI job installs the binaries.
  console.warn(`\nIntegration tier unavailable (exit ${error.status}); gating on the unit tier only.`);
}

const dirs = ['coverage', 'coverage-integration'];
let merged;
let lineSets;
try {
  merged = mergeCoverage(dirs);
  assertMergeIsSane(merged.entries, dirs);
  lineSets = mergedLineSets(dirs);
} catch (error) {
  console.error(`\nCannot enforce the floor: ${error.message}`);
  process.exit(1);
}
const measured = new Map(merged.entries.map((entry) => [entry.file, entry]));
const failures = [];

for (const file of changed) {
  if (deleted.has(file)) continue;
  const entry = measured.get(file);
  if (!entry) {
    // Not in the report at all means v8 never loaded it: nothing imports it in
    // the measured program. Not a coverage failure, but worth surfacing, because
    // for a source file it usually means the module is dead or newly added.
    failures.push({ file, reason: 'not measured (no module loaded it)' });
    continue;
  }
  const verdict = misses(entry, lineFloor, branchFloor);
  const lines = Math.min(entry.lines, entry.statements);
  if (verdict.lines) failures.push({ file, reason: `lines ${lines.toFixed(1)}% < ${lineFloor}%` });
  else if (verdict.branches) failures.push({ file, reason: `branches ${entry.branches.toFixed(1)}% < ${branchFloor}%` });
}

// Per-file floors alone let a small uncovered addition hide inside a
// well-covered file: adding eight untested lines to a 100%-covered file leaves
// it at ~86%, still above an 80% floor. So the gate also requires that the
// executable lines this diff *added* were actually run.
for (const file of changed) {
  if (deleted.has(file)) continue;
  const sets = lineSets.get(file);
  if (!sets) continue;
  const added = addedLines(base, file);
  // Only added lines that the provider recorded as a statement start can be
  // judged. Braces, blank lines, comments, and the interior of a multi-line
  // statement are not statements, so calling them uncovered would be a false
  // positive on ordinary formatting.
  const uncovered = added.filter((line) => sets.executable.has(line) && !sets.covered.has(line));
  if (uncovered.length > 0) {
    const shown = uncovered.slice(0, 10).join(', ');
    const more = uncovered.length > 10 ? ` (+${uncovered.length - 10} more)` : '';
    failures.push({ file, reason: `uncovered added line(s): ${shown}${more}` });
  }
}

if (failures.length === 0) {
  console.log(`\nAll ${changed.length} changed file(s) meet the floor.`);
  process.exit(0);
}

console.error(`\n${failures.length} coverage problem(s) in changed files:\n`);
for (const failure of failures) {
  console.error(`  ${failure.file}\n    ${failure.reason}`);
}
console.error(
  '\nAdd tests for the changed lines, or lower the floor with COVERAGE_LINE_FLOOR /\n' +
    'COVERAGE_BRANCH_FLOOR if the per-file floor is the deliberate exception.',
);
process.exit(1);
