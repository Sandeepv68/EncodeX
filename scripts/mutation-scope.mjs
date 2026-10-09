/**
 * @fileoverview Resolves the Stryker mutation scope and splits it into CI
 * shards (Phase 9, CI-cost pass).
 *
 * On a pull request (or any run that provides a base ref) only the files the
 * branch touched *and* that are inside the mutation scope are mutated, so a
 * one-file change pays for a handful of mutants instead of all ~6,060. Without
 * a base ref (the weekly ratchet, manual dispatch) the full scope is used.
 *
 * The scope is read from `stryker.config.mjs` so there is a single source of
 * truth: this script expands its `mutate` globs to concrete files, intersects
 * them with the diff, then balances the survivors across N shards. Each shard is
 * run by a separate CI job and the reports are stitched back together by
 * `scripts/mutation-merge.mjs`.
 *
 * Output modes:
 *   --format files   newline-separated files (default; handy for local runs)
 *   --format csv     comma-separated files (a Stryker `--mutate` value)
 *   --format matrix  a GitHub Actions `strategy.matrix` JSON body
 *   --github-output  append `mode` / `shard_count` / `has_mutants` / `matrix`
 *                    to $GITHUB_OUTPUT (used by the CI prepare job)
 *
 * `--base <ref>` / `MUTATION_BASE` selects the diff base; `--shards <n>` /
 * `MUTATION_SHARDS` sets the shard budget (default 4). `--full` / `--changed`
 * force a mode instead of inferring it from the presence of a base.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import strykerConfig from '../stryker.config.mjs';

/**
 * Resolves the repository root. Computed lazily (not at module load) so
 * importing this file under a test runner that rewrites `import.meta.url`
 * cannot throw.
 * @returns {string} Absolute path to the repo root.
 */
function repoRoot() {
  return fileURLToPath(new URL('..', import.meta.url));
}

/**
 * The mutation globs from the Stryker config. Importing the config keeps the
 * scope list from drifting between the runner and this planner.
 */
export const MUTATE_GLOBS = strykerConfig.mutate;

/**
 * Expands the mutation globs to a sorted, de-duplicated list of repo-relative
 * POSIX paths.
 * @param {string[]} globs - Glob patterns (brace expansion included).
 * @param {string} [cwd] - Directory to resolve against.
 * @returns {string[]} Concrete file paths.
 */
export function expandScope(globs, cwd = repoRoot()) {
  const files = new Set();
  for (const pattern of globs) {
    for (const match of fs.globSync(pattern, { cwd })) {
      files.add(match.split(path.sep).join('/'));
    }
  }
  return [...files].sort();
}

/**
 * Intersects the mutation scope with the files a branch changed.
 * @param {string[]} scopeFiles - Expanded scope paths.
 * @param {Iterable<string>} changedFiles - Repo-relative POSIX paths the branch touched.
 * @returns {string[]} The scope files that changed.
 */
export function resolveChangedScope(scopeFiles, changedFiles) {
  const changed = changedFiles instanceof Set ? changedFiles : new Set(changedFiles);
  return scopeFiles.filter((file) => changed.has(file));
}

/**
 * Splits files across shards with a longest-processing-time-first greedy pass,
 * so the shards finish at roughly the same time instead of one carrying every
 * large file. `sizeOf` is injectable for tests.
 * @param {string[]} files - Files to distribute.
 * @param {number} shardCount - Desired shard count (capped at the file count).
 * @param {(file: string) => number} [sizeOf] - Relative cost of a file.
 * @returns {Array<{ shard: number, files: string[] }>} Non-empty shards, 1-based.
 */
export function planShards(files, shardCount, sizeOf = () => 1) {
  if (files.length === 0) return [];
  const shards = Math.max(1, Math.min(Math.floor(shardCount) || 1, files.length));
  const buckets = Array.from({ length: shards }, (_, index) => ({ shard: index + 1, files: [], weight: 0 }));
  const heaviestFirst = [...files].sort((a, b) => sizeOf(b) - sizeOf(a) || a.localeCompare(b));
  for (const file of heaviestFirst) {
    const target = buckets.reduce((lightest, bucket) => (bucket.weight < lightest.weight ? bucket : lightest), buckets[0]);
    target.files.push(file);
    target.weight += sizeOf(file);
  }
  return buckets.filter((bucket) => bucket.files.length > 0).map((bucket) => ({ shard: bucket.shard, files: bucket.files.sort() }));
}

/**
 * Parses the CLI/env options. `MUTATION_MODE`, `MUTATION_BASE`, and
 * `MUTATION_SHARDS` provide the defaults so the workflow can stay declarative.
 * @param {string[]} [argv] - Arguments (without `node`/script).
 * @param {NodeJS.ProcessEnv} [env] - Environment.
 * @returns {{ mode: string, base: string|null, shards: number, format: string, githubOutput: boolean }}
 */
export function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    mode: env.MUTATION_MODE ?? 'auto',
    base: env.MUTATION_BASE || null,
    shards: Number(env.MUTATION_SHARDS ?? 4),
    format: 'files',
    githubOutput: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--full') options.mode = 'full';
    else if (arg === '--changed') options.mode = 'changed';
    else if (arg === '--github-output') options.githubOutput = true;
    else if (arg === '--base') options.base = argv[++i];
    else if (arg === '--shards') options.shards = Number(argv[++i]);
    else if (arg === '--format') options.format = argv[++i];
  }
  return options;
}

/**
 * Builds the GitHub Actions matrix body for a set of shards.
 * @param {Array<{ shard: number, files: string[] }>} shards - Planned shards.
 * @returns {{ include: Array<{ shard: number, files: string }> }}
 */
export function buildMatrix(shards) {
  return { include: shards.map(({ shard, files }) => ({ shard, files: files.join(',') })) };
}

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function baseRefExists(ref) {
  try {
    git(['rev-parse', '--verify', '--quiet', ref]);
    return true;
  } catch {
    return false;
  }
}

function changedSourceFiles(base) {
  const out = git(['diff', '--name-only', '--diff-filter=ACMR', base, '--', 'src']);
  return new Set(
    out
      .split('\n')
      .map((line) => line.trim().split('\\').join('/'))
      .filter(Boolean),
  );
}

function sizeOfFile(file) {
  try {
    return fs.statSync(path.join(repoRoot(), file)).size;
  } catch {
    return 1;
  }
}

/**
 * Resolves the run mode and the concrete files to mutate. A missing base ref
 * falls back to the full scope with a reason on stderr, so a shallow checkout
 * degrades to "slow but correct" instead of mutating nothing.
 * @param {{ mode?: string, base?: string|null }} [options] - From {@link parseArgs}.
 * @returns {{ mode: string, files: string[], base?: string, reason?: string }}
 */
export function resolveScope({ mode = 'auto', base = null } = {}) {
  const scopeFiles = expandScope(MUTATE_GLOBS);
  const wantsChanged = mode === 'changed' || (mode === 'auto' && Boolean(base));
  if (!wantsChanged) return { mode: 'full', files: scopeFiles };
  if (!base || !baseRefExists(base)) {
    return { mode: 'full', files: scopeFiles, reason: base ? `base ref '${base}' not found` : 'no base ref' };
  }
  return { mode: 'changed', files: resolveChangedScope(scopeFiles, changedSourceFiles(base)), base };
}

/**
 * Runs the planner. Exported so the behavior is testable without a subprocess.
 * @param {string[]} [argv] - CLI args.
 * @param {NodeJS.ProcessEnv} [env] - Environment (also supplies GITHUB_OUTPUT).
 * @returns {void}
 */
export function run(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv, env);
  const scope = resolveScope(options);
  const shards = planShards(scope.files, options.shards, sizeOfFile);
  const matrix = buildMatrix(shards);
  if (scope.reason) console.error(`mutation-scope: ${scope.reason}; using the full scope.`);
  console.log(`mutation-scope: ${scope.mode} scope, ${scope.files.length} file(s), ${shards.length} shard(s)`);

  if (options.githubOutput) {
    if (!env.GITHUB_OUTPUT) throw new Error('--github-output requires the GITHUB_OUTPUT environment variable');
    const output = [
      `mode=${scope.mode}`,
      `shard_count=${shards.length}`,
      `has_mutants=${scope.files.length > 0}`,
      `matrix=${JSON.stringify(matrix)}`,
    ].join('\n');
    fs.appendFileSync(env.GITHUB_OUTPUT, `${output}\n`);
    return;
  }
  if (options.format === 'matrix') console.log(JSON.stringify(matrix));
  else if (options.format === 'csv') console.log(scope.files.join(','));
  else console.log(scope.files.join('\n'));
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
