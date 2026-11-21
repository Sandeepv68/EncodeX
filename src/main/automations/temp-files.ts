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

export function resolveAutomationRunDirectory(context: AutomationTempContext, runId: string): string {
  if (!runId || runId === '.' || runId === '..' || /[\\/]/.test(runId)) {
    throw new Error('Automation run id must be a single path segment');
  }
  return path.join(resolveAutomationTempRoot(context), runId);
}

export function ensureAutomationRunDirectory(context: AutomationTempContext, runId: string): string {
  const runDirectory = resolveAutomationRunDirectory(context, runId);
  fs.mkdirSync(runDirectory, { recursive: true });
  return runDirectory;
}

export function cleanupAutomationRunDirectory(runDirectory: string, keepIntermediateFiles: boolean): void {
  if (keepIntermediateFiles) return;
  try {
    fs.rmSync(runDirectory, { recursive: true, force: true });
  } catch {}
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
