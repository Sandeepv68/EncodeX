import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PreviewCache, PREVIEW_CACHE_DIRNAME } from '../preview-cache';

/**
 * Creates a temp directory for one test's cache and source files.
 * @returns {Promise<{ dir: string, source: string }>} Temp dir paths.
 */
async function makeTempDir(): Promise<{ dir: string; source: string }> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'encx-preview-cache-'));
  const source = path.join(dir, 'clip.mp4');
  await fs.promises.writeFile(source, 'video-bytes');
  return { dir, source };
}

describe('PreviewCache', () => {
  it('generates on first request and serves the cached result afterwards', async () => {
    const { dir, source } = await makeTempDir();
    const cache = new PreviewCache(dir);
    const generate = vi.fn().mockResolvedValue('data:image/png;base64,VIDEO');

    await expect(cache.get(source, generate)).resolves.toBe('data:image/png;base64,VIDEO');
    await expect(cache.get(source, generate)).resolves.toBe('data:image/png;base64,VIDEO');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('persists the entry to disk so a new cache instance reuses it', async () => {
    const { dir, source } = await makeTempDir();
    const generate = vi.fn().mockResolvedValue('data:image/png;base64,VIDEO');

    await new PreviewCache(dir).get(source, generate);
    expect(generate).toHaveBeenCalledTimes(1);

    const fresh = new PreviewCache(dir);
    await expect(fresh.get(source, generate)).resolves.toBe('data:image/png;base64,VIDEO');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('regenerates when the source file content changes size', async () => {
    const { dir, source } = await makeTempDir();
    const cache = new PreviewCache(dir);
    const generate = vi.fn().mockResolvedValue('data:image/png;base64,VIDEO');

    await cache.get(source, generate);
    expect(generate).toHaveBeenCalledTimes(1);

    await fs.promises.writeFile(source, 'video-bytes-edited-longer');
    await expect(cache.get(source, generate)).resolves.toBe('data:image/png;base64,VIDEO');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('regenerates when the source mtime changes even if the size stays the same', async () => {
    const { dir, source } = await makeTempDir();
    const cache = new PreviewCache(dir);
    const generate = vi.fn().mockResolvedValue('data:image/png;base64,VIDEO');

    await cache.get(source, generate);
    expect(generate).toHaveBeenCalledTimes(1);

    const future = new Date(Date.now() + 60_000);
    await fs.promises.utimes(source, future, future);
    await expect(cache.get(source, generate)).resolves.toBe('data:image/png;base64,VIDEO');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent requests into a single generation', async () => {
    const { dir, source } = await makeTempDir();
    const cache = new PreviewCache(dir);
    let resolveLoad: ((url: string | null) => void) | undefined;
    const generate = vi.fn().mockReturnValue(
      new Promise<string | null>((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const first = cache.get(source, generate);
    const second = cache.get(source, generate);
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    resolveLoad?.('data:image/png;base64,VIDEO');
    await expect(first).resolves.toBe('data:image/png;base64,VIDEO');
    await expect(second).resolves.toBe('data:image/png;base64,VIDEO');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('does not cache null results, so they are re-attempted next time', async () => {
    const { dir, source } = await makeTempDir();
    const cache = new PreviewCache(dir);
    const generate = vi.fn().mockResolvedValue(null);

    await expect(cache.get(source, generate)).resolves.toBeNull();
    await expect(cache.get(source, generate)).resolves.toBeNull();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('defers to the generator when the source file is missing', async () => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'encx-preview-cache-'));
    const cache = new PreviewCache(dir);
    const generate = vi.fn().mockResolvedValue(null);

    await expect(cache.get(path.join(dir, 'missing.mp4'), generate)).resolves.toBeNull();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('rejects when the generator rejects', async () => {
    const { dir, source } = await makeTempDir();
    const cache = new PreviewCache(dir);
    const generate = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(cache.get(source, generate)).rejects.toThrow('boom');
  });

  it('writes entries into a previews subdirectory', async () => {
    const { dir, source } = await makeTempDir();
    const cache = new PreviewCache(dir);
    await cache.get(source, vi.fn().mockResolvedValue('data:image/png;base64,VIDEO'));

    const entries = await fs.promises.readdir(path.join(dir, PREVIEW_CACHE_DIRNAME));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatch(/\.json$/);
  });
});
