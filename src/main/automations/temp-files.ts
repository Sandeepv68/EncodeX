/**
 * @fileoverview Temp-directory and intermediate-file helpers for automation runs.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AutomationTempContext } from './types';

function defaultAutomationTempRoot(context: AutomationTempContext): string {
  if (context.settings.tempDirectoryMode === 'app-data') {
    return path.join(context.userDataDir, 'automations', 'tmp');
  }
  return path.join(os.tmpdir(), 'encodex-automations');
}

/** Resolves the absolute temp root used by an automation run. */
export function resolveAutomationTempRoot(context: AutomationTempContext): string {
  const base = defaultAutomationTempRoot(context);
  const requested = context.runtimeTempRoot?.trim();
  if (!requested) return base;
  const candidate = path.resolve(base, requested);
  if (candidate === base || !candidate.startsWith(`${base}${path.sep}`)) {
    throw new Error('Automation temp root must stay within the automation temp directory');
  }
  return candidate;
}

/** Ensures the temp directory exists and returns its absolute path. */
export function ensureAutomationTempRoot(context: AutomationTempContext): string {
  const root = resolveAutomationTempRoot(context);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

/** Removes intermediate files unless the automation settings keep them. */
export function cleanupAutomationIntermediates(paths: string[], keepIntermediateFiles: boolean): void {
  if (keepIntermediateFiles) return;
  for (const filePath of paths) {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // Best-effort cleanup: failures should not mask run status.
    }
  }
}
