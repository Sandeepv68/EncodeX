import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

const { existsSyncMock } = vi.hoisted(() => ({ existsSyncMock: vi.fn() }));

vi.mock('fs', () => ({
  default: { existsSync: existsSyncMock },
  existsSync: existsSyncMock,
}));

vi.mock('ffmpeg-static', () => ({ default: 'C:/static/ffmpeg.exe' }));
vi.mock('ffprobe-static', () => ({ default: { path: 'C:/static/ffprobe.exe' } }));
vi.mock('electron', () => ({ app: { isPackaged: true } }));

const { getFfmpegPath, getFfprobePath } = await import('../media-binaries');

const resourcesPath = 'C:\\App\\resources';

function expectedExecutable(base: string): string {
  return process.platform === 'win32' ? `${base}.exe` : base;
}

describe('getFfmpegPath', () => {
  beforeEach(() => {
    existsSyncMock.mockReset();
  });

  it('returns the static ffmpeg path in development when it exists', () => {
    existsSyncMock.mockReturnValue(true);
    expect(getFfmpegPath()).toBe('C:/static/ffmpeg.exe');
  });

  it('falls back to the system ffmpeg when the static binary is missing', () => {
    existsSyncMock.mockReturnValue(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getFfmpegPath()).toBe('ffmpeg');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'), expect.stringContaining('ffmpeg-static not found'));
    warnSpy.mockRestore();
  });
});

describe('getFfprobePath', () => {
  beforeEach(() => {
    existsSyncMock.mockReset();
  });

  it('returns the static ffprobe path in development when it exists', () => {
    existsSyncMock.mockReturnValue(true);
    expect(getFfprobePath()).toBe('C:/static/ffprobe.exe');
  });

  it('falls back to the system ffprobe when the static binary is missing', () => {
    existsSyncMock.mockReturnValue(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getFfprobePath()).toBe('ffprobe');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'), expect.stringContaining('ffprobe-static not found'));
    warnSpy.mockRestore();
  });
});

describe('packaged mode', () => {
  beforeEach(() => {
    (process.versions as { electron?: string }).electron = '33.0.0';
    (process as { resourcesPath?: string }).resourcesPath = resourcesPath;
    existsSyncMock.mockReset();
  });

  afterEach(() => {
    delete (process.versions as { electron?: string }).electron;
    delete (process as { resourcesPath?: string }).resourcesPath;
  });

  it('resolves ffmpeg from the staged resources directory', () => {
    existsSyncMock.mockReturnValue(true);
    expect(getFfmpegPath()).toBe(path.join(resourcesPath, 'ffmpeg-static', expectedExecutable('ffmpeg')));
  });

  it('resolves ffprobe from the staged per-arch resources directory', () => {
    existsSyncMock.mockReturnValue(true);
    expect(getFfprobePath()).toBe(
      path.join(resourcesPath, 'ffprobe-static', 'bin', process.platform, process.arch, expectedExecutable('ffprobe')),
    );
  });

  it('falls back to the system ffmpeg when the staged binary is missing', () => {
    existsSyncMock.mockReturnValue(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getFfmpegPath()).toBe('ffmpeg');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'), expect.stringContaining('ffmpeg-static not found'));
    warnSpy.mockRestore();
  });

  it('falls back to the system ffprobe when the staged binary is missing', () => {
    existsSyncMock.mockReturnValue(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getFfprobePath()).toBe('ffprobe');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'), expect.stringContaining('ffprobe-static not found'));
    warnSpy.mockRestore();
  });
});
