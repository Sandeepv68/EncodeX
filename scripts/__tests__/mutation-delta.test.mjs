/**
 * @fileoverview Phase 9: tests for the mutation-delta gate script itself.
 * A script that decides whether CI merges must not be trusted "because it is
 * just tooling" (same rule the repo applies to the coverage and flake tooling).
 * Covers the metric math against the mutation-testing-report-schema v1.0
 * statuses and the delta rule (armed floor, recording-first-run behaviour,
 * malformed baseline handling).
 */

import { describe, it, expect } from 'vitest';
import { computeMutationMetrics, computeFileMetrics, evaluateMutationDelta, evaluateFileDeltas, parseDelta } from '../mutation-delta.mjs';

function reportWith(statuses) {
  const files = {};
  statuses.forEach((status, i) => {
    if (!files[`src/f${i}.ts`]) files[`src/f${i}.ts`] = { mutants: [] };
    files[`src/f${i}.ts`].mutants.push({ id: `m${i}`, mutatorName: 'ConditionalExpression', status, location: {} });
  });
  return { files };
}

describe('computeMutationMetrics', () => {
  it('computes score from the detected/undetected split', () => {
    const metrics = computeMutationMetrics(
      reportWith(['Killed', 'Killed', 'Survived', 'NoCoverage', 'Timeout', 'Ignored', 'CompileError']),
    );
    expect(metrics.detected).toBe(3); // Killed x2 + Timeout
    expect(metrics.survived).toBe(1);
    expect(metrics.noCoverage).toBe(1);
    expect(metrics.valid).toBe(5); // NoCoverage counts as undetected but valid
    expect(metrics.score).toBe(60); // 3 / 5
    expect(metrics.coveredScore).toBe(75); // covered = detected + survived = 4
    expect(metrics.total).toBe(7); // valid 5 + ignored 1 + compileErrors 1
  });

  it('counts runtime errors as detected', () => {
    const metrics = computeMutationMetrics(reportWith(['Killed', 'RuntimeError', 'Survived']));
    expect(metrics.detected).toBe(2);
    expect(metrics.score).toBe((2 / 3) * 100);
  });

  it('scores 100 when no valid mutant exists', () => {
    expect(computeMutationMetrics(reportWith([])).score).toBe(100);
    expect(computeMutationMetrics(reportWith(['Ignored'])).score).toBe(100);
  });

  it('tolerates a missing files object', () => {
    expect(computeMutationMetrics({}).score).toBe(100);
    expect(computeMutationMetrics(null).total).toBe(0);
  });
});

describe('computeFileMetrics', () => {
  it('computes a score per file', () => {
    const metrics = computeFileMetrics({
      files: {
        'src/a.ts': { mutants: [{ status: 'Killed' }, { status: 'Survived' }] },
        'src/b.ts': { mutants: [{ status: 'Killed' }] },
      },
    });
    expect(metrics['src/a.ts'].score).toBeCloseTo(50);
    expect(metrics['src/b.ts'].score).toBeCloseTo(100);
  });

  it('tolerates a missing files object', () => {
    expect(computeFileMetrics(null)).toEqual({});
  });
});

describe('evaluateFileDeltas', () => {
  const fileMetrics = computeFileMetrics(
    reportWith(['Killed', 'Killed', 'Killed', 'Killed', 'Killed', 'Killed', 'Killed', 'Survived', 'Survived', 'Survived']),
  );

  it('fails only the files that fall more than delta below their floor', () => {
    const baseline = { 'src/f0.ts': { score: 80 } };
    const { failed, comparisons } = evaluateFileDeltas(
      { 'src/f0.ts': { score: 70 }, 'src/f1.ts': { score: 90 }, 'src/f2.ts': { score: 50 } },
      baseline,
      2,
    );
    expect(failed).toBe(true);
    expect(comparisons).toEqual([
      { file: 'src/f0.ts', current: 70, floor: 78, status: 'fail' },
      { file: 'src/f1.ts', current: 90, floor: null, status: 'new' },
      { file: 'src/f2.ts', current: 50, floor: null, status: 'new' },
    ]);
  });

  it('passes when no baseline exists', () => {
    const { failed, comparisons } = evaluateFileDeltas(fileMetrics, undefined, 2);
    expect(failed).toBe(false);
    expect(comparisons.every((comparison) => comparison.status === 'new')).toBe(true);
  });

  it('passes when every file holds at or above its floor', () => {
    const baseline = { 'src/f0.ts': { score: 80 } };
    expect(evaluateFileDeltas({ 'src/f0.ts': { score: 78 } }, baseline, 2).failed).toBe(false);
  });
});

describe('evaluateMutationDelta', () => {
  const metrics = computeMutationMetrics(reportWith(Array.from({ length: 10 }, (_, i) => (i < 8 ? 'Killed' : 'Survived'))));

  it('fails when the score drops below the baseline floor', () => {
    const baseline = { score: 80 };
    const withDrop = evaluateMutationDelta(
      computeMutationMetrics(reportWith(Array.from({ length: 10 }, (_, i) => (i < 7 ? 'Killed' : 'Survived')))),
      baseline,
      2,
    );
    expect(withDrop.armed).toBe(true);
    expect(withDrop.failed).toBe(true);
    expect(withDrop.floor).toBe(78);
    expect(withDrop.current).toBe(70);
  });

  it('passes when the score holds at or above the floor', () => {
    const result = evaluateMutationDelta(metrics, { score: 80 }, 2); // 80 >= 78
    expect(result.failed).toBe(false);
    const equal = evaluateMutationDelta(metrics, { score: metrics.score }, 0);
    expect(equal.failed).toBe(false);
  });

  it('records-and-defers (never fails) when no baseline exists', () => {
    const result = evaluateMutationDelta(metrics, null, 2);
    expect(result.armed).toBe(false);
    expect(result.failed).toBe(false);
  });

  it('treats a malformed baseline as missing', () => {
    expect(evaluateMutationDelta(metrics, {}, 2).armed).toBe(false);
    expect(evaluateMutationDelta(metrics, { score: 'high' }, 2).armed).toBe(false);
  });
});

describe('parseDelta', () => {
  it('defaults to 2.0', () => {
    expect(parseDelta(undefined)).toBe(2.0);
    expect(parseDelta('')).toBe(2.0);
  });

  it('parses a configured value', () => {
    expect(parseDelta('1.5')).toBe(1.5);
  });
});
