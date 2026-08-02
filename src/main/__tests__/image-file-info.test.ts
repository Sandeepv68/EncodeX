import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { existsSyncMock, statMock, openMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  statMock: vi.fn(),
  openMock: vi.fn(),
}));

const closeMock = vi.fn();
const readMock = vi.fn();

vi.mock('fs/promises', () => ({
  stat: statMock,
  open: openMock,
  default: { stat: statMock, open: openMock },
}));
vi.mock('fs', () => ({ existsSync: existsSyncMock, default: { existsSync: existsSyncMock } }));

const { getImageFileInfo, readImageDimensions } = await import('../image-file-info');

function header(...bytes: number[]): Buffer {
  return Buffer.from(bytes);
}

describe('readImageDimensions', () => {
  it('parses PNG dimensions', () => {
    const buf = Buffer.alloc(24);
    buf[0] = 0x89;
    buf[1] = 0x50;
    buf[2] = 0x4e;
    buf[3] = 0x47;
    buf.writeUInt32BE(1920, 16);
    buf.writeUInt32BE(1080, 20);
    expect(readImageDimensions(buf)).toEqual({ width: 1920, height: 1080 });
  });

  it('parses GIF dimensions', () => {
    const buf = Buffer.alloc(24);
    buf[0] = 0x47;
    buf[1] = 0x49;
    buf[2] = 0x46;
    buf.writeUInt16LE(800, 6);
    buf.writeUInt16LE(600, 8);
    expect(readImageDimensions(buf)).toEqual({ width: 800, height: 600 });
  });

  it('parses BMP dimensions', () => {
    const buf = Buffer.alloc(26);
    buf[0] = 0x42;
    buf[1] = 0x4d;
    buf.writeInt32LE(1024, 18);
    buf.writeInt32LE(-768, 22);
    expect(readImageDimensions(buf)).toEqual({ width: 1024, height: 768 });
  });

  it('parses WebP VP8X dimensions', () => {
    const buf = Buffer.alloc(30);
    buf.write('RIFF', 0, 'ascii');
    buf.write('WEBP', 8, 'ascii');
    buf.write('VP8X', 12, 'ascii');
    buf.writeUIntLE(1919, 24, 3);
    buf.writeUIntLE(1079, 27, 3);
    expect(readImageDimensions(buf)).toEqual({ width: 1920, height: 1080 });
  });

  it('parses WebP VP8L dimensions', () => {
    const buf = Buffer.alloc(25);
    buf.write('RIFF', 0, 'ascii');
    buf.write('WEBP', 8, 'ascii');
    buf.write('VP8L', 12, 'ascii');
    const width = 1024;
    const height = 768;
    buf[21] = (width - 1) & 0xff;
    buf[22] = (((width - 1) >> 8) & 0x3f) | (((height - 1) & 0x03) << 6);
    buf[23] = ((height - 1) >> 2) & 0xff;
    buf[24] = ((height - 1) >> 10) & 0x0f;
    expect(readImageDimensions(buf)).toEqual({ width, height });
  });

  it('parses WebP VP8 dimensions', () => {
    const buf = Buffer.alloc(30);
    buf.write('RIFF', 0, 'ascii');
    buf.write('WEBP', 8, 'ascii');
    buf.write('VP8 ', 12, 'ascii');
    buf.writeUInt16LE(640, 26);
    buf.writeUInt16LE(480, 28);
    expect(readImageDimensions(buf)).toEqual({ width: 640, height: 480 });
  });

  it('parses JPEG dimensions from a SOF marker', () => {
    const buf = header(
      0xff,
      0xd8,
      0xff,
      0xe0,
      0x00,
      0x10,
      0x4a,
      0x46,
      0x49,
      0x46,
      0,
      1,
      1,
      0,
      0,
      1,
      0,
      1,
      0,
      0,
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      0x04,
      0x38,
      0x07,
      0x80,
    );
    expect(readImageDimensions(buf)).toEqual({ width: 1920, height: 1080 });
  });

  it('returns null for unsupported content', () => {
    expect(readImageDimensions(Buffer.from([1, 2, 3, 4, 5]))).toBeNull();
    expect(readImageDimensions(Buffer.alloc(0))).toBeNull();
  });
});

describe('getImageFileInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
    statMock.mockResolvedValue({ size: 2500000 });
    openMock.mockResolvedValue({ read: readMock, close: closeMock });
    closeMock.mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns size and dimensions for a readable image', async () => {
    const png = Buffer.alloc(24);
    png[0] = 0x89;
    png[1] = 0x50;
    png[2] = 0x4e;
    png[3] = 0x47;
    png.writeUInt32BE(3000, 16);
    png.writeUInt32BE(2000, 20);
    readMock.mockImplementation((_buf, _off, _len, pos) => {
      png.copy(_buf);
      return { bytesRead: png.length };
    });
    await expect(getImageFileInfo('photo.png')).resolves.toEqual({
      width: 3000,
      height: 2000,
      size: 2500000,
    });
    expect(closeMock).toHaveBeenCalled();
  });

  it('returns null dimensions when the header cannot be parsed', async () => {
    readMock.mockImplementation((_buf) => {
      Buffer.from([1, 2, 3]).copy(_buf);
      return { bytesRead: 3 };
    });
    await expect(getImageFileInfo('photo.png')).resolves.toEqual({
      width: null,
      height: null,
      size: 2500000,
    });
  });

  it('returns null for non-image files', async () => {
    await expect(getImageFileInfo('video.mp4')).resolves.toBeNull();
    expect(openMock).not.toHaveBeenCalled();
  });

  it('returns null when the file does not exist', async () => {
    existsSyncMock.mockReturnValue(false);
    await expect(getImageFileInfo('photo.jpg')).resolves.toBeNull();
  });

  it('returns null when stat fails', async () => {
    statMock.mockRejectedValue(new Error('EACCES'));
    await expect(getImageFileInfo('photo.jpg')).resolves.toBeNull();
  });

  it('returns size with null dimensions when opening fails', async () => {
    openMock.mockRejectedValue(new Error('EIO'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(getImageFileInfo('photo.jpg')).resolves.toEqual({
      width: null,
      height: null,
      size: 2500000,
    });
    warnSpy.mockRestore();
  });
});
