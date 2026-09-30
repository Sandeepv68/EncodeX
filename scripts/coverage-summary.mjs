import fs from 'node:fs';
import path from 'node:path';
import libCoverage from 'istanbul-lib-coverage';

/**
 * @fileoverview Shared coverage reader for the Phase 0.4 gates.
 *
 * Phase 0.4 needs the same data twice: once to *choose* a per-file floor
 * (non-blocking, informational) and once to *enforce* a floor on the files a
 * pull request touched (blocking). Both read this module so the two can never
 * disagree about what a coverage number means.
 *
 * Merging matters as much as reading, and it is the subtle part.
 *
 * `test:coverage` runs the **unit** tier only. `vitest.config.ts` deliberately
 * excludes `*.integration.test.ts`, and the integration tier is a separate CI
 * job (`test:integration`) that had no coverage configuration at all. That
 * tier is what actually drives `src/main/cli/cli-batch.ts`, `cli-info.ts`, and
 * `src/main/mcp/http-server.ts` - files the unit report shows as 0%, 0%, and
 * 3%. A per-file floor built from the unit report alone would demand tests that
 * already exist, and a diff gate built from it would fail any PR that
 * legitimately edits a CLI file. So both tiers are measured and unioned before
 * any floor is applied.
 *
 * The union uses the full `json` report, not `json-summary`. The summary
 * reporter exposes only `{ covered, total }` percentages, which cannot be
 * converted back into a raw istanbul coverage map - there is no location data
 * to hang synthetic node counts on. A first attempt did exactly that and
 * produced a map with zero hit counts, which reads as **100% covered**, and the
 * floor report cheerfully reported "0 violators" where the truth was 33. The
 * `assertMergeIsSane` invariant below exists so that class of bug can never
 * ship silently again.
 *
 * @module scripts/coverage-summary
 */

/** Default floor applied to lines and statements. */
export const DEFAULT_LINE_FLOOR = 80;

/** Default floor applied to branches. Branches get a lower bar than lines. */
export const DEFAULT_BRANCH_FLOOR = 70;

/**
 * @typedef {object} FileCoverage
 * @property {string} file - Repo-relative POSIX path of the source file.
 * @property {number} statements - Percent of statements covered.
 * @property {number} branches - Percent of branches covered.
 * @property {number} functions - Percent of functions covered.
 * @property {number} lines - Percent of lines covered.
 */

/** Report files each coverage directory is expected to contain. */
const SUMMARY_FILE = 'coverage-summary.json';
const RAW_FILE = 'coverage-final.json';

/**
 * Merges every tier's raw coverage report into one set of per-file numbers.
 *
 * Missing or empty directories are skipped so callers can pass both tiers
 * unconditionally, but at least one real report is required.
 *
 * @param {string[]} coverageDirs - Directories holding a `coverage-final.json`.
 * @returns {{entries: FileCoverage[], tiers: string[], skipped: string[]}} Merged
 *   per-file coverage plus which directories actually contributed.
 * @throws {Error} When no directory held a raw report.
 */
export function mergeCoverage(coverageDirs) {
  const { plain, tiers, skipped } = mergeRaw(coverageDirs);

  const entries = Object.entries(plain).map(([key, fileCoverage]) => toEntry(key, fileCoverage));
  entries.sort((a, b) => a.lines - b.lines || a.file.localeCompare(b.file));
  return { entries, tiers, skipped };
}

/**
 * Merges the raw per-file reports of several tiers into one plain object.
 *
 * @param {string[]} coverageDirs - Directories holding a `coverage-final.json`.
 * @returns {{plain: object, tiers: string[], skipped: string[]}} The merged
 *   istanlib data, keyed and `path`-tagged repo-relatively, plus which
 *   directories actually contributed.
 * @throws {Error} When no directory held a raw report.
 */
function mergeRaw(coverageDirs) {
  const tiers = [];
  const skipped = [];
  const merged = libCoverage.createCoverageMap({});

  for (const dir of coverageDirs) {
    const file = path.join(dir, RAW_FILE);
    if (!fs.existsSync(file)) {
      skipped.push(dir);
      continue;
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    // Re-key to repo-relative POSIX before merging; see normalizeKey. The
    // `path` field must be rewritten too: `toJSON()` rebuilds keys from the
    // per-file `path` property, not from the map key, so leaving it absolute
    // would silently restore the original machine-specific keys.
    const normalized = {};
    for (const [key, value] of Object.entries(parsed)) {
      const stable = normalizeKey(key);
      normalized[stable] = { ...value, path: stable };
    }
    // `createCoverageMap` + `merge` unions the hit counts per node, so a line
    // exercised by either tier counts once. This is the whole point: summing
    // the two tiers' percentages would double-count shared nodes, and inventing
    // synthetic nodes (see the file header) loses the data entirely.
    merged.merge(libCoverage.createCoverageMap(normalized));
    tiers.push(dir);
  }

  if (tiers.length === 0) {
    throw new Error(
      `No ${RAW_FILE} in any of: ${coverageDirs.join(', ')}.\n` +
        `Add the 'json' reporter to the coverage config, then run a coverage pass.`,
    );
  }

  // `toJSON()` rather than `files()`: in istanbul-lib-coverage 3.2.2 `files()`
  // mis-walks a flat, path-keyed map and yields single-segment garbage keys
  // ('s' for 'src/main/a.ts'), which is silent data corruption in a gate.
  return { plain: merged.toJSON(), tiers, skipped };
}

/**
 * Builds per-file sets of executable and covered lines from the merged tiers.
 *
 * Used for diff coverage: the question is not only "is this file above the
 * floor" but "were the lines this change added actually executed". `executable`
 * is the set of statement-start lines, so callers can intersect it with added
 * lines and ignore braces, comments, and continuation lines, which are not
 * statements and can never be reported as uncovered.
 *
 * @param {string[]} coverageDirs - Directories holding a `coverage-final.json`.
 * @returns {Map<string, {executable: Set<number>, covered: Set<number>}>}
 *   Per-file line sets, keyed repo-relatively.
 */
export function mergedLineSets(coverageDirs) {
  const { plain } = mergeRaw(coverageDirs);
  const result = new Map();
  for (const [key, fileCoverage] of Object.entries(plain)) {
    const executable = new Set();
    const covered = new Set();
    for (const [id, loc] of Object.entries(fileCoverage.statementMap ?? {})) {
      const line = loc?.start?.line;
      if (typeof line !== 'number') continue;
      executable.add(line);
      if ((fileCoverage.s?.[id] ?? 0) > 0) covered.add(line);
    }
    result.set(key, { executable, covered });
  }
  return result;
}

/**
 * Rewrites a provider path into a stable, repo-relative POSIX key.
 *
 * Two things force this. `istanbul-lib-coverage` splits keys on `\` and `:`
 * as path separators, so a raw Windows key like `C:\src\a.ts` is parsed as a
 * nested tree and `files()` yields 222 garbage single-character entries instead
 * of 220 files. And the two tiers must agree on the key for a file or the union
 * silently keeps only one of them - absolute paths differ between a developer
 * machine and CI. Repo-relative keys fix both and make the output stable.
 *
 * @param {string} key - Path as recorded by the coverage provider.
 * @returns {string} A repo-relative POSIX path, or a normalized absolute one.
 */
function normalizeKey(key) {
  const slashed = key.split('\\').join('/');
  const rel = path.posix.relative(process.cwd().split(path.sep).join('/'), slashed);
  if (rel && !rel.startsWith('..')) return rel;
  return slashed;
}

/**
 * Reads the single-tier summary report, for callers that only have one tier.
 * @param {string} [coverageDir] - Directory holding `coverage-summary.json`.
 * @returns {FileCoverage[]} Per-file coverage, worst-first.
 */
export function readSummary(coverageDir = 'coverage') {
  const file = path.join(coverageDir, SUMMARY_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}. Run \`npm run test:coverage\` first.`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entries = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'total') continue;
    entries.push({
      file: normalizeKey(key),
      statements: pairPct(value.statements),
      branches: pairPct(value.branches),
      functions: pairPct(value.functions),
      lines: pairPct(value.lines),
    });
  }
  entries.sort((a, b) => a.lines - b.lines || a.file.localeCompare(b.file));
  return entries;
}

/**
 * Guards the merge against silently discarding a tier or undercounting hits.
 *
 * Percentages cannot be compared across tiers here. The v8 provider emits a
 * different `statementMap` per run depending on which functions were actually
 * loaded, so a file's line set is not stable between tiers and a union can
 * legitimately land above both inputs' percentages. Absolute counts are stable,
 * so the invariants below are on counts:
 *
 * 1. The merged file set is exactly the union of the input file sets. This
 *    catches a tier that failed to load, a key-normalization mismatch, and the
 *    original bug where path separators made istanlib emit garbage keys.
 * 2. Per file, merged covered statements are at least each tier's covered
 *    statements. `merge` keeps the max hit count per node id, so the union can
 *    only ever add coverage. A merged count below an input means a tier was
 *    overwritten or dropped, which would under-report and wrongly fail a gate.
 *
 * A wrong merge that reports *high* coverage is the more dangerous failure, so
 * these checks are about proving nothing was lost.
 *
 * @param {FileCoverage[]} entries - The merged entries.
 * @param {string[]} coverageDirs - Tiers that were fed into the merge.
 * @throws {Error} On the first violated invariant.
 */
export function assertMergeIsSane(entries, coverageDirs) {
  const perTier = coverageDirs.filter((dir) => fs.existsSync(path.join(dir, RAW_FILE))).map((dir) => readRawCounts(dir));

  if (perTier.length < 2) return;

  const union = new Set(perTier.flatMap((tier) => [...tier.keys()]));
  const mergedKeys = new Set(entries.map((entry) => entry.file));
  const mergedCounts = new Map(entries.map((entry) => [entry.file, entry.coveredStatements]));
  const missing = [...union].filter((key) => !mergedKeys.has(key));
  if (missing.length > 0) {
    throw new Error(
      `Coverage merge dropped ${missing.length} file(s) present in the input tiers, ` +
        `e.g. ${missing.slice(0, 3).join(', ')}. Check that the 'json' reporter is ` +
        `enabled in every tier's config and that both tiers share vitest.coverage-scope.ts.`,
    );
  }

  for (const [key, counts] of perTier[0]) {
    const mergedCovered = mergedCounts.get(key);
    if (mergedCovered === undefined) continue;
    for (const [index, tier] of perTier.entries()) {
      const tierCounts = tier.get(key);
      if (!tierCounts) continue;
      if (mergedCovered < tierCounts.covered) {
        throw new Error(
          `Coverage merge undercounted ${key}: tier ${index + 1} covered ` +
            `${tierCounts.covered} statements but the union reports ${mergedCovered}. ` +
            `A union cannot lose hits; check that merge() is still being used.`,
        );
      }
    }
  }
}

/**
 * Reads covered/total statement counts per file from one tier's raw report.
 * @param {string} coverageDir - Directory holding `coverage-final.json`.
 * @returns {Map<string, {covered: number, total: number}>} Counts keyed by
 *   normalized repo-relative path.
 */
function readRawCounts(coverageDir) {
  const parsed = JSON.parse(fs.readFileSync(path.join(coverageDir, RAW_FILE), 'utf8'));
  const counts = new Map();
  for (const [key, value] of Object.entries(parsed)) {
    const total = Object.keys(value.s ?? {}).length;
    const covered = Object.values(value.s ?? {}).filter((count) => count > 0).length;
    // Normalized here so these keys are directly comparable with the merged
    // entry keys, which come out of toJSON() already normalized.
    counts.set(normalizeKey(key), { covered, total });
  }
  return counts;
}

/**
 * Converts one raw istanbul file coverage object into a {@link FileCoverage}.
 * @param {string} key - The already-normalized repo-relative key.
 * @param {object} fileCoverage - An istanlib `FileCoverage`.
 * @returns {FileCoverage} Percentages for this file.
 */
function toEntry(key, fileCoverage) {
  return {
    file: key,
    statements: countPct(fileCoverage.s, fileCoverage.statementMap),
    branches: branchPct(fileCoverage.b, fileCoverage.branchMap),
    functions: countPct(fileCoverage.f, fileCoverage.fnMap),
    lines: linePct(fileCoverage),
    // Raw counts travel with the entry so assertMergeIsSane can compare the
    // union against each tier without re-merging. Percentages are not
    // comparable across tiers; counts are.
    coveredStatements: Object.values(fileCoverage.s ?? {}).filter((count) => count > 0).length,
    totalStatements: Object.keys(fileCoverage.s ?? {}).length,
  };
}

/**
 * Percent of nodes hit in a flat count map.
 * @param {Record<string, number>} counts - Node id to hit count.
 * @param {Record<string, unknown>} map - Node id to location.
 * @returns {number} Percent, or 100 when the file has no such nodes.
 */
function countPct(counts, map) {
  const total = Object.keys(map).length;
  if (total === 0) return 100;
  const hit = Object.keys(map).filter((id) => (counts[id] ?? 0) > 0).length;
  return (hit / total) * 100;
}

/**
 * Percent of branch arms hit.
 * @param {Record<string, number[]>} counts - Branch id to per-arm hit counts.
 * @param {Record<string, unknown>} map - Branch id to location.
 * @returns {number} Percent, or 100 when the file has no branches.
 */
function branchPct(counts, map) {
  let total = 0;
  let hit = 0;
  for (const [id, arms] of Object.entries(map)) {
    const armCounts = counts[id] ?? [];
    for (const arm of armCounts) {
      total++;
      if (arm > 0) hit++;
    }
  }
  if (total === 0) return 100;
  return (hit / total) * 100;
}

/**
 * Percent of lines with at least one covered statement.
 *
 * Computed from the statement map rather than via istanlib's
 * `FileCoverage#getLineCoverage`, because `toJSON()` hands back plain objects
 * that do not carry the class methods.
 *
 * @param {object} fileCoverage - A plain per-file coverage object.
 * @returns {number} Percent, or 100 when the file has no statements.
 */
function linePct(fileCoverage) {
  const coveredLines = new Set();
  const allLines = new Set();
  for (const [id, loc] of Object.entries(fileCoverage.statementMap ?? {})) {
    const line = loc?.start?.line;
    if (typeof line !== 'number') continue;
    allLines.add(line);
    if ((fileCoverage.s?.[id] ?? 0) > 0) coveredLines.add(line);
  }
  if (allLines.size === 0) return 100;
  return (coveredLines.size / allLines.size) * 100;
}

/**
 * Percent from a `{ covered, total }` pair.
 * @param {{covered: number, total: number}} stat - The summary metric.
 * @returns {number} Percent, or 100 when nothing was measurable.
 */
function pairPct(stat) {
  if (!stat || !stat.total) return 100;
  return (stat.covered / stat.total) * 100;
}

/**
 * Reports whether a file misses either floor.
 *
 * The stricter of lines/statements is used for the line floor: a file can have
 * 100% line coverage and low statement coverage when statements share lines,
 * and gating on the higher number would let that through.
 *
 * @param {FileCoverage} entry - The measured file.
 * @param {number} lineFloor - Minimum lines/statements percent.
 * @param {number} branchFloor - Minimum branches percent.
 * @returns {{lines: boolean, branches: boolean}} Per-metric verdicts.
 */
export function misses(entry, lineFloor, branchFloor) {
  const lines = Math.min(entry.lines, entry.statements);
  return { lines: lines < lineFloor, branches: entry.branches < branchFloor };
}

/**
 * Renders a fixed-width table of files, worst coverage first.
 * @param {FileCoverage[]} entries - Files, already sorted worst-first.
 * @param {number} limit - Maximum rows to print.
 * @returns {string} A printable table.
 */
export function table(entries, limit) {
  const head = ['file', 'lines', 'stmts', 'branch', 'funcs'];
  const rows = entries.slice(0, limit).map((e) => [e.file, fmt(e.lines), fmt(e.statements), fmt(e.branches), fmt(e.functions)]);
  const width = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(width[i])).join('  ');
  return [line(head), width.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

/**
 * Formats a percentage to one decimal place.
 * @param {number} n - The percentage.
 * @returns {string} Formatted value with a trailing `%`.
 */
function fmt(n) {
  return `${n.toFixed(1)}%`;
}
