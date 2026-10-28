/**
 * Updates the committed coverage baseline for the files this branch touched.
 *
 * The baseline records one entry per platform, and the gate compares a run
 * against its own platform's entry (CI measures on Linux). A branch that adds
 * files or moves code would otherwise leave the other platform's entries
 * stale, so the entries of the changed files are refreshed here -
 * conservatively, as the lower of the recorded number and the number measured
 * on this machine, so nothing is ever loosened.
 *
 * A file that this machine cannot measure in-process (a process entry point
 * whose code runs in a spawned child) keeps its recorded number.
 *
 * Usage: node scripts/update-baseline-for-changed.cjs [base-ref]
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { mergeCoverage } = require('./coverage-summary.mjs');

const ROOT = process.cwd();
const BASELINE = path.join(ROOT, 'coverage-baseline.json');
const BASE = process.argv[2] || 'origin/master';

/**
 * Runs a git command.
 * @param {string[]} args - The arguments.
 * @returns {string} The command's output.
 */
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

const status = git(['diff', '--name-status', BASE, '--', 'src'])
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'));
const changedFiles = new Set(status.map(([, file]) => file).filter((file) => file.startsWith('src/')));

// The merged measurement of both tiers, exactly as the gate measures it.
const measured = new Map(mergeCoverage(['coverage', 'coverage-integration']).entries.map((entry) => [entry.file, entry]));

const round = (value) => Math.round(value * 100) / 100;

/**
 * Merges a recorded entry with a fresh measurement, keeping the lower number.
 * @param {object | undefined} recorded - The recorded entry.
 * @param {object} next - The fresh measurement.
 * @returns {object} The merged entry.
 */
function merge(recorded, next) {
  if (!recorded) return next;
  return {
    lines: Math.min(recorded.lines, next.lines),
    branches: Math.min(recorded.branches, next.branches),
    statements: Math.min(recorded.statements === undefined ? recorded.lines : recorded.statements, next.statements),
  };
}

let updated = 0;
for (const file of changedFiles) {
  const exists = fs.existsSync(path.join(ROOT, file));
  const m = measured.get(file);
  if (!exists) {
    // Deleted: drop it from every map.
    for (const name of Object.keys(baseline.platforms ?? {})) {
      if (baseline.platforms[name] && baseline.platforms[name].files) delete baseline.platforms[name].files[file];
    }
    delete baseline.files[file];
    updated += 1;
    continue;
  }
  if (!m) {
    // Not measurable here (a spawned entry point): keep what was recorded.
    continue;
  }
  const next = {
    lines: round(Math.min(m.lines, m.statements)),
    branches: round(m.branches),
    statements: round(m.statements),
  };
  for (const name of Object.keys(baseline.platforms ?? {})) {
    if (!baseline.platforms[name] || !baseline.platforms[name].files) continue;
    baseline.platforms[name].files[file] = merge(baseline.platforms[name].files[file], next);
  }
  baseline.files[file] = merge(baseline.files[file], next);
  updated += 1;
}

fs.writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n');
console.log(`updated ${updated} baseline entries`);
