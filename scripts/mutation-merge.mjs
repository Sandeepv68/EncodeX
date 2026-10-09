/**
 * @fileoverview Merges the per-shard Stryker JSON reports back into the single
 * `reports/mutation/mutation.json` that `scripts/mutation-delta.mjs` reads.
 *
 * Shards are disjoint by source file (`scripts/mutation-scope.mjs` assigns each
 * file to exactly one shard), so merging is a union of the `files` maps. A
 * duplicate path would only appear if the scope were misconfigured; the mutants
 * are concatenated rather than dropped so the report stays complete.
 *
 * The first report's non-`files` metadata (schema version, thresholds, ...) is
 * preserved. `--expect <n>` fails the merge when fewer than `n` shard reports
 * were found, which keeps an incomplete run from being recorded as a baseline.
 *
 * Usage: `node scripts/mutation-merge.mjs <dir-or-mutation.json> [...]`
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPORT_NAME = 'mutation.json';

/**
 * Absolute path of the merged report. Resolved lazily so importing this file
 * under a test runner that rewrites `import.meta.url` cannot throw.
 * @returns {string} Absolute output path.
 */
function outputFile() {
  return fileURLToPath(new URL('../reports/mutation/mutation.json', import.meta.url));
}

/**
 * Merges parsed Stryker reports into one.
 * @param {object[]} reports - Parsed reports (schema v1).
 * @returns {{ files: Record<string, object> }} The merged report.
 */
export function mergeReports(reports) {
  const merged = { files: {} };
  for (const report of reports) {
    if (!report || typeof report !== 'object') continue;
    for (const [key, value] of Object.entries(report)) {
      if (key !== 'files' && merged[key] === undefined) merged[key] = value;
    }
    for (const [file, data] of Object.entries(report.files ?? {})) {
      const entry = merged.files[file] ?? (merged.files[file] = { ...data, mutants: [] });
      entry.mutants.push(...(data.mutants ?? []));
    }
  }
  return merged;
}

/**
 * Recursively finds every file named `mutation.json` under the given targets.
 * Directories are walked; explicit files are only kept when they are named
 * `mutation.json`, which keeps the output report from being read back in.
 * @param {string[]} targets - Files or directories.
 * @param {typeof fs} [fsImpl] - Injectable for tests.
 * @returns {string[]} Matching report paths.
 */
export function collectReportFiles(targets, fsImpl = fs) {
  const found = [];
  for (const target of targets) {
    if (!fsImpl.existsSync(target)) continue;
    if (fsImpl.statSync(target).isDirectory()) {
      for (const entry of fsImpl.readdirSync(target)) {
        found.push(...collectReportFiles([path.join(target, entry)], fsImpl));
      }
    } else if (path.basename(target) === REPORT_NAME) {
      found.push(target);
    }
  }
  return found;
}

/**
 * Runs the merge. Exported for testing.
 * @param {string[]} [argv] - CLI args (`[targets...] [--expect n]`).
 * @returns {void}
 */
export function run(argv = process.argv.slice(2)) {
  const expectIndex = argv.indexOf('--expect');
  const expected = expectIndex === -1 ? null : Number(argv[expectIndex + 1]);
  const targets = argv.filter((_, index) => index !== expectIndex && index !== expectIndex + 1);
  const reportFiles = collectReportFiles(targets.length > 0 ? targets : ['shards']);

  if (reportFiles.length === 0 || (expected !== null && reportFiles.length < expected)) {
    const found = reportFiles.length;
    const wanted = expected === null ? 'at least 1' : `all ${expected}`;
    console.error(`mutation-merge: found ${found} ${REPORT_NAME} report(s), wanted ${wanted}.`);
    process.exitCode = 1;
    return;
  }

  const reports = reportFiles.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  const merged = mergeReports(reports);
  const destination = outputFile();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(merged));
  const files = Object.keys(merged.files).length;
  const mutants = Object.values(merged.files).reduce((total, file) => total + (file.mutants?.length ?? 0), 0);
  console.log(`mutation-merge: merged ${reports.length} report(s) -> ${destination} (${files} file(s), ${mutants} mutant(s)).`);
}

function isMainModule() {
  if (process.argv[1] === undefined) return false;
  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  run();
}
