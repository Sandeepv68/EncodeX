import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getBuildPaths, getFfmpegPath, generateTestMedia } from '../helpers';

const electronBin = (() => {
  try {
    return require('electron') as string;
  } catch {
    return 'electron';
  }
})();

const IS_E2E = process.env.E2E === 'true' || !!process.env.CI;
const IS_WIN = process.platform === 'win32';
const CAN_SCAN_PROC = fs.existsSync('/proc');

const HAS_FFMPEG = (() => {
  try {
    const ffmpegStatic = require('ffmpeg-static') as string;
    if (fs.existsSync(ffmpegStatic)) return true;
  } catch {
    /* fall through */
  }
  try {
    return fs.existsSync(getFfmpegPath());
  } catch {
    return false;
  }
})();

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

function spawnCli(args: string[]): import('child_process').ChildProcessWithoutNullStreams {
  return spawn(electronBin, electronArgs(['--cli', ...args]));
}

/**
 * Resolves once `condition` returns true or the timeout elapses (then throws).
 * Used to wait for a spawned CLI to reach a deterministic point before a test
 * acts on it (e.g. until ffmpeg has started writing the output file).
 */
async function waitFor(condition: () => boolean, timeoutMs = 30000, stepMs = 150): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (condition()) return;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor: condition never became true');
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}

function waitExit(
  child: import('child_process').ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<{ status: number | null; signal: string | null }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (code: number | null, signal: string | null): void => {
      if (settled) return;
      settled = true;
      resolve({ status: code, signal });
    };
    const timer = setTimeout(() => {
      finish(null, null);
      child.kill('SIGKILL');
    }, timeoutMs);
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      finish(code, signal);
    });
  });
}

/**
 * Asserts the "stderr stack-trace shape" contract: on every expected error path
 * stderr must carry single-line human messages and never a Node stack trace.
 */
function expectCleanStderr(stderr: string): void {
  expect(stderr).not.toMatch(/^\s+at\s/m);
  expect(stderr).not.toMatch(/\bat\s+\S+\.(ts|js|mjs|cjs):\d+/);
  expect(stderr).not.toMatch(/\bnode:internal\//);
  expect(stderr).not.toMatch(/TypeError|ReferenceError|RangeError|SyntaxError/);
}

/**
 * Scans the Linux procfs `cmdline` files for a process still running with
 * `marker` in its arguments. Used to prove no orphaned ffmpeg child survives a
 * cancelled conversion. A missing procfs (Windows/macOS) reports no match.
 */
function processWithArg(marker: string): boolean {
  if (!CAN_SCAN_PROC) return false;
  let entries: string[];
  try {
    entries = fs.readdirSync('/proc');
  } catch {
    return false;
  }
  for (const pid of entries) {
    if (!/^\d+$/.test(pid)) continue;
    let cmdline = '';
    try {
      cmdline = fs.readFileSync(path.join('/proc', pid, 'cmdline'), 'utf8');
    } catch {
      continue;
    }
    if (cmdline.includes(marker)) return true;
  }
  return false;
}

/**
 * Whether a POSIX environment where `process.getuid` exists is running as
 * root. Root ignores file permission bits, so the read-only output variant is
 * skipped there (the write genuinely succeeds for root).
 */
const RUNNING_AS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

/**
 * Marks a file read-only using Node's simulated chmod, which maps to the
 * FILE_ATTRIBUTE_READONLY flag on Windows and the read bits on POSIX.
 */
function makeReadonly(filePath: string): void {
  fs.chmodSync(filePath, 0o444);
}

/**
 * Builds a deliberately long (60 s, 720p30) test clip so a conversion stays
 * in-flight long enough for a signal test to interrupt it mid-encode. The
 * source is encoded at `ultrafast` so the fixture itself is cheap to produce.
 * @param {string} dir - Directory to place the clip in.
 * @returns {string} Absolute path of the generated clip.
 */
function buildLongInput(dir: string): string {
  const input = path.join(dir, 'long.mp4');
  const ffmpeg = getFfmpegPath();
  const result = spawnSync(
    ffmpeg,
    [
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=60:size=1280x720:rate=30',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=60',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      '-y',
      input,
    ],
    { timeout: 120000 },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to generate long test media: ${result.stderr.toString()}`);
  }
  return input;
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

const expectCleanHumanError = (stderr: string): void => {
  expectCleanStderr(stderr);
  expect(stderr).toContain('✖');
};

describe.runIf(IS_E2E)('CLI real-subprocess hostile rows', () => {
  let workDir: string;
  let longInput: string;

  beforeAll(() => {
    if (!HAS_FFMPEG) return;
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-cli-hostile-'));
    longInput = buildLongInput(workDir);
  }, 150000);

  afterAll(() => {
    if (workDir) {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        /* best-effort cleanup */
      }
    }
  });

  it.runIf(HAS_FFMPEG)(
    'cancels the transcoder on SIGTERM mid-convert (no orphan on POSIX, prompt exit on Windows)',
    async () => {
      const out = path.join(workDir, 'out.mp4');
      const child = spawnCli(['convert', longInput, out]);
      try {
        await waitFor(() => fs.existsSync(out));
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (child.exitCode !== null) throw new Error('conversion completed before SIGTERM could be sent');
        child.kill('SIGTERM');
        const res = await waitExit(child, 20000);
        if (IS_WIN) {
          // Windows delivers SIGTERM as an unconditional process termination;
          // the JS handler cannot run, so the contract is a prompt exit.
          expect(res.signal).toBe('SIGTERM');
        } else {
          expect(res.status).toBe(EXIT.CANCELLED);
          expect(processWithArg(path.basename(out))).toBe(false);
        }
      } finally {
        if (child.exitCode === null) child.kill('SIGKILL');
      }
    },
    120000,
  );

  it.runIf(HAS_FFMPEG)(
    'cancels the transcoder on SIGINT mid-convert (no orphan on POSIX, prompt exit on Windows)',
    async () => {
      const out = path.join(workDir, 'out-sigint.mp4');
      const child = spawnCli(['convert', longInput, out]);
      try {
        await waitFor(() => fs.existsSync(out));
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (child.exitCode !== null) throw new Error('conversion completed before SIGINT could be sent');
        child.kill('SIGINT');
        const res = await waitExit(child, 20000);
        if (IS_WIN) {
          expect(res.signal).toBe('SIGINT');
        } else {
          expect(res.status).toBe(EXIT.CANCELLED);
          expect(processWithArg(path.basename(out))).toBe(false);
        }
      } finally {
        if (child.exitCode === null) child.kill('SIGKILL');
      }
    },
    120000,
  );

  it.runIf(HAS_FFMPEG)(
    'fails cleanly when the output cannot be written (disk-full / unwritable surface)',
    async () => {
      const blocker = path.join(workDir, 'blocker.txt');
      fs.writeFileSync(blocker, '');
      const input = generateTestMedia(workDir, 'tiny.mp4');
      const res = await runCli(['convert', input, '--output', path.join(blocker, 'out.mp4')], 60000);
      expect(res.status).toBe(EXIT.ERROR);
      expectCleanHumanError(res.stderr);
    },
    90000,
  );

  it.runIf(HAS_FFMPEG && !RUNNING_AS_ROOT)(
    'reports a clean single-line error when the output file is read-only',
    async () => {
      const input = generateTestMedia(workDir, 'tiny-readonly.mp4');
      const out = path.join(workDir, 'locked.mp4');
      fs.writeFileSync(out, 'sentinel');
      makeReadonly(out);
      try {
        const res = await runCli(['convert', input, '--output', out], 60000);
        expect(res.status).toBe(EXIT.ERROR);
        expectCleanHumanError(res.stderr);
      } finally {
        try {
          fs.chmodSync(out, 0o644);
        } catch {
          /* best-effort */
        }
      }
    },
    90000,
  );

  it('fails cleanly when the input path is a directory', async () => {
    const dir = path.join(workDir, 'adir');
    fs.mkdirSync(dir, { recursive: true });
    const res = await runCli(['info', dir], 30000);
    expect([EXIT.ERROR, EXIT.NOT_FOUND]).toContain(res.status);
    expectCleanStderr(res.stderr);
  });

  it('does not crash on a 32,000-character input filename', async () => {
    const long = `${'a'.repeat(32000)}.mp4`;
    const res = await runCli(['convert', path.join(workDir, long), path.join(workDir, 'out.mp4')], 30000);
    expect(res.status).not.toBeNull();
    expect([EXIT.NOT_FOUND, EXIT.USAGE, EXIT.ERROR]).toContain(res.status);
    expectCleanHumanError(res.stderr);
  }, 60000);

  it.runIf(HAS_FFMPEG)(
    'reports an unknown video preset as a clean usage error',
    async () => {
      const input = generateTestMedia(workDir, 'tiny-preset.mp4');
      const res = await runCli(['convert', input, '--preset', 'no-such-preset'], 30000);
      expect(res.status).toBe(EXIT.USAGE);
      expectCleanHumanError(res.stderr);
    },
    60000,
  );

  it.each([
    { name: 'unknown flag', args: ['--unknown-flag'], statuses: [EXIT.USAGE] },
    { name: 'missing required value', args: ['--output'], statuses: [EXIT.USAGE] },
    {
      name: 'invalid quality value',
      args: ['--input', 'nonexistent.mp4', '--quality', '999'],
      statuses: [EXIT.USAGE, EXIT.NOT_FOUND, EXIT.ERROR],
    },
    { name: 'negative concurrency', args: ['--concurrency', '-1'], statuses: [EXIT.USAGE, EXIT.ERROR] },
    { name: 'missing convert input', args: ['convert', 'nonexistent.mp4'], statuses: [EXIT.NOT_FOUND] },
  ])('prints a single-line human error with no stack trace for: $name', async ({ args, statuses }) => {
    const res = await runCli(args, 30000);
    expect(statuses).toContain(res.status);
    expectCleanHumanError(res.stderr);
  });
});
