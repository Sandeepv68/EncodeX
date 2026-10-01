/**
 * @fileoverview Runs the e2e suite repeatedly and fails on intermittent failures.
 *
 * Usage: `npm run test:flake-detect [-- --runs 3 --config e2e/vitest.e2e.config.ts]`
 *
 * Three design points that are load-bearing:
 *
 * 1. `--retry=0` is mandatory. `e2e/vitest.e2e.config.ts` sets `retry: 2` in CI,
 *    which is right for a normal run (one retry absorbs a slow boot) and exactly
 *    wrong here: it converts a one-in-three failure into a green result. The
 *    detector needs the raw per-attempt outcome.
 * 2. A non-zero exit from an individual run is *expected*, not an error. A flaky
 *    test may fail in run 1 and pass in runs 2 and 3; the verdict is only known
 *    after all runs are read. So the spawn failure is captured, not thrown.
 * 3. The suite is launched through `node_modules/vitest/vitest.mjs` with the
 *    current Node binary, because `execFileSync('npx', ...)` cannot execute
 *    `npx.cmd` without a shell and fails instantly on Windows.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeRuns, toRunResult } from './flake-report.mjs';

const VITEST_BIN = 'node_modules/vitest/vitest.mjs';
const REPORT_DIR = 'reports/flake';
const SUMMARY_FILE = 'reports/flake.json';
const QUARANTINE_FILE = 'e2e/quarantine.json';
const MAX_QUARANTINE_DAYS = 21;

/**
 * Reads `--flag value` pairs from argv.
 * @param {string[]} argv - Arguments after the script name.
 * @param {string} flag - Flag to look for.
 * @param {string} fallback - Value when the flag is absent.
 * @returns {string} The resolved value.
 */
function argOf(argv, flag, fallback) {
  const index = argv.indexOf(flag);
  if (index === -1 || index === argv.length - 1) return fallback;
  return argv[index + 1];
}

const argv = process.argv.slice(2);
const runs = Number(argOf(argv, '--runs', '3'));
const config = argOf(argv, '--config', 'e2e/vitest.e2e.config.ts');

if (!Number.isInteger(runs) || runs < 2) {
  console.error(`--runs must be an integer >= 2 (got ${argOf(argv, '--runs', '3')}).`);
  process.exit(2);
}

fs.mkdirSync(REPORT_DIR, { recursive: true });

/**
 * Reads a JSON file, tolerating a UTF-8 BOM.
 *
 * `e2e/quarantine.json` is hand-edited, and plenty of Windows tooling -
 * PowerShell's `Set-Content -Encoding utf8`, Excel, some editors - writes a BOM.
 * `JSON.parse` rejects one outright, so without this a maintainer editing the
 * quarantine file in a normal tool would turn the flake gate into a crash rather
 * than a decision.
 *
 * @param {string} file - Path to read.
 * @returns {any} The parsed value.
 */
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

/**
 * Normalizes a Vitest-reported absolute path to a repo-relative POSIX path.
 * @param {string} absolutePath - Path as recorded in the report.
 * @returns {string} Repo-relative path, stable across machines.
 */
function toPosixRelative(absolutePath) {
  return path.relative(process.cwd(), absolutePath).split(path.sep).join('/');
}

const results = [];
for (let index = 1; index <= runs; index += 1) {
  const outputFile = path.join(REPORT_DIR, `run-${index}.json`);
  console.log(`\n=== flake-detect run ${index}/${runs} ===`);
  let exitCode = 0;
  try {
    execFileSync(
      process.execPath,
      [
        VITEST_BIN,
        'run',
        '--config',
        config,
        '--reporter=json',
        `--outputFile=${outputFile}`,
        // See design point 1 above.
        '--retry=0',
        '--silent',
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
  } catch (error) {
    exitCode = error.status ?? 1;
    // See design point 2 above: expected for a flaky spec, judged at the end.
    console.log(`run ${index} exited ${exitCode} (recorded, not fatal)`);
  }
  if (!fs.existsSync(outputFile)) {
    console.error(`\nRun ${index} produced no report at ${outputFile}.`);
    process.exit(1);
  }
  const report = readJson(outputFile);
  results.push(toRunResult(report, `run-${index}`, toPosixRelative));
}

/** @type {import('./flake-report.mjs').QuarantineEntry[]} */
let quarantine = [];
if (fs.existsSync(QUARANTINE_FILE)) {
  const parsed = readJson(QUARANTINE_FILE);
  quarantine = Array.isArray(parsed) ? parsed : (parsed.entries ?? []);
  if (!Array.isArray(quarantine)) {
    console.error(`${QUARANTINE_FILE} must be an array of entries, or an object with an "entries" array.`);
    process.exit(2);
  }
}

const verdict = analyzeRuns(results, {
  quarantine,
  now: Date.now(),
  maxQuarantineDays: MAX_QUARANTINE_DAYS,
});

fs.mkdirSync(path.dirname(SUMMARY_FILE), { recursive: true });
fs.writeFileSync(SUMMARY_FILE, `${JSON.stringify(verdict, null, 2)}\n`);

const observed = verdict.specs.length;
console.log(`\n${observed} test(s) across ${results.length} run(s); summary written to ${SUMMARY_FILE}`);

const failed = verdict.alwaysFailed.length;
const flaky = verdict.flaky.length;
const quarantinedFlaky = verdict.flaky.filter((spec) => spec.quarantined).length;
console.log(`always failed: ${failed} | flaky: ${flaky} (${quarantinedFlaky} quarantined) | partial: ${verdict.partial.length}`);

if (verdict.ok) {
  console.log('\nNo intermittent failures across all runs.');
  process.exit(0);
}

console.error(`\n${verdict.problems.length} flake problem(s):\n`);
for (const problem of verdict.problems) console.error(`  ${problem}`);
console.error(
  '\nA flaky spec must be fixed, or quarantined in e2e/quarantine.json with an issue\n' +
    'and an expiresOn date. Quarantine entries lapse after ' +
    `${MAX_QUARANTINE_DAYS} days and then fail this gate.`,
);
process.exit(1);
