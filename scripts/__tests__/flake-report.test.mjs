import { describe, it, expect } from 'vitest';
import { analyzeRuns, toRunResult, testId, expiryOf, validateQuarantine } from '../flake-report.mjs';

/**
 * Builds a run from a list of `[fullName, status]` pairs for one spec file.
 * @param {string} file - Repo-relative spec path.
 * @param {Array<[string, string]>} tests - Test name and status pairs.
 * @param {number} [index] - Run number, used only for the label.
 * @returns {import('../flake-report.mjs').RunResult} The run.
 */
function run(file, tests, index = 1) {
  const failed = new Set(tests.filter(([, status]) => status === 'failed').map(([name]) => testId(file, name)));
  return { name: `run-${index}`, tests: new Set(tests.map(([name]) => testId(file, name))), failed };
}

const SPEC = 'e2e/specs/convert.spec.ts';
const DAY = 24 * 60 * 60 * 1000;

describe('toRunResult', () => {
  it('maps a Vitest JSON report to observed and failed identifiers', () => {
    const report = {
      testResults: [
        {
          name: 'C:/repo/e2e/specs/convert.spec.ts',
          status: 'failed',
          assertionResults: [
            { fullName: 'suite passes', status: 'passed' },
            { fullName: 'suite fails', status: 'failed' },
          ],
        },
      ],
    };
    const result = toRunResult(report, 'run-1', (abs) => abs.replace('C:/repo/', ''));
    expect([...result.tests].sort()).toEqual(['e2e/specs/convert.spec.ts::suite fails', 'e2e/specs/convert.spec.ts::suite passes']);
    expect([...result.failed]).toEqual(['e2e/specs/convert.spec.ts::suite fails']);
  });

  it('records a file that failed to load so it is not invisible', () => {
    // A collection error (bad import, syntax error) produces a file-level
    // failure with no assertions. If that were dropped, the spec would vanish
    // from the matrix and the run would look clean.
    const report = {
      testResults: [{ name: 'C:/repo/e2e/specs/convert.spec.ts', status: 'failed', assertionResults: [] }],
    };
    const result = toRunResult(report, 'run-1', (abs) => abs.replace('C:/repo/', ''));
    expect(result.tests.size).toBe(1);
    expect(result.failed.size).toBe(1);
  });

  it('treats skipped and pending as observed but not failed', () => {
    const report = {
      testResults: [
        {
          name: 'C:/repo/e2e/specs/convert.spec.ts',
          status: 'passed',
          assertionResults: [
            { fullName: 'later', status: 'skipped' },
            { fullName: 'todo', status: 'pending' },
          ],
        },
      ],
    };
    const result = toRunResult(report, 'run-1', (abs) => abs.replace('C:/repo/', ''));
    expect(result.tests.size).toBe(2);
    expect(result.failed.size).toBe(0);
  });

  it('tolerates a report with no testResults', () => {
    const result = toRunResult({}, 'run-1', (abs) => abs);
    expect(result.tests.size).toBe(0);
    expect(result.failed.size).toBe(0);
  });
});

describe('expiryOf', () => {
  it('prefers an explicit expiresOn', () => {
    expect(expiryOf({ spec: 'a', addedOn: '2026-01-01', expiresOn: '2026-01-10' }, 21)).toBe(Date.parse('2026-01-10'));
  });

  it('derives expiry from addedOn plus the lifetime', () => {
    expect(expiryOf({ spec: 'a', addedOn: '2026-01-01' }, 21)).toBe(Date.parse('2026-01-01') + 21 * DAY);
  });

  it('returns null when the entry is undated', () => {
    expect(expiryOf({ spec: 'a' }, 21)).toBeNull();
  });
});

describe('analyzeRuns', () => {
  it('refuses to judge a single run', () => {
    // One run cannot distinguish flaky from passing. Reporting "ok" here would
    // let a misconfigured single-iteration invocation pass every build.
    const verdict = analyzeRuns([run(SPEC, [['a', 'passed']])]);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems[0]).toMatch(/at least 2/i);
  });

  it('passes when every test passes in every run', () => {
    const runs = [1, 2, 3].map((i) =>
      run(
        SPEC,
        [
          ['a', 'passed'],
          ['b', 'passed'],
        ],
        i,
      ),
    );
    const verdict = analyzeRuns(runs);
    expect(verdict.ok).toBe(true);
    expect(verdict.flaky).toEqual([]);
    expect(verdict.problems).toEqual([]);
  });

  it('flags a test that fails in one run of three', () => {
    const runs = [run(SPEC, [['flaky', 'passed']], 1), run(SPEC, [['flaky', 'failed']], 2), run(SPEC, [['flaky', 'passed']], 3)];
    const verdict = analyzeRuns(runs);
    expect(verdict.ok).toBe(false);
    expect(verdict.flaky).toHaveLength(1);
    expect(verdict.flaky[0].failureRate).toBeCloseTo(1 / 3);
    expect(verdict.problems[0]).toMatch(/failed 1\/3 runs \(33%\)/);
  });

  it('flags a test that fails in two runs of three', () => {
    const runs = [run(SPEC, [['flaky', 'failed']], 1), run(SPEC, [['flaky', 'passed']], 2), run(SPEC, [['flaky', 'failed']], 3)];
    expect(analyzeRuns(runs).flaky).toHaveLength(1);
  });

  it('reports an always-failing test separately from a flaky one', () => {
    // The distinction matters: an always-red test is an outage, a flaky one is a
    // flake. Both fail the build, but they need different fixes and different
    // triage, so they must not be reported as the same thing.
    const runs = [1, 2, 3].map((i) =>
      run(
        SPEC,
        [
          ['broken', 'failed'],
          ['flaky', i === 2 ? 'failed' : 'passed'],
        ],
        i,
      ),
    );
    const verdict = analyzeRuns(runs);
    expect(verdict.alwaysFailed.map((s) => s.name)).toEqual(['broken']);
    expect(verdict.flaky.map((s) => s.name)).toEqual(['flaky']);
    expect(verdict.ok).toBe(false);
  });

  it('flags a test that intermittently does not run at all', () => {
    // A spec that only appears in some runs is as broken as one that only fails
    // in some runs: the suite is not testing what it claims to test.
    const runs = [
      run(
        SPEC,
        [
          ['a', 'passed'],
          ['b', 'passed'],
        ],
        1,
      ),
      run(SPEC, [['a', 'passed']], 2),
      run(
        SPEC,
        [
          ['a', 'passed'],
          ['b', 'passed'],
        ],
        3,
      ),
    ];
    const verdict = analyzeRuns(runs);
    expect(verdict.ok).toBe(false);
    expect(verdict.partial.map((s) => s.name)).toEqual(['b']);
    expect(verdict.problems.some((p) => /partial: .*::b ran in only 2\/3/.test(p))).toBe(true);
  });

  it('downgrades a flaky test that has a live quarantine entry', () => {
    const runs = [run(SPEC, [['flaky', 'failed']], 1), run(SPEC, [['flaky', 'passed']], 2), run(SPEC, [['flaky', 'passed']], 3)];
    const entry = { spec: `${SPEC}::flaky`, issue: '#1', addedOn: '2026-09-20' };
    const verdict = analyzeRuns(runs, { quarantine: [entry], now: Date.parse('2026-09-25') });
    expect(verdict.ok).toBe(true);
    expect(verdict.flaky).toHaveLength(1);
    expect(verdict.flaky[0].quarantined).toBe(true);
  });

  it('accepts a whole-file quarantine entry', () => {
    const runs = [run(SPEC, [['a', 'failed']], 1), run(SPEC, [['a', 'passed']], 2), run(SPEC, [['a', 'passed']], 3)];
    const verdict = analyzeRuns(runs, {
      quarantine: [{ spec: SPEC, issue: '#2', addedOn: '2026-09-20' }],
      now: Date.parse('2026-09-25'),
    });
    expect(verdict.ok).toBe(true);
  });

  it('fails a flaky test whose quarantine entry has lapsed', () => {
    const runs = [run(SPEC, [['flaky', 'failed']], 1), run(SPEC, [['flaky', 'passed']], 2), run(SPEC, [['flaky', 'passed']], 3)];
    const entry = { spec: `${SPEC}::flaky`, issue: '#1', addedOn: '2026-08-01' };
    const verdict = analyzeRuns(runs, { quarantine: [entry], now: Date.parse('2026-09-30') });
    expect(verdict.ok).toBe(false);
    expect(verdict.expiredQuarantine).toHaveLength(1);
    expect(verdict.problems.some((p) => /expired quarantine/.test(p))).toBe(true);
    // A lapsed entry must not also exempt the flake it was meant to excuse.
    expect(verdict.flaky[0].quarantined).toBe(false);
  });

  it('fails a quarantine entry that matches nothing', () => {
    // Otherwise a typo, or an entry left behind after a fix, quietly keeps an
    // exemption alive forever.
    const runs = [1, 2, 3].map((i) => run(SPEC, [['a', 'passed']], i));
    const verdict = analyzeRuns(runs, {
      quarantine: [{ spec: 'e2e/specs/nonexistent.spec.ts::a', issue: '#3', addedOn: '2026-09-20' }],
      now: Date.parse('2026-09-25'),
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.staleQuarantine).toHaveLength(1);
    expect(verdict.problems.some((p) => /stale quarantine/.test(p))).toBe(true);
  });

  it('requires exact matching so a typo cannot exempt a different test', () => {
    const runs = [run(SPEC, [['flaky', 'failed']], 1), run(SPEC, [['flaky', 'passed']], 2), run(SPEC, [['flaky', 'passed']], 3)];
    const verdict = analyzeRuns(runs, {
      quarantine: [{ spec: `${SPEC}::flak`, issue: '#4', addedOn: '2026-09-20' }],
      now: Date.parse('2026-09-25'),
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.flaky[0].quarantined).toBe(false);
  });

  it('sorts the worst offenders first', () => {
    const runs = [
      run(
        SPEC,
        [
          ['mostly-fails', 'failed'],
          ['half-fails', 'failed'],
        ],
        1,
      ),
      run(
        SPEC,
        [
          ['mostly-fails', 'failed'],
          ['half-fails', 'passed'],
        ],
        2,
      ),
      run(
        SPEC,
        [
          ['mostly-fails', 'passed'],
          ['half-fails', 'passed'],
        ],
        3,
      ),
    ];
    const verdict = analyzeRuns(runs);
    expect(verdict.flaky.map((s) => s.name)).toEqual(['mostly-fails', 'half-fails']);
  });
});

describe('validateQuarantine', () => {
  const valid = { spec: 'e2e/specs/broken.spec.ts', issue: '#42', addedOn: '2026-01-01' };

  it('accepts a well-formed entry', () => {
    expect(validateQuarantine([valid])).toEqual([]);
  });

  it('accepts an entry with a later expiresOn', () => {
    expect(validateQuarantine([{ ...valid, expiresOn: '2026-06-01' }])).toEqual([]);
  });

  it('accepts an empty manifest', () => {
    expect(validateQuarantine([])).toEqual([]);
    // The committed quarantine.json uses the object form so it can carry a
    // $comment; the validator must accept exactly what the loader accepts.
    expect(validateQuarantine({ $comment: 'why', entries: [] })).toEqual([]);
    expect(validateQuarantine({ entries: [valid] })).toEqual([]);
  });

  it('rejects a missing spec', () => {
    const problems = validateQuarantine([{ issue: '#1', addedOn: '2026-01-01' }]);
    expect(problems.join('\n')).toMatch(/"spec" is required/);
  });

  it('rejects a missing issue', () => {
    const problems = validateQuarantine([{ spec: 'a.spec.ts', addedOn: '2026-01-01' }]);
    expect(problems.join('\n')).toMatch(/"issue" is required/);
  });

  it('rejects a missing addedOn - an undated entry is a permanent pass', () => {
    const problems = validateQuarantine([{ spec: 'a.spec.ts', issue: '#1' }]);
    expect(problems.join('\n')).toMatch(/"addedOn" is required/);
  });

  it('rejects a blank issue and a whitespace-only spec', () => {
    expect(validateQuarantine([{ ...valid, issue: '   ' }]).join('\n')).toMatch(/"issue" is required/);
    expect(validateQuarantine([{ ...valid, spec: '  ' }]).join('\n')).toMatch(/"spec" is required/);
  });

  it('rejects an unparseable addedOn', () => {
    // Date.parse returns NaN here rather than throwing, which used to make the
    // entry silently immortal.
    expect(validateQuarantine([{ ...valid, addedOn: 'not-a-date' }]).join('\n')).toMatch(/"addedOn" is required/);
    expect(validateQuarantine([{ ...valid, addedOn: '2026-13-45' }]).join('\n')).toMatch(/"addedOn" is required/);
    expect(validateQuarantine([{ ...valid, addedOn: '' }]).join('\n')).toMatch(/"addedOn" is required/);
    expect(validateQuarantine([{ ...valid, addedOn: 12345 }]).join('\n')).toMatch(/"addedOn" is required/);
  });

  it('rejects an unparseable expiresOn but allows it to be absent', () => {
    expect(validateQuarantine([{ ...valid, expiresOn: 'soon' }]).join('\n')).toMatch(/"expiresOn" must be a parseable/);
    expect(validateQuarantine([{ ...valid, expiresOn: undefined }])).toEqual([]);
  });

  it('rejects expiresOn at or before addedOn', () => {
    expect(validateQuarantine([{ ...valid, expiresOn: '2025-01-01' }]).join('\n')).toMatch(/must be after/);
    expect(validateQuarantine([{ ...valid, expiresOn: '2026-01-01' }]).join('\n')).toMatch(/must be after/);
  });

  it('rejects a root that is neither an array nor an object with entries', () => {
    expect(validateQuarantine({}).join('\n')).toMatch(/must be an array of entries/);
    expect(validateQuarantine({ entries: 'nope' }).join('\n')).toMatch(/must be an array of entries/);
    expect(validateQuarantine(null).join('\n')).toMatch(/must be an array of entries/);
    expect(validateQuarantine([null]).join('\n')).toMatch(/must be an object/);
    expect(validateQuarantine(['a.spec.ts']).join('\n')).toMatch(/must be an object/);
    expect(validateQuarantine([[]]).join('\n')).toMatch(/must be an object/);
  });

  it('reports every violation with its index so the offending entry is findable', () => {
    const problems = validateQuarantine([valid, { spec: 'b.spec.ts' }]);
    expect(problems).toHaveLength(2);
    expect(problems.join('\n')).toMatch(/quarantine\[1\]/);
  });
});

describe('undated and malformed quarantine entries fail the build', () => {
  const FILE = 'e2e/specs/broken.spec.ts';
  // One pass, two failures: a genuine flake that a quarantine entry is meant to excuse.
  const runs = [
    run(FILE, [['fails sometimes', 'passed']], 1),
    run(FILE, [['fails sometimes', 'failed']], 2),
    run(FILE, [['fails sometimes', 'failed']], 3),
  ];
  const now = Date.parse('2026-02-01');

  it('an undated entry does not exempt a flaky test', () => {
    const result = analyzeRuns(runs, {
      now,
      quarantine: [{ spec: FILE }],
    });
    expect(result.ok).toBe(false);
    expect(result.malformedQuarantine).toHaveLength(1);
    expect(result.problems.join('\n')).toMatch(/"addedOn" is required/);
    // The whole point: the flake is reported, not swallowed by a bad excuse.
    expect(result.problems.join('\n')).toMatch(/flaky/);
  });

  it('an entry with a malformed date does not exempt a flaky test', () => {
    const result = analyzeRuns(runs, {
      now,
      quarantine: [{ spec: FILE, issue: '#1', addedOn: '2026-13-45' }],
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/flaky/);
  });

  it('a well-formed live entry still exempts the flake', () => {
    const result = analyzeRuns(runs, {
      now,
      // addedOn + 21d = 2026-02-20, which is still live at now = 2026-02-01.
      quarantine: [{ spec: FILE, issue: '#1', addedOn: '2026-01-30' }],
    });
    expect(result.ok).toBe(true);
    expect(result.malformedQuarantine).toHaveLength(0);
  });

  it('a well-formed but already-lapsed entry does not exempt the flake', () => {
    const result = analyzeRuns(runs, {
      now,
      quarantine: [{ spec: FILE, issue: '#1', addedOn: '2026-01-01' }],
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/expired quarantine/);
    expect(result.problems.join('\n')).toMatch(/flaky/);
  });

  it('a schema violation fails even when no test is flaky', () => {
    const stable = [run(FILE, [['always passes', 'passed']], 1), run(FILE, [['always passes', 'passed']], 2)];
    const result = analyzeRuns(stable, {
      now,
      quarantine: [{ spec: FILE, issue: '#1', addedOn: 'garbage' }],
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/"addedOn" is required/);
  });
});
