import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { readFileMock, existsSyncMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  existsSyncMock: vi.fn(),
}));

vi.mock('fs/promises', () => ({ readFile: readFileMock, default: { readFile: readFileMock } }));
vi.mock('fs', () => ({ existsSync: existsSyncMock, default: { existsSync: existsSyncMock } }));

const { getImagePreview, mimeTypeForFile } = await import('../image-preview');

describe('mimeTypeForFile', () => {
  it('maps common image extensions to mime types', () => {
    expect(mimeTypeForFile('a.jpg')).toBe('image/jpeg');
    expect(mimeTypeForFile('a.JPEG')).toBe('image/jpeg');
    expect(mimeTypeForFile('a.png')).toBe('image/png');
    expect(mimeTypeForFile('a.webp')).toBe('image/webp');
    expect(mimeTypeForFile('a.svg')).toBe('image/svg+xml');
    expect(mimeTypeForFile('a.avif')).toBe('image/avif');
  });

  it('returns null for unknown extensions', () => {
    expect(mimeTypeForFile('a.zip')).toBeNull();
    expect(mimeTypeForFile('no-extension')).toBeNull();
  });
});

describe('getImagePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a base64 data URL for a readable image', async () => {
    readFileMock.mockResolvedValue(Buffer.from([1, 2, 3]));
    await expect(getImagePreview('photo.png')).resolves.toBe('data:image/png;base64,AQID');
    expect(readFileMock).toHaveBeenCalledWith('photo.png');
  });

  it('returns null for non-image files', async () => {
    await expect(getImagePreview('video.mp4')).resolves.toBeNull();
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it('returns null when the file does not exist', async () => {
    existsSyncMock.mockReturnValue(false);
    await expect(getImagePreview('photo.jpg')).resolves.toBeNull();
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it('returns null when reading fails', async () => {
    readFileMock.mockRejectedValue(new Error('EACCES'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(getImagePreview('photo.jpg')).resolves.toBeNull();
    warnSpy.mockRestore();
  });
});
