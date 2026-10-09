/**
 * @fileoverview Phase 9: tests for the mutation scope/shard planner.
 * The planner decides how many mutants CI pays for and how the work is split
 * across runners, so it is tested like the other gate tooling rather than
 * trusted because it is "just tooling".
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expandScope, resolveChangedScope, planShards, parseArgs, buildMatrix } from '../mutation-scope.mjs';

describe('expandScope', () => {
  let dir;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutation-scope-'));
    fs.mkdirSync(path.join(dir, 'src', 'shared'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src', 'utils'), { recursive: true });
    for (const file of ['src/shared/a.ts', 'src/shared/b.ts', 'src/utils/c.ts', 'src/shared/a.test.ts']) {
      fs.writeFileSync(path.join(dir, file), 'x');
    }
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('expands brace and star patterns to sorted posix paths', () => {
    expect(expandScope(['src/shared/{a,b}.ts', 'src/utils/*.ts'], dir)).toEqual(['src/shared/a.ts', 'src/shared/b.ts', 'src/utils/c.ts']);
  });

  it('de-duplicates overlapping patterns', () => {
    expect(expandScope(['src/shared/*.ts', 'src/shared/a.ts'], dir)).toEqual([
      'src/shared/a.test.ts',
      'src/shared/a.ts',
      'src/shared/b.ts',
    ]);
  });
});

describe('resolveChangedScope', () => {
  it('keeps only scope files the branch changed', () => {
    expect(resolveChangedScope(['a.ts', 'b.ts', 'c.ts'], new Set(['c.ts', 'x.ts']))).toEqual(['c.ts']);
  });

  it('accepts a plain array', () => {
    expect(resolveChangedScope(['a.ts', 'b.ts'], ['a.ts'])).toEqual(['a.ts']);
  });
});

describe('planShards', () => {
  it('balances files across shards and keeps every file exactly once', () => {
    const files = Array.from({ length: 7 }, (_, i) => `f${i}.ts`);
    const shards = planShards(files, 3);
    expect(shards.map((shard) => shard.shard)).toEqual([1, 2, 3]);
    expect(shards.map((shard) => shard.files.length).sort()).toEqual([2, 2, 3]);
    expect(shards.flatMap((shard) => shard.files).sort()).toEqual([...files].sort());
  });

  it('caps the shard count at the file count', () => {
    expect(planShards(['only.ts'], 4)).toHaveLength(1);
  });

  it('returns no shards for an empty scope', () => {
    expect(planShards([], 4)).toEqual([]);
  });

  it('gives heavy files their own shards first', () => {
    const sizes = { 'a.ts': 100, 'b.ts': 50, 'c.ts': 1 };
    const weights = planShards(Object.keys(sizes), 2, (file) => sizes[file]).map((shard) =>
      shard.files.reduce((total, file) => total + sizes[file], 0),
    );
    expect(weights).toEqual([100, 51]);
  });
});

describe('parseArgs', () => {
  it('reads defaults from the environment', () => {
    expect(parseArgs([], { MUTATION_MODE: 'changed', MUTATION_BASE: 'abc', MUTATION_SHARDS: '2' })).toMatchObject({
      mode: 'changed',
      base: 'abc',
      shards: 2,
      format: 'files',
      githubOutput: false,
    });
  });

  it('parses flags and overrides', () => {
    expect(parseArgs(['--full', '--base', 'HEAD~1', '--shards', '3', '--format', 'matrix', '--github-output'], {})).toMatchObject({
      mode: 'full',
      base: 'HEAD~1',
      shards: 3,
      format: 'matrix',
      githubOutput: true,
    });
  });
});

describe('buildMatrix', () => {
  it('comma-joins each shard for a Stryker --mutate value', () => {
    expect(buildMatrix([{ shard: 1, files: ['a.ts', 'b.ts'] }])).toEqual({ include: [{ shard: 1, files: 'a.ts,b.ts' }] });
  });
});
