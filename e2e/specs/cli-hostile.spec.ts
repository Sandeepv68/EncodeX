import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';
import { getBuildPaths } from '../helpers';

const electronBin = (() => {
  try {
    return require('electron') as string;
  } catch {
    return 'electron';
  }
})();

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;

const EXIT = {
  SUCCESS: 0,
  ERROR: 1,
  USAGE: 2,
  CANCELLED: 3,
  NOT_FOUND: 4,
  TIMEOUT: 5,
} as const;

function electronArgs(scriptArgs: string[]): string[] {
  const baseArgs = [path.join(getBuildPaths().root, 'dist', 'main', 'index.js'), ...scriptArgs];
  return ['--no-sandbox', '--disable-gpu', ...baseArgs];
}

function runCli(args: string[], timeout: number): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(electronBin, electronArgs(['--cli', ...args]));
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ status: null, stdout, stderr });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ status: timedOut ? null : code, stdout, stderr });
    });
    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
  });
}

describe.runIf(IS_E2E)('CLI hostile input', () => {
  it('returns usage error for unknown flag', async () => {
    const res = await runCli(['--unknown-flag'], 10000);
    expect(res.status).toBe(EXIT.USAGE);
    expect(res.stderr.toLowerCase()).not.toContain('error stack');
  });

  it('returns usage error for missing required values', async () => {
    const res = await runCli(['--output'], 10000);
    expect(res.status).toBe(EXIT.USAGE);
  });

  it('rejects invalid quality value', async () => {
    const res = await runCli(['--input', 'nonexistent.mp4', '--quality', '999'], 10000);
    expect([EXIT.USAGE, EXIT.NOT_FOUND, EXIT.ERROR]).toContain(res.status);
    expect(res.stderr).not.toMatch(/stack trace|TypeError: stack/i);
  });

  it('rejects negative concurrency', async () => {
    const res = await runCli(['--concurrency', '-1'], 10000);
    expect([EXIT.USAGE, EXIT.ERROR]).toContain(res.status);
  });

  it('handles extremely long filenames', async () => {
    const long = 'a'.repeat(4096) + '.mp4';
    const res = await runCli(['--input', long], 10000);
    expect(res.status !== EXIT.CANCELLED).toBe(true);
  });
});
