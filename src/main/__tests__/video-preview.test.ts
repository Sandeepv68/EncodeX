import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

const { spawnMock, existsSyncMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  existsSyncMock: vi.fn(),
}));

vi.mock('child_process', () => ({ spawn: spawnMock, default: { spawn: spawnMock } }));
vi.mock('fs', () => ({ existsSync: existsSyncMock, default: { existsSync: existsSyncMock } }));

const { getVideoPreview } = await import('../video-preview');

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

function emitStream(stream: EventEmitter, data: Buffer[]) {
  for (const chunk of data) stream.emit('data', chunk);
}

function resolveWith(code: number, stdoutData: Buffer[], stderrText = '') {
  const child = new FakeChild();
  spawnMock.mockReturnValue(child);
  queueMicrotask(() => {
    emitStream(child.stdout, stdoutData);
    emitStream(child.stderr, stderrText ? [Buffer.from(stderrText)] : []);
    child.emit('close', code);
  });
  return child;
}

describe('getVideoPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a base64 PNG data URL when ffmpeg extracts a frame', async () => {
    resolveWith(0, [Buffer.from([1, 2, 3]), Buffer.from([4])]);
    await expect(getVideoPreview('video.mp4')).resolves.toBe('data:image/png;base64,AQIDBA==');
    expect(spawnMock).toHaveBeenCalledOnce();
    const [, args] = spawnMock.mock.calls[0];
    expect(args).toContain('video.mp4');
    expect(args).toContain('png');
  });

  it('returns null for non-video files', async () => {
    await expect(getVideoPreview('photo.png')).resolves.toBeNull();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('returns null when the file does not exist', async () => {
    existsSyncMock.mockReturnValue(false);
    await expect(getVideoPreview('video.mp4')).resolves.toBeNull();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('returns null when ffmpeg exits with a non-zero code', async () => {
    resolveWith(1, [Buffer.from([1, 2, 3])], 'no video stream');
    await expect(getVideoPreview('video.mp4')).resolves.toBeNull();
  });

  it('returns null when ffmpeg produces no output', async () => {
    resolveWith(0, []);
    await expect(getVideoPreview('video.mp4')).resolves.toBeNull();
  });

  it('rejects when spawning ffmpeg fails', async () => {
    const child = new FakeChild();
    spawnMock.mockReturnValue(child);
    queueMicrotask(() => child.emit('error', new Error('ENOENT')));
    await expect(getVideoPreview('video.mp4')).rejects.toThrow('ENOENT');
  });
});
