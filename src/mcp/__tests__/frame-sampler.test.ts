/**
 * @fileoverview Tests for the FFmpeg-backed frame sampler
 * ({@link sampleFrameHash}) used by the perceptual-hash tool.
 *
 * The sampler spawns ffmpeg and never touches a real binary: `child_process`
 * `spawn` is mocked, `getFfmpegPath` is stubbed, and every scripted child is an
 * EventEmitter fake that drives stdout 'data' / 'close' / 'error' and the
 * timeout kill.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { sampleFrameHash, defaultFrameSampler } from '../frame-sampler';
import { averageHash } from '../../shared/ai/similarity';

const { spawnMock, getFfmpegPathMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  getFfmpegPathMock: vi.fn(),
}));

vi.mock('child_process', () => ({ spawn: spawnMock, default: { spawn: spawnMock } }));
vi.mock('../../main/media-binaries', () => ({ getFfmpegPath: getFfmpegPathMock, default: { getFfmpegPath: getFfmpegPathMock } }));

/** A fake ffmpeg child process whose stdout/stderr are EventEmitters. */
class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn().mockReturnValue(undefined);
}

/** The 8x8 grayscale frame (64 raw bytes) ffmpeg is scripted to emit. */
function frameBytes(): Buffer {
  return Buffer.from(Array.from({ length: 64 }, (_, index) => index));
}

function emitStream(stream: EventEmitter, data: Buffer) {
  stream.emit('data', data);
}

/**
 * Schedules a happy-path ffmpeg: emit the raw frame on stdout and close with
 * the given exit code on a later task.
 */
function resolveFrame(code: number, stdoutData: Buffer) {
  const child = new FakeChild();
  setImmediate(() => {
    emitStream(child.stdout, stdoutData);
    child.emit('close', code);
  });
  return child;
}

describe('sampleFrameHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFfmpegPathMock.mockReturnValue('C:\\ffmpeg\\ffmpeg.exe');
    spawnMock.mockImplementation(() => new FakeChild());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('spawns ffmpeg and returns the average hash of the decoded frame', async () => {
    const frame = frameBytes();
    spawnMock.mockImplementation(() => resolveFrame(0, frame));
    const hash = await sampleFrameHash('C:\\media\\clip.mp4');
    expect(getFfmpegPathMock).toHaveBeenCalledOnce();
    expect(spawnMock).toHaveBeenCalledWith('C:\\ffmpeg\\ffmpeg.exe', expect.any(Array), { windowsHide: true });
    expect(hash).toBe(averageHash(frame, 8, 8));
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('adds the -ss seek argument only when a positive offset is requested', async () => {
    spawnMock.mockImplementation(() => resolveFrame(0, frameBytes()));
    await sampleFrameHash('C:\\media\\clip.mp4', 12.5);
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toContain('-ss');
    expect(args).toContain('12.5');
  });

  it('resolves undefined when the ffmpeg path cannot be resolved', async () => {
    getFfmpegPathMock.mockImplementation(() => {
      throw new Error('no ffmpeg bundled');
    });
    await expect(sampleFrameHash('C:\\media\\clip.mp4')).resolves.toBeUndefined();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('resolves undefined when spawn itself throws', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('spawn failed');
    });
    await expect(sampleFrameHash('C:\\media\\clip.mp4')).resolves.toBeUndefined();
  });

  it('resolves undefined when ffmpeg emits fewer than 64 frame bytes', async () => {
    spawnMock.mockImplementation(() => resolveFrame(0, Buffer.from([1, 2, 3])));
    await expect(sampleFrameHash('C:\\media\\clip.mp4')).resolves.toBeUndefined();
  });

  it('resolves undefined when ffmpeg errors out, and ignores the later close', async () => {
    const child = new FakeChild();
    spawnMock.mockImplementation(() => child);
    const promise = sampleFrameHash('C:\\media\\clip.mp4');
    child.emit('error', new Error('ffmpeg crashed'));
    await expect(promise).resolves.toBeUndefined();
    child.emit('close', 1);
  });

  it('kills the child and resolves undefined when the extraction times out', async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    spawnMock.mockImplementation(() => child);
    const promise = sampleFrameHash('C:\\media\\clip.mp4');
    await vi.advanceTimersByTimeAsync(15001);
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    await expect(promise).resolves.toBeUndefined();
    // The child dying much later must not disturb the settled result.
    child.emit('close', 0);
  });

  it('still resolves undefined when the timeout kill throws', async () => {
    vi.useFakeTimers();
    const child = new FakeChild();
    child.kill = vi.fn(() => {
      throw new Error('kill rejected');
    });
    spawnMock.mockImplementation(() => child);
    const promise = sampleFrameHash('C:\\media\\clip.mp4');
    await vi.advanceTimersByTimeAsync(15001);
    await expect(promise).resolves.toBeUndefined();
  });

  it('exposes the default sampler as a thin wrapper over sampleFrameHash', async () => {
    spawnMock.mockImplementation(() => resolveFrame(0, frameBytes()));
    await expect(defaultFrameSampler('C:\\media\\clip.mp4', 0)).resolves.toMatch(/^[0-9a-f]{16}$/);
  });
});
