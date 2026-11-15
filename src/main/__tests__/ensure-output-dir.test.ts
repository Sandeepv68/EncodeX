import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { ensureOutputDirectory } from '../fs/ensure-output-dir';

describe('ensureOutputDirectory', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'encodex-outdir-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the directory of the output file', () => {
    const target = path.join(dir, 'nested', 'folder', 'clip.mp4');
    ensureOutputDirectory(target);
    expect(existsSync(path.join(dir, 'nested', 'folder'))).toBe(true);
  });

  it('does nothing for a file without a directory part', () => {
    expect(() => ensureOutputDirectory('clip.mp4')).not.toThrow();
  });

  it('does nothing for an empty output path', () => {
    expect(() => ensureOutputDirectory('')).not.toThrow();
  });

  it('keeps an existing directory', () => {
    const target = path.join(dir, 'existing', 'clip.mp4');
    ensureOutputDirectory(target);
    expect(() => ensureOutputDirectory(target)).not.toThrow();
    expect(existsSync(path.join(dir, 'existing'))).toBe(true);
  });
});

vi.mock('../../shared/logger', () => {
  class Logger {
    debug(): void {}
    info(): void {}
    warn(): void {}
    error(): void {}
  }
  return { Logger };
});
