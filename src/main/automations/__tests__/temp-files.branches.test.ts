import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ensureAutomationTempRoot, resolveAutomationTempRoot } from '../temp-files';
import type { AutomationTempContext } from '../types';

const systemRoot = join(tmpdir(), 'encodex-automations');
const runtimeRoot = `branch-${process.pid}-${Date.now()}`;
const resolvedRoot = join(systemRoot, runtimeRoot);

describe('automation temp-file branches', () => {
  afterEach(() => {
    rmSync(resolvedRoot, { recursive: true, force: true });
  });

  it('uses the system temp root and creates it on demand', () => {
    const context: AutomationTempContext = {
      userDataDir: join(tmpdir(), 'unused-automation-user-data'),
      settings: { tempDirectoryMode: 'system-temp', keepIntermediateFiles: false },
      runtimeTempRoot: runtimeRoot,
    };

    expect(resolveAutomationTempRoot(context)).toBe(resolvedRoot);
    expect(ensureAutomationTempRoot(context)).toBe(resolvedRoot);
    expect(existsSync(resolvedRoot)).toBe(true);
  });
});
