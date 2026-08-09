import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import { IPC } from '../../../shared/ipc-channels';

const { ipcMainMock, getHandlers, getImageInfoMock, getImagePreviewMock, getImageFileInfoMock } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers[channel] = fn;
      }),
    },
    getImageInfoMock: vi.fn(),
    getImagePreviewMock: vi.fn(),
    getImageFileInfoMock: vi.fn(),
    getHandlers: () => handlers,
  };
});

vi.mock('electron', () => ({
  ipcMain: ipcMainMock,
  BrowserWindow: class {},
  app: { getPath: () => os.tmpdir() },
}));
vi.mock('../../image-info', () => ({ getImageInfo: getImageInfoMock }));
vi.mock('../../image-preview', () => ({ getImagePreview: getImagePreviewMock }));
vi.mock('../../image-file-info', () => ({ getImageFileInfo: getImageFileInfoMock }));

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

  it('registers the GET_IMAGE_PREVIEW handler', () => {
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.GET_IMAGE_PREVIEW, expect.any(Function));
  });

  it('GET_IMAGE_PREVIEW returns a data URL for the given file', async () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    getImagePreviewMock.mockResolvedValue(dataUrl);
    await expect(getHandlers()[IPC.GET_IMAGE_PREVIEW]({}, 'photo.png')).resolves.toBe(dataUrl);
    expect(getImagePreviewMock).toHaveBeenCalledWith('photo.png');
  });

  it('GET_IMAGE_PREVIEW rethrows formatted errors', async () => {
    getImagePreviewMock.mockRejectedValue(new Error('boom'));
    await expect(getHandlers()[IPC.GET_IMAGE_PREVIEW]({}, 'photo.png')).rejects.toMatchObject({
      name: 'AppError',
      code: 'UNKNOWN',
    });
  });

  it('registers the GET_IMAGE_FILE_INFO handler', () => {
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.GET_IMAGE_FILE_INFO, expect.any(Function));
  });

  it('GET_IMAGE_FILE_INFO returns file info for the given file', async () => {
    const info = { width: 3000, height: 2000, size: 1234567 };
    getImageFileInfoMock.mockResolvedValue(info);
    await expect(getHandlers()[IPC.GET_IMAGE_FILE_INFO]({}, 'photo.jpg')).resolves.toBe(info);
    expect(getImageFileInfoMock).toHaveBeenCalledWith('photo.jpg');
  });

  it('GET_IMAGE_FILE_INFO rethrows formatted errors', async () => {
    getImageFileInfoMock.mockRejectedValue(new Error('boom'));
    await expect(getHandlers()[IPC.GET_IMAGE_FILE_INFO]({}, 'photo.jpg')).rejects.toMatchObject({
      name: 'AppError',
      code: 'UNKNOWN',
    });
  });
});
