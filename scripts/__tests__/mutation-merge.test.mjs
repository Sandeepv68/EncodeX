/**
 * @fileoverview Phase 9: tests for the shard-report merger.
 * The merger feeds `scripts/mutation-delta.mjs`, so a dropped or duplicated
 * file would silently move the gate; it is tested rather than trusted.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mergeReports, collectReportFiles } from '../mutation-merge.mjs';

const report = (files) => ({ schemaVersion: '2', thresholds: { high: 80, low: 70 }, files });

const toPosix = (value) => value.split(path.sep).join('/');

describe('mergeReports', () => {
  it('unions the file maps and keeps the first report metadata', () => {
    const a = report({ 'src/a.ts': { language: 'typescript', mutants: [{ id: 'a0' }] } });
    const b = report({ 'src/b.ts': { language: 'typescript', mutants: [{ id: 'b0' }] } });
    const merged = mergeReports([a, b]);
    expect(Object.keys(merged.files).sort()).toEqual(['src/a.ts', 'src/b.ts']);
    expect(merged.files['src/a.ts'].mutants).toHaveLength(1);
    expect(merged.schemaVersion).toBe('2');
    expect(merged.thresholds).toEqual({ high: 80, low: 70 });
  });

  it('concatenates mutants when two shards overlap a file', () => {
    const merged = mergeReports([report({ 'src/a.ts': { mutants: [{ id: '0' }] } }), report({ 'src/a.ts': { mutants: [{ id: '1' }] } })]);
    expect(merged.files['src/a.ts'].mutants.map((mutant) => mutant.id)).toEqual(['0', '1']);
  });

  it('ignores malformed reports', () => {
    expect(mergeReports([null, 'x', report({})]).files).toEqual({});
  });
});

describe('collectReportFiles', () => {
  let dir;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutation-merge-'));
    fs.mkdirSync(path.join(dir, 'shard-1'));
    fs.mkdirSync(path.join(dir, 'shard-2'));
    fs.writeFileSync(path.join(dir, 'shard-1', 'mutation.json'), '{}');
    fs.writeFileSync(path.join(dir, 'shard-2', 'mutation.json'), '{}');
    fs.writeFileSync(path.join(dir, 'shard-2', 'mutation.html'), 'x');
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('walks directories and keeps only mutation.json', () => {
    expect(collectReportFiles([dir]).map(toPosix).sort()).toEqual([
      `${toPosix(dir)}/shard-1/mutation.json`,
      `${toPosix(dir)}/shard-2/mutation.json`,
    ]);
  });

  it('ignores paths that do not exist', () => {
    expect(collectReportFiles([path.join(dir, 'nope')])).toEqual([]);
  });
});
