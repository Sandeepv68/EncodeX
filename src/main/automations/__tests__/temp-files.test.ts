import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  cleanupAutomationIntermediates,
  cleanupAutomationRunDirectory,
  ensureAutomationRunDirectory,
  resolveAutomationRunDirectory,
  resolveAutomationTempRoot,
} from '../temp-files';
import type { AutomationTempContext } from '../types';

describe('automation temp files', () => {
  let userDataDir: string;
  let context: AutomationTempContext;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'encodex-automation-temp-'));
    context = {
      userDataDir,
      settings: { tempDirectoryMode: 'app-data', keepIntermediateFiles: false },
    };
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('resolves a run directory without creating any temp directories', () => {
    const root = resolveAutomationTempRoot(context);
    const runDirectory = resolveAutomationRunDirectory(context, 'run-1');

    expect(runDirectory).toBe(join(root, 'run-1'));
    expect(existsSync(root)).toBe(false);
  });

  it('rejects escaping temp roots and invalid run ids without touching the filesystem', () => {
    expect(() => resolveAutomationTempRoot({ ...context, runtimeTempRoot: '../escape' })).toThrow(/temp root/);
    expect(() => resolveAutomationRunDirectory(context, '../escape')).toThrow(/run id/);
    expect(existsSync(join(userDataDir, 'automations', 'tmp'))).toBe(false);
  });

  it('removes the whole run directory on cleanup', () => {
    const runDirectory = ensureAutomationRunDirectory(context, 'run-clean');
    mkdirSync(join(runDirectory, 'nested'), { recursive: true });
    writeFileSync(join(runDirectory, 'nested', 'artifact.bin'), 'data', 'utf8');
    expect(existsSync(runDirectory)).toBe(true);

    cleanupAutomationRunDirectory(runDirectory, false);

    expect(existsSync(runDirectory)).toBe(false);
    expect(existsSync(join(userDataDir, 'automations', 'tmp'))).toBe(true);
  });

  it('keeps the whole run directory when intermediates are retained', () => {
    const runDirectory = ensureAutomationRunDirectory(context, 'run-keep');
    writeFileSync(join(runDirectory, 'artifact.bin'), 'data', 'utf8');

    cleanupAutomationRunDirectory(runDirectory, true);

    expect(existsSync(join(runDirectory, 'artifact.bin'))).toBe(true);
  });

  it('still removes individual intermediate files through the legacy helper', () => {
    const kept = join(userDataDir, 'kept.bin');
    const removed = join(userDataDir, 'removed.bin');
    writeFileSync(kept, 'data', 'utf8');
    writeFileSync(removed, 'data', 'utf8');

    cleanupAutomationIntermediates([kept, removed], true);
    expect(existsSync(kept)).toBe(true);
    expect(existsSync(removed)).toBe(true);

    cleanupAutomationIntermediates([removed], false);
    expect(existsSync(kept)).toBe(true);
    expect(existsSync(removed)).toBe(false);
  });
});
