/**
 * @fileoverview Flake analysis for repeated test runs.
 *
 * A test that fails sometimes is worse than one that always fails: an always-red
 * test is noticed on day one, while a test that fails one run in three gets
 * re-run until it goes green, and the failure signal is destroyed. CI already
 * sets `retry: 2`, which makes this worse, not better - a spec that fails once
 * and passes on retry is reported as passed. That is why the detector runs with
 * retries disabled and judges the per-run results itself.
 *
 * This module is deliberately pure: it takes parsed run results and returns a
 * verdict, with no process spawning, filesystem access, or clock reads (the
 * caller passes `now`). That keeps the rule that decides whether a build passes
 * directly unit-testable, which matters more here than anywhere else in the
 * coverage tooling - this is a gate, and a gate nobody can test is a gate that
 * quietly stops working.
 */

/**
 * @typedef {object} TestResult
 * @property {string} file - Repo-relative POSIX path of the spec.
 * @property {string} fullName - `describe > it` name.
 * @property {string} status - Vitest status: passed, failed, pending, skipped, todo.
 */

/**
 * @typedef {object} RunResult
 * @property {string} name - Run label, for reporting.
 * @property {string[]} tests - Identifiers (`file::fullName`) observed this run.
 * @property {Set<string>} failed - Identifiers that failed this run.
 */

/**
 * @typedef {object} QuarantineEntry
 * @property {string} spec - Exact `file::fullName`, or a whole `file` path.
 * @property {string} [issue] - Tracking issue.
 * @property {string} [addedOn] - ISO date the entry was created.
 * @property {string} [expiresOn] - ISO date the entry lapses. Defaults to addedOn + 21 days.
 */

/**
 * Identifies a single test across runs.
 * @param {string} file - Repo-relative path.
 * @param {string} fullName - Test name.
 * @returns {string} A stable identifier.
 */
export function testId(file, fullName) {
  return `${file}::${fullName}`;
}

/**
 * Converts a Vitest JSON report into a {@link RunResult}.
 *
 * Only `failed` is treated as a failure. `pending` and `skipped` are recorded as
 * observed-but-not-passed so that a spec which starts skipping intermittently is
 * still visible in the matrix, but they do not by themselves mark a run red -
 * a permanently skipped test is a quarantine problem, not a flake.
 *
 * @param {object} report - Parsed Vitest JSON reporter output.
 * @param {string} name - Run label.
 * @param {(absPath: string) => string} toPosixRelative - Normalizes an absolute path.
 * @returns {RunResult} The run.
 */
export function toRunResult(report, name, toPosixRelative) {
  /** @type {Set<string>} */
  const failed = new Set();
  /** @type {Set<string>} */
  const tests = new Set();
  for (const file of report?.testResults ?? []) {
    const filePath = toPosixRelative(file.name);
    // A file-level failure with no assertions (e.g. a collection error) still
    // has to show up, otherwise an import error reads as "no tests ran" and the
    // spec silently disappears from the matrix.
    if (file.status === 'failed' && (file.assertionResults ?? []).length === 0) {
      tests.add(testId(filePath, '(file failed to run)'));
      failed.add(testId(filePath, '(file failed to run)'));
    }
    for (const assertion of file.assertionResults ?? []) {
      const id = testId(filePath, assertion.fullName);
      tests.add(id);
      if (assertion.status === 'failed') failed.add(id);
    }
  }
  return { name, tests, failed };
}

/**
 * Resolves when a quarantine entry lapses.
 * @param {QuarantineEntry} entry - The entry.
 * @param {number} maxAgeDays - Default lifetime in days.
 * @returns {number|null} Epoch milliseconds, or null if the entry is undated.
 */
export function expiryOf(entry, maxAgeDays) {
  if (entry.expiresOn) return Date.parse(entry.expiresOn);
  if (entry.addedOn) return Date.parse(entry.addedOn) + maxAgeDays * 24 * 60 * 60 * 1000;
  return null;
}

/**
 * Decides whether every repeated run agrees.
 *
 * @param {RunResult[]} runs - One entry per execution of the suite.
 * @param {object} [options] - Tuning.
 * @param {QuarantineEntry[]} [options.quarantine] - Accepted, time-limited excuses.
 * @param {number} [options.now] - Epoch ms used for expiry checks.
 * @param {number} [options.maxQuarantineDays] - Default quarantine lifetime.
 * @returns {object} The verdict.
 */
export function analyzeRuns(runs, options = {}) {
  const { quarantine = [], now = Date.now(), maxQuarantineDays = 21 } = options;

  const totalRuns = runs.length;
  if (totalRuns < 2) {
    // One run cannot distinguish "flaky" from "passes" - every failure is just a
    // failure. Refusing here stops a misconfigured single-iteration run from
    // reporting a clean bill of health.
    return {
      ok: false,
      totalRuns,
      specs: [],
      flaky: [],
      alwaysFailed: [],
      partial: [],
      missing: [],
      expiredQuarantine: [],
      staleQuarantine: [],
      problems: [`Only ${totalRuns} run(s) recorded; at least 2 are required to detect a flake.`],
    };
  }

  /** @type {Map<string, {id: string, file: string, name: string, seen: number, failed: number}>} */
  const stats = new Map();
  for (const run of runs) {
    // Every run is a full accounting of what was observed, so a spec missing
    // from a run is itself a finding: a spec that intermittently does not run
    // is as broken as one that intermittently fails.
    for (const id of run.tests) {
      let stat = stats.get(id);
      if (!stat) {
        const split = id.indexOf('::');
        stat = {
          id,
          file: id.slice(0, split),
          name: id.slice(split + 2),
          seen: 0,
          failed: 0,
        };
        stats.set(id, stat);
      }
      stat.seen += 1;
      if (run.failed.has(id)) stat.failed += 1;
    }
  }

  const expiredQuarantine = [];
  for (const entry of quarantine) {
    const expiry = expiryOf(entry, maxQuarantineDays);
    if (expiry !== null && expiry <= now) {
      expiredQuarantine.push({ entry, expiry });
    }
  }
  const liveEntries = quarantine.filter((entry) => !expiredQuarantine.some((expired) => expired.entry === entry));
  /** @type {Set<number>} */
  const usedEntries = new Set();

  /** @type {object[]} */
  const specs = [];
  const flaky = [];
  const alwaysFailed = [];
  const partial = [];

  for (const stat of stats.values()) {
    // An entry qualifies a test when it names the whole spec file or the exact
    // `file::fullName`. Matching is exact on purpose: a substring rule would let
    // a typo quietly exempt a different test, which is precisely the "silent
    // skip" the plan forbids.
    const matchIndex = liveEntries.findIndex((entry) => entry.spec === stat.file || entry.spec === stat.id);
    const quarantined = matchIndex >= 0;
    if (quarantined) usedEntries.add(matchIndex);
    const rate = stat.seen === 0 ? 1 : stat.failed / stat.seen;
    let verdict;
    if (stat.seen < totalRuns) verdict = 'partial';
    else if (stat.failed === 0) verdict = 'stable-pass';
    else if (stat.failed === stat.seen) verdict = 'stable-fail';
    else verdict = 'flaky';

    const record = {
      ...stat,
      failureRate: rate,
      verdict,
      quarantined,
    };
    specs.push(record);
    if (verdict === 'flaky') flaky.push(record);
    else if (verdict === 'stable-fail') alwaysFailed.push(record);
    else if (verdict === 'partial') partial.push(record);
  }

  const byRate = (a, b) => b.failureRate - a.failureRate || a.id.localeCompare(b.id);
  flaky.sort(byRate);
  alwaysFailed.sort(byRate);
  partial.sort(byRate);
  specs.sort(byRate);

  const staleQuarantine = liveEntries.filter((_, index) => !usedEntries.has(index));

  /** @type {string[]} */
  const problems = [];
  for (const spec of flaky) {
    if (spec.quarantined) continue;
    problems.push(`flaky: ${spec.id} failed ${spec.failed}/${spec.seen} runs (${pct(spec.failureRate)})`);
  }
  for (const spec of partial) {
    problems.push(
      spec.quarantined
        ? `quarantined: ${spec.id} ran in only ${spec.seen}/${totalRuns} runs`
        : `partial: ${spec.id} ran in only ${spec.seen}/${totalRuns} runs`,
    );
  }
  for (const spec of alwaysFailed) {
    problems.push(`failed every run: ${spec.id} (${spec.failed}/${spec.seen})`);
  }
  for (const { entry, expiry } of expiredQuarantine) {
    problems.push(`expired quarantine: ${entry.spec} lapsed ${new Date(expiry).toISOString().slice(0, 10)}`);
  }
  for (const entry of staleQuarantine) {
    problems.push(`stale quarantine: ${entry.spec} matches no test, or is listed but not flaky`);
  }

  return {
    ok: problems.length === 0,
    totalRuns,
    specs,
    flaky,
    alwaysFailed,
    partial,
    expiredQuarantine,
    staleQuarantine,
    problems,
  };
}

/**
 * Formats a failure rate for a message.
 * @param {number} rate - A value between 0 and 1.
 * @returns {string} A percentage with no decimals.
 */
function pct(rate) {
  return `${Math.round(rate * 100)}%`;
}
