/**
 * @fileoverview Unit tests for the output-directory helper.
 *
 * The helper creates the folder an output file lives in before FFmpeg runs.
 * A failure must never throw: the conversion reports the real problem itself.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ensureOutputDirectory } from './ensure-output-dir';
import { expectAppLog } from '../../test-utils/crash-tripwire';

describe('ensureOutputDirectory', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'encodex-outdir-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('creates the directory of the output file', () => {
    ensureOutputDirectory(join(root, 'out', 'clip.mkv'));
    expect(existsSync(join(root, 'out'))).toBe(true);
  });

  it('does nothing without an output path', () => {
    ensureOutputDirectory('');
    expect(existsSync(root)).toBe(true);
  });

  it('does nothing when the output has no directory part', () => {
    ensureOutputDirectory('clip.mkv');
    expect(existsSync(root)).toBe(true);
  });

  it('logs a warning instead of throwing when the directory cannot be created', () => {
    expectAppLog('warn', 'main/fs/ensure-output-dir');
    const file = join(root, 'file.txt');
    writeFileSync(file, 'x');
    // The parent of the output path is an existing file, so creating it fails.
    expect(() => ensureOutputDirectory(join(file, 'clip.mkv'))).not.toThrow();
  });
});
