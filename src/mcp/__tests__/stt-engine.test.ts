/**
 * @fileoverview Tests for the whisper.cpp STT engine adapter
 * ({@link createWhisperCliEngine}).
 *
 * The engine spawns a local whisper CLI and reads its JSON/TXT output back, so
 * `child_process` `spawn`/`spawnSync` and the `fs` reads are mocked and every
 * child is an EventEmitter fake. No real binary or model file is needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { createWhisperCliEngine } from '../stt-engine';

const { spawnMock, spawnSyncMock, existsSyncMock, readFileSyncMock, rmSyncMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  spawnSyncMock: vi.fn(),
  existsSyncMock: vi.fn(),
  readFileSyncMock: vi.fn(),
  rmSyncMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
  spawnSync: spawnSyncMock,
  default: { spawn: spawnMock, spawnSync: spawnSyncMock },
}));
vi.mock('fs', () => ({
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock,
  rmSync: rmSyncMock,
  default: { existsSync: existsSyncMock, readFileSync: readFileSyncMock, rmSync: rmSyncMock },
}));

const WHISPER_ENV_KEYS = ['ENCODEX_WHISPER_BIN', 'ENCODEX_WHISPER_MODEL'] as const;

/** A fake whisper child; stderr/data are EventEmitters like real child streams. */
class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn().mockReturnValue(undefined);
}

/** A valid whisper.cpp `-oj` JSON payload (transcription array form). */
function whisperJson(): string {
  return JSON.stringify({ language: 'en', transcription: [{ offsets: { from: 0, to: 1200 }, text: 'Hello' }] });
}

/**
 * Scripts `spawn` to return a child that emits stderr and a close event on a
 * later task, then resolves `run`.
 */
function resolveRun(code: number, stderrText = '') {
  const child = new FakeChild();
  setImmediate(() => {
    if (stderrText) child.stderr.emit('data', Buffer.from(stderrText));
    child.emit('close', code);
  });
  return child;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of WHISPER_ENV_KEYS) {
    delete process.env[key];
  }
  spawnMock.mockImplementation(() => resolveRun(0));
  spawnSyncMock.mockReturnValue({ error: undefined, status: 0 });
  existsSyncMock.mockReturnValue(true);
  readFileSyncMock.mockImplementation(() => whisperJson());
  rmSyncMock.mockReturnValue(undefined);
});

afterEach(() => {
  for (const key of WHISPER_ENV_KEYS) {
    delete process.env[key];
  }
  vi.useRealTimers();
});

describe('createWhisperCliEngine', () => {
  it('exposes a stable id and label', () => {
    const engine = createWhisperCliEngine();
    expect(engine.id).toBe('whisper.cpp');
    expect(engine.label).toBe('whisper.cpp (local)');
  });

  it('reports available only when a binary and a model both resolve', async () => {
    process.env.ENCODEX_WHISPER_BIN = 'C:\\whisper\\whisper-cli.exe';
    process.env.ENCODEX_WHISPER_MODEL = 'C:\\models\\ggml-base.bin';
    expect(await createWhisperCliEngine().available()).toBe(true);

    delete process.env.ENCODEX_WHISPER_MODEL;
    expect(await createWhisperCliEngine().available()).toBe(false);

    delete process.env.ENCODEX_WHISPER_BIN;
    process.env.ENCODEX_WHISPER_MODEL = 'C:\\models\\ggml-base.bin';
    spawnSyncMock.mockReturnValue({ error: new Error('ENOENT'), status: -1 });
    expect(await createWhisperCliEngine().available()).toBe(false);
  });

  it('discovers a binary on PATH by probing the candidates with --help', async () => {
    process.env.ENCODEX_WHISPER_MODEL = 'C:\\models\\ggml-base.bin';
    spawnSyncMock.mockImplementation((candidate: string) => ({
      error: candidate === 'whisper-cli' || candidate === 'whisper' ? new Error('missing') : undefined,
      status: 0,
    }));
    expect(await createWhisperCliEngine().available()).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledWith('whisper-cli', ['--help'], { timeout: 5000, windowsHide: true });
    expect(spawnSyncMock).toHaveBeenCalledWith('whisper', ['--help'], { timeout: 5000, windowsHide: true });
    expect(spawnSyncMock).toHaveBeenCalledWith('whisper.cpp', ['--help'], { timeout: 5000, windowsHide: true });
  });

  it('is unavailable when every candidate probe fails', async () => {
    spawnSyncMock.mockReturnValue({ error: new Error('ENOENT'), status: -1 });
    expect(await createWhisperCliEngine().available()).toBe(false);
  });

  it('fails with TRANSCRIPTION_UNAVAILABLE when no binary can be found', async () => {
    spawnSyncMock.mockReturnValue({ error: new Error('ENOENT'), status: -1 });
    try {
      await createWhisperCliEngine().transcribe('C:\\audio\\clip.wav');
      expect.unreachable('expected TRANSCRIPTION_UNAVAILABLE');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('TRANSCRIPTION_UNAVAILABLE');
    }
  });

  it('fails with TRANSCRIPTION_UNAVAILABLE when no model is configured', async () => {
    process.env.ENCODEX_WHISPER_BIN = 'whisper-cli';
    try {
      await createWhisperCliEngine().transcribe('C:\\audio\\clip.wav');
      expect.unreachable('expected TRANSCRIPTION_UNAVAILABLE');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('TRANSCRIPTION_UNAVAILABLE');
    }
  });

  it('transcribes through the parsed whisper JSON and cleans up outputs', async () => {
    process.env.ENCODEX_WHISPER_BIN = 'whisper-cli';
    process.env.ENCODEX_WHISPER_MODEL = 'C:\\models\\ggml-base.bin';
    existsSyncMock.mockImplementation((p: string) => p.endsWith('.json'));
    const transcript = await createWhisperCliEngine().transcribe('C:\\audio\\clip.wav', { language: 'en' });
    expect(transcript.segments).toEqual([{ start: 0, end: 1.2, text: 'Hello' }]);
    expect(transcript.language).toBe('en');

    const [command, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(command).toBe('whisper-cli');
    expect(args).toEqual(expect.arrayContaining(['-m', 'C:\\models\\ggml-base.bin', '-f', 'C:\\audio\\clip.wav', '-oj']));
    expect(args).toContain('-l');
    expect(args).toContain('en');

    for (const call of rmSyncMock.mock.calls) {
      const [target] = call as [string, { force: boolean }];
      expect(target).toMatch(/encodex-stt-[0-9a-f]{12}(\.json|\.txt|\.srt|\.vtt)$/);
      expect(call[1]).toEqual({ force: true });
    }
    expect(rmSyncMock).toHaveBeenCalledTimes(4);
  });

  it('prefers an explicit modelPath and skips the -l flag without a language', async () => {
    process.env.ENCODEX_WHISPER_BIN = 'whisper-cli';
    const transcript = await createWhisperCliEngine().transcribe('C:\\audio\\clip.wav', { modelPath: 'C:\\models\\custom.bin' });
    expect(transcript.segments).toHaveLength(1);
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toEqual(expect.arrayContaining(['-m', 'C:\\models\\custom.bin']));
    expect(args).not.toContain('-l');
  });

  it('falls back to the whisper TXT output when no JSON was produced', async () => {
    process.env.ENCODEX_WHISPER_BIN = 'whisper-cli';
    process.env.ENCODEX_WHISPER_MODEL = 'C:\\models\\ggml-base.bin';
    existsSyncMock.mockImplementation((p: string) => p.endsWith('.txt') && !p.endsWith('.json'));
    readFileSyncMock.mockImplementation(() => 'Hello world');
    const transcript = await createWhisperCliEngine().transcribe('C:\\audio\\clip.wav');
    expect(transcript.segments).toEqual([{ start: 0, end: 0, text: 'Hello world' }]);
    expect(transcript.engine).toBe('whisper.cpp');
  });

  it('fails with TRANSCRIPTION_UNAVAILABLE when whisper produced no output', async () => {
    process.env.ENCODEX_WHISPER_BIN = 'whisper-cli';
    process.env.ENCODEX_WHISPER_MODEL = 'C:\\models\\ggml-base.bin';
    existsSyncMock.mockReturnValue(false);
    spawnMock.mockImplementation(() => resolveRun(1, 'model failed to load'));
    try {
      await createWhisperCliEngine().transcribe('C:\\audio\\clip.wav');
      expect.unreachable('expected TRANSCRIPTION_UNAVAILABLE');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('TRANSCRIPTION_UNAVAILABLE');
      expect(String((err as { message?: string }).message)).toContain('model failed to load');
    }
  });

  it('fails with TRANSCRIPTION_UNAVAILABLE when the run times out', async () => {
    process.env.ENCODEX_WHISPER_BIN = 'whisper-cli';
    process.env.ENCODEX_WHISPER_MODEL = 'C:\\models\\ggml-base.bin';
    vi.useFakeTimers();
    const child = new FakeChild();
    spawnMock.mockImplementation(() => child);
    const pending = createWhisperCliEngine().transcribe('C:\\audio\\clip.wav', { timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1001);
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    child.emit('close', -1);
    await expect(pending).rejects.toMatchObject({
      code: 'TRANSCRIPTION_UNAVAILABLE',
      message: expect.stringContaining('timed out'),
    });
  });

  it('rejects when spawned process emits an error event', async () => {
    process.env.ENCODEX_WHISPER_BIN = 'whisper-cli';
    process.env.ENCODEX_WHISPER_MODEL = 'C:\\models\\ggml-base.bin';
    const child = new FakeChild();
    spawnMock.mockImplementation(() => child);
    const pending = createWhisperCliEngine().transcribe('C:\\audio\\clip.wav');
    child.emit('error', new Error('ENOENT'));
    await expect(pending).rejects.toThrow('ENOENT');
  });

  it('rejects when spawn itself throws', async () => {
    process.env.ENCODEX_WHISPER_BIN = 'whisper-cli';
    process.env.ENCODEX_WHISPER_MODEL = 'C:\\models\\ggml-base.bin';
    spawnMock.mockImplementation(() => {
      throw new Error('spawn boom');
    });
    await expect(createWhisperCliEngine().transcribe('C:\\audio\\clip.wav')).rejects.toThrow('spawn boom');
  });

  it('caps the captured stderr at 20KB so the error message stays bounded', async () => {
    process.env.ENCODEX_WHISPER_BIN = 'whisper-cli';
    process.env.ENCODEX_WHISPER_MODEL = 'C:\\models\\ggml-base.bin';
    existsSyncMock.mockReturnValue(false);
    const hugeStderr = 'x'.repeat(25000);
    spawnMock.mockImplementation(() => resolveRun(3, hugeStderr));
    try {
      await createWhisperCliEngine().transcribe('C:\\audio\\clip.wav');
      expect.unreachable('expected TRANSCRIPTION_UNAVAILABLE');
    } catch (err) {
      const message = String((err as { message?: string }).message);
      expect(message.length).toBeLessThan(20500);
      expect(message).toContain('x'.repeat(20000));
    }
  });
});
