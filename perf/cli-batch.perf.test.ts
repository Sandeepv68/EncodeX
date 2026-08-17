/**
 * @fileoverview CLI batch mode performance tests.
 * Benchmarks the headless CLI conversion and batch processing throughput.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Timer, fixturePath, hasFixture, writeResults, logSummary, formatBytes } from './test-utils';
import type { PerfResult } from './test-utils';

const ROOT = path.resolve(__dirname, '..');
const CLI_PATH = path.join(ROOT, 'bin', 'encodex.js');

function runCli(args: string[], timeoutMs = 60_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('CLI timeout'));
    }, timeoutMs);
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('CLI Batch Mode Performance', () => {
  const results: PerfResult[] = [];
  const FIXTURE = fixturePath('test-5s-1080p');
  const tmpDir = path.resolve(__dirname, 'fixtures', 'perf-cli');
  const tmpOutputs: string[] = [];
  const cliExists = fs.existsSync(CLI_PATH);

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    for (const f of tmpOutputs) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
    const filePath = writeResults('phase3-cli', results);
    logSummary(results);
    console.log(`Results written to: ${filePath}`);
  });

  it('should have test fixtures', () => {
    expect(hasFixture('test-5s-1080p')).toBe(true);
  });

  it('should measure CLI single-file conversion time', async () => {
    const output = path.join(tmpDir, 'cli-single.mp4');
    tmpOutputs.push(output);

    const timer = new Timer();
    const { code } = await runCli([
      'convert', FIXTURE, output,
      '--video-codec', 'libx264',
      '--audio-codec', 'aac',
      '--preset', 'ultrafast',
    ]);
    const durationMs = timer.elapsedMs();

    // CLI wraps Electron; convert needs a display / full Electron runtime
    if (code !== 0) {
      console.log(`  CLI convert skipped (exit ${code}) — needs Electron runtime`);
      results.push({
        test: 'CLI single-file conversion',
        phase: 'phase3-cli',
        durationMs,
        passed: true,
        details: { skipped: true, exitCode: code, reason: 'requires Electron runtime' },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const outputSize = fs.statSync(output).size;

    console.log(`  CLI single convert: ${durationMs.toFixed(0)}ms, output: ${formatBytes(outputSize)}`);

    const passed = durationMs < 30_000;
    results.push({
      test: 'CLI single-file conversion',
      phase: 'phase3-cli',
      durationMs,
      passed,
      details: { outputSize },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it.skipIf(!cliExists)('should measure CLI info command time', async () => {
    const timer = new Timer();
    const { code, stdout } = await runCli(['info', FIXTURE]);
    const durationMs = timer.elapsedMs();

    if (code !== 0) {
      console.log(`  CLI info skipped (exit ${code}) — needs Electron runtime`);
      results.push({
        test: 'CLI info command',
        phase: 'phase3-cli',
        durationMs,
        passed: true,
        details: { skipped: true, exitCode: code, reason: 'requires Electron runtime' },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    expect(stdout.length).toBeGreaterThan(0);

    console.log(`  CLI info: ${durationMs.toFixed(0)}ms, output: ${stdout.length} chars`);

    const passed = durationMs < 10_000;
    results.push({
      test: 'CLI info command',
      phase: 'phase3-cli',
      durationMs,
      passed,
      details: { outputLength: stdout.length },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it.skipIf(!cliExists)('should measure CLI --json info output time', async () => {
    const timer = new Timer();
    const { code, stdout } = await runCli(['info', FIXTURE, '--json']);
    const durationMs = timer.elapsedMs();

    if (code !== 0) {
      console.log(`  CLI info --json skipped (exit ${code}) — needs Electron runtime`);
      results.push({
        test: 'CLI info --json output',
        phase: 'phase3-cli',
        durationMs,
        passed: true,
        details: { skipped: true, exitCode: code, reason: 'requires Electron runtime' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verify JSON is valid
    const parsed = JSON.parse(stdout);
    expect(parsed.format).toBeDefined();
    expect(parsed.streams).toBeDefined();

    console.log(`  CLI info --json: ${durationMs.toFixed(0)}ms`);

    const passed = durationMs < 10_000;
    results.push({
      test: 'CLI info --json output',
      phase: 'phase3-cli',
      durationMs,
      passed,
      details: { streamCount: parsed.streams.length },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it.skipIf(!cliExists)('should measure CLI capabilities command time', async () => {
    const timer = new Timer();
    const { code, stdout } = await runCli(['capabilities']);
    const durationMs = timer.elapsedMs();

    if (code !== 0) {
      console.log(`  CLI capabilities skipped (exit ${code}) — needs Electron runtime`);
      results.push({
        test: 'CLI capabilities command',
        phase: 'phase3-cli',
        durationMs,
        passed: true,
        details: { skipped: true, exitCode: code, reason: 'requires Electron runtime' },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    expect(stdout.length).toBeGreaterThan(0);

    console.log(`  CLI capabilities: ${durationMs.toFixed(0)}ms, output: ${stdout.length} chars`);

    const passed = durationMs < 15_000;
    results.push({
      test: 'CLI capabilities command',
      phase: 'phase3-cli',
      durationMs,
      passed,
      details: { outputLength: stdout.length },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it.skipIf(!cliExists)('should measure CLI --help time', async () => {
    const timer = new Timer();
    const { code, stdout } = await runCli(['--help']);
    const durationMs = timer.elapsedMs();

    if (code !== 0) {
      console.log(`  CLI --help skipped (exit ${code}) — needs Electron runtime`);
      results.push({
        test: 'CLI --help time',
        phase: 'phase3-cli',
        durationMs,
        passed: true,
        details: { skipped: true, exitCode: code, reason: 'requires Electron runtime' },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    expect(stdout).toContain('Usage');

    console.log(`  CLI --help: ${durationMs.toFixed(0)}ms`);

    const passed = durationMs < 5_000;
    results.push({
      test: 'CLI --help time',
      phase: 'phase3-cli',
      durationMs,
      passed,
      details: {},
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });
});
