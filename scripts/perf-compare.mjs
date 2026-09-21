/**
 * @fileoverview Performance regression gate.
 * Generates/merges a per-platform baseline from `perf/results/*.json`
 * (mode `--generate`) or compares current run medians against the
 * committed baseline (default mode). Fails when the median duration of a
 * test exceeds the baseline median by more than `PERF_TOLERANCE` (0.35).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const RESULTS_DIR = fileURLToPath(new URL('../perf/results/', import.meta.url));
const BASELINE_FILE = fileURLToPath(new URL('../perf/baseline.json', import.meta.url));
const PLATFORM_KEY = `${process.platform}-${process.arch}`;
const DEFAULT_TOLERANCE = 0.35;

function median(values) {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseTolerance() {
  const raw = process.env.PERF_TOLERANCE;
  if (raw === undefined) return DEFAULT_TOLERANCE;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    console.error(`Invalid PERF_TOLERANCE '${raw}'; expected a non-negative number.`);
    process.exit(2);
  }
  return value;
}

function loadResultFiles() {
  if (!fs.existsSync(RESULTS_DIR)) return [];
  return fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(RESULTS_DIR, f));
}

function aggregateResults() {
  const byTest = new Map();
  const files = loadResultFiles();
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.warn(`Skipping unreadable result file ${file}: ${err.message}`);
      continue;
    }
    for (const r of data.results ?? []) {
      if (typeof r?.durationMs !== 'number') continue;
      const key = `${r.phase}::${r.test}`;
      if (!byTest.has(key)) byTest.set(key, { phase: r.phase, test: r.test, durations: [] });
      if (r.passed !== false) byTest.get(key).durations.push(r.durationMs);
    }
  }
  return byTest;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function generateBaseline(byTest) {
  if (byTest.size === 0) {
    console.error('No perf results found under perf/results/; nothing to baseline.');
    process.exit(2);
  }
  const current = parseBaseline();
  const platform = ((current.platforms ??= {})[PLATFORM_KEY] ??= {});
  for (const { phase, test, durations } of byTest.values()) {
    const key = `${phase}::${test}`;
    (platform[key] ??= {}).medianMs = median(durations);
    platform[key].samples = durations.length;
  }
  current.generatedAt = new Date().toISOString();
  current.source = 'perf/results/*.json';
  if (typeof current.version !== 'number') current.version = 1;
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2) + '\n');
  console.log(`Updated baseline for ${PLATFORM_KEY} (${byTest.size} tests) -> ${BASELINE_FILE}`);
}

function parseBaseline() {
  const existing = loadBaseline();
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) return existing;
  return { version: 1, generatedAt: null, source: 'perf/results/*.json', platforms: {} };
}

function compareToBaseline(byTest, tolerance) {
  if (byTest.size === 0) {
    console.warn('No current perf results found; compare skipped.');
    return;
  }
  const baseline = parseBaseline();
  const platform = baseline.platforms?.[PLATFORM_KEY];
  if (!platform) {
    console.warn(`No committed baseline for ${PLATFORM_KEY}; recording only (gate not armed).`);
    return;
  }
  const rows = [];
  const missing = [];
  let regressions = 0;
  for (const { phase, test, durations } of byTest.values()) {
    const key = `${phase}::${test}`;
    const entry = platform[key];
    if (!entry || typeof entry.medianMs !== 'number') {
      missing.push(`${phase} / ${test}`);
      continue;
    }
    const current = median(durations);
    const ratio = current / entry.medianMs;
    const limit = 1 + tolerance;
    const failed = ratio > limit;
    if (failed) regressions += 1;
    rows.push({ status: failed ? 'FAIL' : 'ok', phase, test, current, baseline: entry.medianMs, ratio });
  }
  console.log('');
  console.log('='.repeat(72));
  console.log(`Perf compare (${PLATFORM_KEY}, tolerance ${(tolerance * 100).toFixed(0)}%): ${regressions} regression(s)`);
  console.log('='.repeat(72));
  for (const row of rows.sort((a, b) => b.ratio - a.ratio)) {
    console.log(
      `  [${row.status}] ${row.phase} / ${row.test}\n` +
        `        current ${row.current.toFixed(1)}ms vs baseline ${row.baseline.toFixed(1)}ms (x${row.ratio.toFixed(2)})`,
    );
  }
  if (missing.length) {
    console.log(`  (no baseline yet: ${missing.length} test(s); treating as pass)`);
  }
  console.log('='.repeat(72));
  if (regressions > 0) {
    console.error(`FAIL: ${regressions} performance regression(s) exceeded the ${(tolerance * 100).toFixed(0)}% tolerance.`);
    process.exit(1);
  }
}

const generate = process.argv.includes('--generate');
const tolerance = parseTolerance();
const byTest = aggregateResults();
if (generate) {
  generateBaseline(byTest);
} else {
  compareToBaseline(byTest, tolerance);
}
