import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IPC } from '../../../shared/ipc-channels';

const { ipcMainMock, getHandlers, getImageInfoMock } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers[channel] = fn;
      }),
    },
    getImageInfoMock: vi.fn(),
    getHandlers: () => handlers,
  };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock, BrowserWindow: class {} }));
vi.mock('../../image-info', () => ({ getImageInfo: getImageInfoMock }));

const { registerImageHandlers } = await import('../image');

describe('registerImageHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerImageHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the GET_IMAGE_INFO handler', () => {
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.GET_IMAGE_INFO, expect.any(Function));
  });

  it('GET_IMAGE_INFO returns the image info for the given file', async () => {
    const imageData = { file: 'photo.jpg', exif: { 'ifd0.Make': 'Canon' }, histogram: null };
    getImageInfoMock.mockResolvedValue(imageData);
    await expect(getHandlers()[IPC.GET_IMAGE_INFO]({}, 'photo.jpg')).resolves.toBe(imageData);
    expect(getImageInfoMock).toHaveBeenCalledWith('photo.jpg');
  });

  it('GET_IMAGE_INFO rethrows formatted errors', async () => {
    getImageInfoMock.mockRejectedValue(new Error('boom'));
    await expect(getHandlers()[IPC.GET_IMAGE_INFO]({}, 'photo.jpg')).rejects.toMatchObject({
      name: 'AppError',
      code: 'UNKNOWN',
    });
  });
});
