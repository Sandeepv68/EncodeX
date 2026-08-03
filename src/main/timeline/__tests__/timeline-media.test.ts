import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inflateSync } from 'zlib';
import { EventEmitter } from 'events';

const { spawnMock, existsSyncMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  existsSyncMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
  ChildProcess: class {},
  default: { spawn: spawnMock },
}));

vi.mock('ffmpeg-static', () => ({ default: 'C:\\ffmpeg\\bin\\ffmpeg.exe' }));

vi.mock('fs', () => ({
  existsSync: existsSyncMock,
  default: { existsSync: existsSyncMock },
}));

const { extractWaveform, extractThumbnails } = await import('../timeline-media');

const RAW_FRAME_BYTES = 160 * 90 * 3;

function createFakeProcess(): EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
} {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.kill = vi.fn();
  return proc;
}

function s16leSamples(values: number[]): Buffer {
  const buf = Buffer.alloc(values.length * 2);
  values.forEach((v, i) => buf.writeInt16LE(v, i * 2));
  return buf;
}

function alternating(value: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i % 2 === 0 ? value : -value));
}

function seekTimeFromArgs(args: string[]): number {
  const idx = args.indexOf('-ss');
  return idx === -1 ? -1 : parseFloat(args[idx + 1]);
}

function pngInfo(dataUrl: string): { width: number; height: number; idatSize: number } {
  const buf = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const idatSize = buf.readUInt32BE(33);
  expect(buf.subarray(37, 41).toString('ascii')).toBe('IDAT');
  const raw = inflateSync(buf.subarray(41, 41 + idatSize));
  expect(raw.length).toBe((width * 3 + 1) * height);
  return { width, height, idatSize };
}

describe('timeline-media', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spawnMock.mockReset();
    existsSyncMock.mockReset();
    existsSyncMock.mockReturnValue(true);
    spawnMock.mockImplementation(() => createFakeProcess());
  });

  it('returns null for non-video files', async () => {
    existsSyncMock.mockReturnValue(true);
    await expect(extractWaveform('photo.jpg', 60)).resolves.toBeNull();
    await expect(extractThumbnails('photo.jpg', 60)).resolves.toBeNull();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('returns null when the file does not exist', async () => {
    existsSyncMock.mockReturnValue(false);
    await expect(extractWaveform('v.mp4', 60)).resolves.toBeNull();
    await expect(extractThumbnails('v.mp4', 60)).resolves.toBeNull();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('decodes full audio segments in parallel and computes normalized waveform buckets', async () => {
    const spawnCount = vi.fn();
    spawnMock.mockImplementation((bin: string, args: string[]) => {
      spawnCount();
      expect(bin).toBe('C:\\ffmpeg\\bin\\ffmpeg.exe');
      const allArgs = args.join(' ');
      expect(allArgs).toContain('-ss');
      expect(allArgs).toContain('-ar 8000');
      expect(allArgs).toContain('s16le');
      expect(allArgs).not.toContain('concat');
      const amplitude = Math.round(seekTimeFromArgs(args)) % 2 === 0 ? 16384 : 8192;
      const proc = createFakeProcess();
      process.nextTick(() => {
        proc.stdout.emit('data', s16leSamples(alternating(amplitude, 40000)));
        proc.emit('close', 0);
      });
      return proc;
    });

    const result = await extractWaveform('v.mp4', 60);

    expect(spawnCount).toHaveBeenCalledTimes(12);
    expect(result).not.toBeNull();
    expect(result!.sampleRate).toBe(8000);
    expect(result!.samplesPerBucket).toBe(200);
    expect(result!.buckets.length).toBe(2400);
    expect(result!.buckets[0]).toEqual({ min: -0.5, max: 0.5 });
    expect(result!.buckets[199]).toEqual({ min: -0.5, max: 0.5 });
    expect(result!.buckets[200]).toEqual({ min: -0.25, max: 0.25 });
    expect(result!.buckets[399]).toEqual({ min: -0.25, max: 0.25 });
    expect(spawnMock).toHaveBeenCalledWith('C:\\ffmpeg\\bin\\ffmpeg.exe', expect.arrayContaining(['-ss', '0']), expect.anything());
  });

  it('fills waveform buckets when a segment fails to decode', async () => {
    spawnMock.mockImplementation((bin: string, args: string[]) => {
      const start = seekTimeFromArgs(args);
      const proc = createFakeProcess();
      process.nextTick(() => {
        if (start === 0) {
          proc.emit('close', 1);
          return;
        }
        proc.stdout.emit('data', s16leSamples(alternating(16384, 40000)));
        proc.emit('close', 0);
      });
      return proc;
    });

    const result = await extractWaveform('v.mp4', 60);

    expect(result!.buckets[0]).toEqual({ min: -0.5, max: 0.5 });
    expect(result!.buckets[39]).toEqual({ min: -0.5, max: 0.5 });
  });

  it('resolves null when every waveform segment fails', async () => {
    spawnMock.mockImplementation(() => {
      const proc = createFakeProcess();
      process.nextTick(() => {
        proc.emit('close', 1);
      });
      return proc;
    });
    await expect(extractWaveform('v.mp4', 60)).resolves.toBeNull();
  });

  it('resolves null when the waveform process spawn fails', async () => {
    spawnMock.mockImplementation(() => {
      const proc = createFakeProcess();
      process.nextTick(() => {
        proc.emit('error', new Error('boom'));
      });
      return proc;
    });
    await expect(extractWaveform('v.mp4', 60)).resolves.toBeNull();
  });

  it('builds a montage PNG from parallel per-frame thumbnails', async () => {
    const spawnCount = vi.fn();
    spawnMock.mockImplementation((bin: string, args: string[]) => {
      spawnCount();
      const allArgs = args.join(' ');
      expect(allArgs).toContain('-ss');
      expect(allArgs).toContain('-noaccurate_seek');
      expect(allArgs).toContain('rgb24');
      expect(allArgs).not.toContain('concat');
      expect(allArgs).not.toContain('tile');
      const proc = createFakeProcess();
      process.nextTick(() => {
        proc.stdout.emit('data', Buffer.alloc(RAW_FRAME_BYTES, seekTimeFromArgs(args) % 256));
        proc.emit('close', 0);
      });
      return proc;
    });

    const result = await extractThumbnails('v.mp4', 60);

    expect(spawnCount).toHaveBeenCalledTimes(8);
    expect(result).not.toBeNull();
    expect(result!.cols).toBe(10);
    expect(result!.rows).toBe(1);
    expect(result!.thumbWidth).toBe(160);
    expect(result!.thumbHeight).toBe(90);
    expect(result!.count).toBe(8);
    expect(result!.interval).toBe(7.5);
    expect(pngInfo(result!.dataUrl)).toEqual({ width: 1600, height: 90, idatSize: expect.any(Number) as number });
  });

  it('caps thumbnail count and grows the montage rows for long videos', async () => {
    let call = 0;
    spawnMock.mockImplementation(() => {
      const proc = createFakeProcess();
      process.nextTick(() => {
        if (call === 0) {
          proc.stdout.emit('data', Buffer.alloc(RAW_FRAME_BYTES, 1));
        }
        call++;
        proc.emit('close', 0);
      });
      return proc;
    });

    const result = await extractThumbnails('v.mp4', 7200);

    expect(call).toBe(100);
    expect(result!.count).toBe(100);
    expect(result!.rows).toBe(10);
    expect(pngInfo(result!.dataUrl)).toEqual({ width: 1600, height: 900, idatSize: expect.any(Number) as number });
  });

  it('resolves null when every thumbnail fails', async () => {
    spawnMock.mockImplementation(() => {
      const proc = createFakeProcess();
      process.nextTick(() => {
        proc.emit('close', 1);
      });
      return proc;
    });
    await expect(extractThumbnails('v.mp4', 60)).resolves.toBeNull();
  });

  it('resolves null when the thumbnail process spawn fails', async () => {
    spawnMock.mockImplementation(() => {
      const proc = createFakeProcess();
      process.nextTick(() => {
        proc.emit('error', new Error('nope'));
      });
      return proc;
    });
    await expect(extractThumbnails('v.mp4', 60)).resolves.toBeNull();
  });
});
