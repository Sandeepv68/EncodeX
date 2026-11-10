/**
 * @fileoverview Durable persistence for the batch conversion queue and the
 * dedicated remux/demux queue.
 *
 * Defines the JSON snapshot contract (`QueueSnapshot`), the minimal adapter
 * interfaces the queues persist through (`QueuePersistence` and
 * `MuxQueuePersistence`), and filesystem implementations that read/write
 * `queue-state.json` and `mux-queue-state.json` inside a user-data directory.
 * Persistence is injectable so the queues can be unit-tested against a temp
 * directory without touching the Electron `app` global.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MUX_QUEUE_STATE_FILENAME, MUX_QUEUE_STATE_VERSION } from '../../shared/constants';
import { isMuxQueueJob } from '../../shared/mux-queue-guards';
import { QUEUE_STATUS } from '../../shared/media-options';
import type { MuxQueueJob, MuxQueueSnapshot, QueueJob } from '../../shared/types';
import type { JsonSnapshot, MuxQueuePersistence, QueuePersistence, QueueSnapshot } from './types';

export type { MuxQueuePersistence, QueuePersistence, QueueSnapshot };

/** File name of the queue snapshot inside the user-data directory. */
export const QUEUE_STATE_FILENAME = 'queue-state.json';

/** Version of the serialized snapshot format; bumped on incompatible changes. */
export const QUEUE_STATE_VERSION = 1;
/**
 * Filesystem-backed JSON persistence with a caller-supplied filename, format
 * version, and job guard. Reads are tolerant: a missing file, unparseable
 * JSON, or a snapshot that fails the guard simply yields null.
 */
class FileJsonPersistence<TJob> {
  private readonly filePath: string;

  constructor(
    userDataDir: string,
    filename: string,
    private readonly version: number,
    private readonly isJob: (value: unknown) => boolean,
  ) {
    this.filePath = path.join(userDataDir, filename);
  }

  load(): JsonSnapshot<TJob> | null {
    let raw: string;
    try {
      raw = fs.readFileSync(this.filePath, 'utf8');
    } catch {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== this.version || !Array.isArray(obj.jobs)) {
      return null;
    }
    const jobs = obj.jobs as unknown[];
    if (!jobs.every((job) => this.isJob(job))) {
      return null;
    }
    return { version: obj.version as number, concurrency: obj.concurrency as number, jobs: jobs as TJob[] };
  }

  save(snapshot: JsonSnapshot<TJob>): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  clear(): void {
    try {
      fs.unlinkSync(this.filePath);
    } catch {
      // No snapshot to clear - ignore.
    }
  }
}

/**
 * Filesystem-backed batch queue persistence writing `queue-state.json` into a
 * user-data directory.
 * @class FileQueuePersistence
 * @implements {QueuePersistence}
 */
export class FileQueuePersistence implements QueuePersistence {
  private readonly store: FileJsonPersistence<QueueJob>;

  /**
   * Creates a persistence adapter rooted at the given user-data directory.
   * @param {string} userDataDir - Absolute user-data directory (e.g.
   *   `app.getPath('userData')`) where `queue-state.json` lives.
   */
  constructor(userDataDir: string) {
    this.store = new FileJsonPersistence<QueueJob>(userDataDir, QUEUE_STATE_FILENAME, QUEUE_STATE_VERSION, isQueueJobLike);
  }

  /** Reads and parses the snapshot file, or returns null when invalid. */
  load(): QueueSnapshot | null {
    return this.store.load();
  }

  /** Writes the snapshot to disk, creating the parent directory as needed. */
  save(snapshot: QueueSnapshot): void {
    this.store.save(snapshot);
  }

  /** Deletes the snapshot file if it exists; missing files are a no-op. */
  clear(): void {
    this.store.clear();
  }
}

/**
 * Filesystem-backed mux queue persistence writing `mux-queue-state.json` into
 * a user-data directory. Validation is delegated to the shared mux snapshot
 * guard so a hostile file cannot construct malformed targets.
 * @class FileMuxQueuePersistence
 * @implements {MuxQueuePersistence}
 */
export class FileMuxQueuePersistence implements MuxQueuePersistence {
  private readonly store: FileJsonPersistence<MuxQueueJob>;

  constructor(userDataDir: string) {
    this.store = new FileJsonPersistence<MuxQueueJob>(userDataDir, MUX_QUEUE_STATE_FILENAME, MUX_QUEUE_STATE_VERSION, isMuxQueueJob);
  }

  /** Reads and parses the mux snapshot, or returns null when invalid. */
  load(): MuxQueueSnapshot | null {
    return this.store.load();
  }

  /** Writes the mux snapshot to disk, creating the parent directory as needed. */
  save(snapshot: MuxQueueSnapshot): void {
    this.store.save(snapshot);
  }

  /** Deletes the mux snapshot file if it exists; missing files are a no-op. */
  clear(): void {
    this.store.clear();
  }
}

/** Minimal shape check to keep a hostile snapshot from constructing. */
function isQueueJobLike(value: unknown): value is QueueJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string') return false;
  if (typeof v.input !== 'string') return false;
  if (typeof v.output !== 'string') return false;
  if (typeof v.status !== 'string') return false;
  if (!Object.values(QUEUE_STATUS).includes(v.status as (typeof QUEUE_STATUS)[keyof typeof QUEUE_STATUS])) return false;
  if (typeof v.progress !== 'number' || !Number.isFinite(v.progress)) return false;
  return true;
}
