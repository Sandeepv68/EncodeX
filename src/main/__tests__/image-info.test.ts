import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { isImageFile } from '../../shared/file-extensions';

const { spawnMock, existsSyncMock, exifrParseMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  existsSyncMock: vi.fn(),
  exifrParseMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
  ChildProcess: class {},
  default: { spawn: spawnMock },
}));

vi.mock('fs', () => ({
  existsSync: existsSyncMock,
  default: { existsSync: existsSyncMock },
}));

vi.mock('exifr', () => ({ default: { parse: exifrParseMock } }));

vi.mock('ffmpeg-static', () => ({ default: 'C:\\ffmpeg\\bin\\ffmpeg.exe' }));

const { flattenExif, computeHistogram, decodeImageHistogram, getImageInfo } = await import('../image-info');

function createFakeProcess(): EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdio: Array<null | EventEmitter>;
  pid: number;
  kill: ReturnType<typeof vi.fn>;
} {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdio: Array<null | EventEmitter>;
    pid: number;
    kill: ReturnType<typeof vi.fn>;
  };
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.stdio = [null, stdout, stderr, null];
  proc.pid = 5678;
  proc.kill = vi.fn();
  return proc;
}

describe('isImageFile', () => {
  it('accepts known image extensions', () => {
    expect(isImageFile('photo.JPG')).toBe(true);
    expect(isImageFile('image.png')).toBe(true);
    expect(isImageFile('pic.webp')).toBe(true);
  });

  it('rejects non-image files', () => {
    expect(isImageFile('video.mp4')).toBe(false);
    expect(isImageFile('archive.zip')).toBe(false);
    expect(isImageFile('no-extension')).toBe(false);
  });
});

describe('flattenExif', () => {
  it('flattens nested EXIF blocks into dotted keys', () => {
    const result = flattenExif({ ifd0: { Make: 'Nikon' }, exif: { ISO: 200 }, gps: { Latitude: [51, 30] } });
    expect(result).toEqual({
      'ifd0.Make': 'Nikon',
      'exif.ISO': '200',
      'gps.Latitude': '51, 30',
    });
  });

  it('skips null and empty input', () => {
    expect(flattenExif(null)).toEqual({});
    expect(flattenExif({ a: null, b: undefined })).toEqual({});
    expect(flattenExif('string')).toEqual({});
  });
});

describe('computeHistogram', () => {
  it('computes 256-bin RGB and luma histograms', () => {
    const buffer = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255]);
    const result = computeHistogram(buffer, 1, 3);
    expect(result.r).toHaveLength(256);
    expect(result.r[255]).toBe(1);
    expect(result.g[255]).toBe(1);
    expect(result.b[255]).toBe(1);
    expect(result.luma[Math.round(0.299 * 255)]).toBe(1);
    expect(result.luma[Math.round(0.587 * 255)]).toBe(1);
    expect(result.luma[Math.round(0.114 * 255)]).toBe(1);
  });
});

describe('decodeImageHistogram', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => createFakeProcess());
    existsSyncMock.mockReset();
    existsSyncMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the bundled ffmpeg path and collects raw rgb frames', async () => {
    const promise = decodeImageHistogram('photo.jpg');
    const proc = spawnMock.mock.results[0].value;
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(spawnMock).toHaveBeenCalledWith(
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      expect.any(Array),
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }),
    );
    expect(args).toContain('scale=256:-2');
    expect(args).toContain('rgb24');
    (proc.stdout as EventEmitter).emit('data', Buffer.alloc(256 * 2 * 3));
    (proc as EventEmitter).emit('close', 0);
    const result = await promise;
    expect(result).toMatchObject({ width: 256, height: 2 });
  });

  it('resolves null when the ffmpeg exit code is non-zero', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const promise = decodeImageHistogram('photo.jpg');
    const proc = spawnMock.mock.results[0].value;
    (proc.stderr as EventEmitter).emit('data', Buffer.from('decode error'));
    (proc as EventEmitter).emit('close', 1);
    expect(await promise).toBeNull();
    warnSpy.mockRestore();
  });

  it('rejects when ffmpeg cannot be spawned', async () => {
    spawnMock.mockImplementationOnce(() => {
      const proc = createFakeProcess();
      queueMicrotask(() => (proc as EventEmitter).emit('error', new Error('ENOENT')));
      return proc;
    });
    await expect(decodeImageHistogram('photo.jpg')).rejects.toThrow('ENOENT');
  });
});

describe('getImageInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spawnMock.mockImplementation(() => createFakeProcess());
    existsSyncMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for non-image files', async () => {
    expect(await getImageInfo('video.mp4')).toBeNull();
    expect(exifrParseMock).not.toHaveBeenCalled();
  });

  it('combines EXIF and histogram data', async () => {
    exifrParseMock.mockResolvedValue({ ifd0: { Make: 'Canon' }, exif: { ISO: 400 } });
    const proc = createFakeProcess();
    spawnMock.mockImplementationOnce(() => {
      queueMicrotask(() => {
        (proc.stdout as EventEmitter).emit('data', Buffer.alloc(256 * 1 * 3));
        (proc as EventEmitter).emit('close', 0);
      });
      return proc;
    });
    const result = await getImageInfo('photo.jpg');
    expect(result).toMatchObject({
      file: 'photo.jpg',
      exif: { 'ifd0.Make': 'Canon', 'exif.ISO': '400' },
    });
    expect(result?.histogram?.r).toHaveLength(256);
  });

  it('returns null when both EXIF and histogram are unavailable', async () => {
    exifrParseMock.mockRejectedValue(new Error('no exif'));
    spawnMock.mockImplementationOnce(() => {
      const proc = createFakeProcess();
      queueMicrotask(() => (proc as EventEmitter).emit('close', 1));
      return proc;
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await getImageInfo('photo.jpg')).toBeNull();
    warnSpy.mockRestore();
  });

  it('keeps EXIF data when the histogram decode fails', async () => {
    exifrParseMock.mockResolvedValue({ ifd0: { Make: 'Nikon' } });
    spawnMock.mockImplementationOnce(() => {
      const proc = createFakeProcess();
      queueMicrotask(() => (proc as EventEmitter).emit('close', 1));
      return proc;
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await getImageInfo('photo.jpg');
    expect(result?.exif['ifd0.Make']).toBe('Nikon');
    expect(result?.histogram).toBeNull();
    warnSpy.mockRestore();
  });
});
