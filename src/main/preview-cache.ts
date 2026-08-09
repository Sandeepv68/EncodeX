/**
 * @fileoverview Disk-persisted cache for media preview thumbnails (main process).
 *
 * Preview generation is expensive: the video preview spawns ffmpeg to seek and
 * re-encode a frame, and even image previews base64 the whole file. The
 * renderer's per-session cache avoids re-fetching while it stays alive, but
 * every renderer reload (or app restart) wipes that state, so without a durable
 * cache the same previews get regenerated again and again.
 *
 * This class persists each generated preview to `userData/previews/` keyed by a
 * hash of the source path, so a thumbnail is generated exactly once per file
 * and reused forever after — across renderer reloads, navigation, drag
 * overlays, and app restarts.
 *
 * Change detection: a cached entry is only served when the source file's byte
 * size and modification time still match, so a video/image that is edited on
 * disk transparently gets a fresh preview. Entries are only written for
 * successful generations (non-null data URLs); failures and unsupported files
 * are re-attempted next time instead of being poisoned in the cache. Cache
 * read/write failures are swallowed so the cache can never break previews.
 *
 * The cache directory is injectable (mirroring FileQueuePersistence) so unit
 * tests can point it at a temp directory without touching the Electron `app`
 * global.
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../shared/logger';
import {
  LOG_PREVIEW_CACHE_HIT,
  LOG_PREVIEW_CACHE_MISS,
  LOG_PREVIEW_CACHE_STAT_MISMATCH,
  LOG_PREVIEW_CACHE_WRITE_FAILED,
} from '../shared/log-constants';

/** Directory name of the preview cache inside the user-data directory. */
export const PREVIEW_CACHE_DIRNAME = 'previews';

/**
 * On-disk shape of one cached preview.
 * @interface PreviewCacheEntry
 * @property {number} size - Byte size of the source file when generated.
 * @property {number} mtimeMs - Modification time (integer milliseconds) of the
 *   source file when generated; used together with {@link size} to detect edits.
 * @property {string} dataUrl - The generated base64 data URL.
 */
export interface PreviewCacheEntry {
  size: number;
  mtimeMs: number;
  dataUrl: string;
}

/**
 * Disk-persisted cache for media preview thumbnails.
 *
 * {@link get} returns the cached preview when the source file is unchanged,
 * otherwise it runs the supplied generator and persists the result. Concurrent
 * calls for the same file are deduplicated in memory so a burst of requests
 * (e.g. a drag overlay racing the live card right after a renderer reload)
 * still spawns a single generator invocation.
 * @class PreviewCache
 */
export class PreviewCache {
  /** Cache directory (e.g. `<userData>/previews`). */
  private readonly dir: string;

  /** In-flight lookups keyed by cache file name, deduplicating concurrent calls. */
  private readonly inflight = new Map<string, Promise<string | null>>();

  /** Logger scoped to the preview cache. @const {Logger} log */
  private readonly log = new Logger('main/preview-cache');

  /**
   * Creates a cache rooted inside the given user-data directory.
   * @param {string} userDataDir - Absolute user-data directory (e.g.
   *   `app.getPath('userData')`) where the `previews` subdirectory lives.
   */
  constructor(userDataDir: string) {
    this.dir = path.join(userDataDir, PREVIEW_CACHE_DIRNAME);
  }

  /**
   * Returns the preview data URL for the source file, generating and caching
   * it on a miss.
   *
   * The cached entry is reused only while the source file's size and mtime are
   * unchanged. A missing/unreadable source file bypasses the cache and defers
   * to the generator (which resolves null for such files). Generator results
   * that are null are not persisted.
   *
   * @param {string} filePath - Absolute path of the source media file.
   * @param {() => Promise<string | null>} generate - Produces the preview
   *   (e.g. `() => getVideoPreview(filePath)`).
   * @returns {Promise<string | null>} The data URL, or null when the file has
   *   no usable preview.
   */
  get(filePath: string, generate: () => Promise<string | null>): Promise<string | null> {
    const key = this.keyFor(filePath);
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const pending = this.loadOrGenerate(filePath, key, generate);
    this.inflight.set(key, pending);
    void pending
      .finally(() => {
        this.inflight.delete(key);
      })
      .catch(() => {
        // Swallow the derived rejection; the original promise is returned to
        // the caller and carries the error.
      });
    return pending;
  }

  /**
   * Reads a cached entry and validates it against the current source file, or
   * falls through to {@link generate} and persists a fresh result.
   * @param {string} filePath - Absolute path of the source media file.
   * @param {string} key - Cache file name for the source path.
   * @param {() => Promise<string | null>} generate - Preview generator.
   * @returns {Promise<string | null>} The data URL, or null.
   */
  private async loadOrGenerate(filePath: string, key: string, generate: () => Promise<string | null>): Promise<string | null> {
    const stat = await this.statSource(filePath);
    const entry = await this.readEntry(key);
    if (stat && entry && entry.size === stat.size && entry.mtimeMs === stat.mtimeMs) {
      this.log.debug(LOG_PREVIEW_CACHE_HIT, filePath);
      return entry.dataUrl;
    }
    if (stat && entry) {
      this.log.debug(LOG_PREVIEW_CACHE_STAT_MISMATCH, {
        file: filePath,
        cached: { size: entry.size, mtimeMs: entry.mtimeMs },
        current: { size: stat.size, mtimeMs: stat.mtimeMs },
      });
    }
    this.log.debug(LOG_PREVIEW_CACHE_MISS, filePath);
    const dataUrl = await generate();
    if (stat && dataUrl !== null) {
      await this.writeEntry(key, { size: stat.size, mtimeMs: stat.mtimeMs, dataUrl });
    }
    return dataUrl;
  }

  /**
   * Hashes a source path into a stable cache file name (a short hex digest).
   * @param {string} filePath - Absolute path of the source file.
   * @returns {string} The cache file name (e.g. `1a2b....json`).
   */
  private keyFor(filePath: string): string {
    return `${createHash('sha256').update(filePath).digest('hex').slice(0, 24)}.json`;
  }

  /**
   * Stats the source file, returning its size and mtime when readable.
   * @param {string} filePath - Absolute path of the source file.
   * @returns {Promise<{size: number, mtimeMs: number} | null>} Stat data, or
   *   null when the file is missing or unreadable.
   */
  private async statSource(filePath: string): Promise<{ size: number; mtimeMs: number } | null> {
    try {
      const stat = await fs.promises.stat(filePath);
      return { size: stat.size, mtimeMs: Math.floor(stat.mtimeMs) };
    } catch {
      return null;
    }
  }

  /**
   * Reads and validates a cached entry, or null when missing/unparseable.
   * @param {string} key - Cache file name.
   * @returns {Promise<PreviewCacheEntry | null>} The entry, or null.
   */
  private async readEntry(key: string): Promise<PreviewCacheEntry | null> {
    try {
      const raw = await fs.promises.readFile(path.join(this.dir, key), 'utf8');
      const parsed = JSON.parse(raw) as Partial<PreviewCacheEntry>;
      if (parsed && typeof parsed.size === 'number' && typeof parsed.mtimeMs === 'number' && typeof parsed.dataUrl === 'string') {
        return parsed as PreviewCacheEntry;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Persists a cached entry, creating the cache directory as needed. Write
   * failures are ignored so caching can never break a preview.
   * @param {string} key - Cache file name.
   * @param {PreviewCacheEntry} entry - The entry to persist.
   * @returns {Promise<void>} Resolves once written (or on failure).
   */
  private async writeEntry(key: string, entry: PreviewCacheEntry): Promise<void> {
    try {
      await fs.promises.mkdir(this.dir, { recursive: true });
      await fs.promises.writeFile(path.join(this.dir, key), JSON.stringify(entry), 'utf8');
    } catch (err: unknown) {
      // Cache write failures are non-fatal - log and continue.
      this.log.warn(LOG_PREVIEW_CACHE_WRITE_FAILED, err);
    }
  }
}
