import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC } from '../../../shared/ipc-channels';

const { ipcMainMock, extractWaveformMock, extractThumbnailsMock, formatErrorMock } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers[channel] = fn;
      }),
    },
    extractWaveformMock: vi.fn(),
    extractThumbnailsMock: vi.fn(),
    formatErrorMock: vi.fn((err: unknown) => err),
  };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

vi.mock('../../timeline/timeline-media', () => ({
  extractWaveform: extractWaveformMock,
  extractThumbnails: extractThumbnailsMock,
}));

vi.mock('../../../shared/errors', () => ({ formatError: formatErrorMock }));

const { registerTimelineHandlers } = await import('../timeline');

function getHandler(channel: string): (event: unknown, filePath: string, duration: number) => Promise<unknown> {
  const call = ipcMainMock.handle.mock.calls.find((c: unknown[]) => c[0] === channel) as [string, unknown] | undefined;
  return call?.[1] as (event: unknown, filePath: string, duration: number) => Promise<unknown>;
}

describe('registerTimelineHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerTimelineHandlers();
  });

  it('registers handlers for EXTRACT_WAVEFORM and EXTRACT_THUMBNAILS', () => {
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.EXTRACT_WAVEFORM, expect.any(Function));
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.EXTRACT_THUMBNAILS, expect.any(Function));
  });

  it('returns the extracted waveform', async () => {
    const waveform = { sampleRate: 8000, samplesPerBucket: 1000, buckets: [{ min: -0.5, max: 0.5 }] };
    extractWaveformMock.mockResolvedValueOnce(waveform);

    await expect(getHandler(IPC.EXTRACT_WAVEFORM)({}, '/in/v.mp4', 60)).resolves.toEqual(waveform);
    expect(extractWaveformMock).toHaveBeenCalledWith('/in/v.mp4', 60);
  });

  it('returns the extracted thumbnails', async () => {
    const thumbnails = {
      dataUrl: 'data:image/png;base64,AAAA',
      cols: 10,
      rows: 10,
      thumbWidth: 160,
      thumbHeight: 90,
      interval: 7.5,
      count: 8,
    };
    extractThumbnailsMock.mockResolvedValueOnce(thumbnails);

    await expect(getHandler(IPC.EXTRACT_THUMBNAILS)({}, '/in/v.mp4', 60)).resolves.toEqual(thumbnails);
    expect(extractThumbnailsMock).toHaveBeenCalledWith('/in/v.mp4', 60);
  });

  it('rethrows formatted errors', async () => {
    extractWaveformMock.mockRejectedValueOnce(new Error('boom'));
    formatErrorMock.mockReturnValueOnce(new Error('formatted boom'));

    await expect(getHandler(IPC.EXTRACT_WAVEFORM)({}, '/in/v.mp4', 60)).rejects.toThrow('formatted boom');
    expect(formatErrorMock).toHaveBeenCalled();
  });
});
