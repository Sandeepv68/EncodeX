import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { HISTORY_LIMITS } from '../../../shared/history/limits';
import { generateHistoryThumbnail } from '../thumbnails';
import { getVideoPreview } from '../../video-preview';

vi.mock('../../video-preview', () => ({ getVideoPreview: vi.fn() }));

const fsMockState = vi.hoisted(() => ({
  statSyncMock: vi.fn(),
  nativeStatSync: undefined as unknown as typeof import('fs').statSync,
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  fsMockState.nativeStatSync = actual.statSync;
  fsMockState.statSyncMock.mockImplementation(actual.statSync);
  return { ...actual, statSync: fsMockState.statSyncMock };
});

const previewMock = vi.mocked(getVideoPreview);
const dataUrl = `data:image/png;base64,${Buffer.from('preview').toString('base64')}`;
const jpegDataUrl = `data:image/jpeg;base64,${Buffer.from('preview').toString('base64')}`;

describe('generateHistoryThumbnail', () => {
  let dir: string;

  beforeEach(() => {
    vi.mocked(statSync).mockImplementation(fsMockState.nativeStatSync);
    dir = mkdtempSync(join(tmpdir(), 'encodex-history-thumbs-'));
    previewMock.mockReset();
  });

  afterEach(() => {
    vi.mocked(statSync).mockImplementation(fsMockState.nativeStatSync);
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads bounded png and jpeg images', async () => {
    const png = join(dir, 'image.png');
    const jpeg = join(dir, 'photo.JPEG');
    writeFileSync(png, Buffer.from('png-bytes'));
    writeFileSync(jpeg, Buffer.from('jpeg-bytes'));

    await expect(generateHistoryThumbnail(png)).resolves.toEqual({ data: Buffer.from('png-bytes'), mimeType: 'image/png' });
    await expect(generateHistoryThumbnail(jpeg)).resolves.toEqual({ data: Buffer.from('jpeg-bytes'), mimeType: 'image/jpeg' });
  });

  it('ignores image files with unsupported thumbnail extensions', async () => {
    const webp = join(dir, 'image.webp');
    writeFileSync(webp, Buffer.from('webp-bytes'));
    await expect(generateHistoryThumbnail(webp)).resolves.toBeNull();
  });

  it('ignores empty, oversized and non-file image paths', async () => {
    const empty = join(dir, 'empty.png');
    const oversized = join(dir, 'oversized.png');
    const directory = join(dir, 'directory.png');
    writeFileSync(empty, Buffer.alloc(0));
    writeFileSync(oversized, Buffer.alloc(HISTORY_LIMITS.maxThumbnailBytes + 1));
    mkdirSync(directory);

    await expect(generateHistoryThumbnail(empty)).resolves.toBeNull();
    await expect(generateHistoryThumbnail(oversized)).resolves.toBeNull();
    await expect(generateHistoryThumbnail(directory)).resolves.toBeNull();
  });

  it('decodes valid video previews and rejects invalid or oversized ones', async () => {
    const video = join(dir, 'clip.mp4');
    writeFileSync(video, Buffer.from('video'));

    previewMock.mockResolvedValueOnce(dataUrl);
    await expect(generateHistoryThumbnail(video)).resolves.toEqual({ data: Buffer.from('preview'), mimeType: 'image/png' });

    previewMock.mockResolvedValueOnce(jpegDataUrl);
    await expect(generateHistoryThumbnail(video)).resolves.toEqual({ data: Buffer.from('preview'), mimeType: 'image/jpeg' });

    previewMock.mockResolvedValueOnce('not-a-data-url');
    await expect(generateHistoryThumbnail(video)).resolves.toBeNull();

    previewMock.mockResolvedValueOnce('data:image/png;base64,');
    await expect(generateHistoryThumbnail(video)).resolves.toBeNull();

    previewMock.mockResolvedValueOnce(`data:image/png;base64,${Buffer.alloc(HISTORY_LIMITS.maxThumbnailBytes + 1).toString('base64')}`);
    await expect(generateHistoryThumbnail(video)).resolves.toBeNull();

    previewMock.mockResolvedValueOnce(null);
    await expect(generateHistoryThumbnail(video)).resolves.toBeNull();
  });

  it('ignores paths that are neither images nor videos', async () => {
    await expect(generateHistoryThumbnail(join(dir, 'notes.txt'))).resolves.toBeNull();
    expect(previewMock).not.toHaveBeenCalled();
  });

  it('logs and suppresses filesystem failures', async () => {
    expectAppLog('warn', 'main/history/thumbnails');
    const image = join(dir, 'broken.png');
    vi.mocked(statSync).mockImplementation(() => {
      throw new Error('stat denied');
    });

    await expect(generateHistoryThumbnail(image)).resolves.toBeNull();
  });

  it('logs and suppresses non-string video preview failures', async () => {
    expectAppLog('warn', 'main/history/thumbnails');
    const video = join(dir, 'clip.mov');
    previewMock.mockRejectedValueOnce('preview exploded');

    await expect(generateHistoryThumbnail(video)).resolves.toBeNull();
  });
});
