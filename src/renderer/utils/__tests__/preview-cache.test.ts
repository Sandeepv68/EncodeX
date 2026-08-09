import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPreviewThumbnail, getResolvedPreviewThumbnail, clearPreviewCache } from '../preview-cache';

const getVideoPreviewMock = vi.mocked(window.electronAPI.getVideoPreview);
const getImagePreviewMock = vi.mocked(window.electronAPI.getImagePreview);

describe('getResolvedPreviewThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPreviewCache();
  });

  it('returns null before the file has been previewed', () => {
    expect(getResolvedPreviewThumbnail('C:/videos/clip.mp4')).toBeNull();
  });

  it('returns the generated data URL synchronously after the first lookup', async () => {
    getVideoPreviewMock.mockResolvedValue('data:image/png;base64,VIDEO');
    await getPreviewThumbnail('C:/videos/clip.mp4');
    expect(getResolvedPreviewThumbnail('C:/videos/clip.mp4')).toBe('data:image/png;base64,VIDEO');
  });

  it('returns null for files that resolve to no preview', async () => {
    await getPreviewThumbnail('C:/music/track.mp3');
    expect(getResolvedPreviewThumbnail('C:/music/track.mp3')).toBeNull();
  });
});

describe('getPreviewThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPreviewCache();
  });

  it('fetches a video preview on first request', async () => {
    getVideoPreviewMock.mockResolvedValue('data:image/png;base64,VIDEO');
    await expect(getPreviewThumbnail('C:/videos/clip.mp4')).resolves.toBe('data:image/png;base64,VIDEO');
    expect(getVideoPreviewMock).toHaveBeenCalledTimes(1);
    expect(getVideoPreviewMock).toHaveBeenCalledWith('C:/videos/clip.mp4');
  });

  it('fetches an image preview on first request', async () => {
    getImagePreviewMock.mockResolvedValue('data:image/png;base64,IMAGE');
    await expect(getPreviewThumbnail('C:/pics/photo.png')).resolves.toBe('data:image/png;base64,IMAGE');
    expect(getImagePreviewMock).toHaveBeenCalledTimes(1);
  });

  it('returns the cached result without re-invoking the IPC on later calls', async () => {
    getVideoPreviewMock.mockResolvedValue('data:image/png;base64,VIDEO');
    await getPreviewThumbnail('C:/videos/clip.mp4');
    await expect(getPreviewThumbnail('C:/videos/clip.mp4')).resolves.toBe('data:image/png;base64,VIDEO');
    expect(getVideoPreviewMock).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent in-flight requests into a single IPC call', async () => {
    let resolveLoad: ((url: string | null) => void) | undefined;
    getVideoPreviewMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    const first = getPreviewThumbnail('C:/videos/concurrent.mp4');
    const second = getPreviewThumbnail('C:/videos/concurrent.mp4');
    expect(getVideoPreviewMock).toHaveBeenCalledTimes(1);
    resolveLoad?.('data:image/png;base64,VIDEO');
    await expect(first).resolves.toBe('data:image/png;base64,VIDEO');
    await expect(second).resolves.toBe('data:image/png;base64,VIDEO');
  });

  it('caches a null result for files with no previewable type without any IPC call', async () => {
    await expect(getPreviewThumbnail('C:/music/track.mp3')).resolves.toBeNull();
    expect(getVideoPreviewMock).not.toHaveBeenCalled();
    expect(getImagePreviewMock).not.toHaveBeenCalled();
    await expect(getPreviewThumbnail('C:/music/track.mp3')).resolves.toBeNull();
  });

  it('caches IPC failures as null so they are not re-attempted', async () => {
    getVideoPreviewMock.mockRejectedValue(new Error('boom'));
    await expect(getPreviewThumbnail('C:/videos/broken.mp4')).resolves.toBeNull();
    await expect(getPreviewThumbnail('C:/videos/broken.mp4')).resolves.toBeNull();
    expect(getVideoPreviewMock).toHaveBeenCalledTimes(1);
  });
});
