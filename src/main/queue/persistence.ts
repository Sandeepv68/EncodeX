/**
 * @fileoverview Durable persistence for the batch conversion queue.
 * Defines the JSON snapshot contract (`QueueSnapshot`), the minimal adapter
 * interface the queue persists through (`QueuePersistence`), and a filesystem
 * implementation (`FileQueuePersistence`) that reads/writes
 * `queue-state.json` inside a user-data directory. Persistence is injectable
 * so the queue can be unit-tested against a temp directory without touching
 * the Electron `app` global.
 */

import * as fs from 'fs';
import * as path from 'path';
import { QueueJob } from '../../shared/types';

/** File name of the queue snapshot inside the user-data directory. */
export const QUEUE_STATE_FILENAME = 'queue-state.json';

/** Version of the serialized snapshot format; bumped on incompatible changes. */
export const QUEUE_STATE_VERSION = 1;

/**
 * A serializable snapshot of the queue that can be restored after a restart.
 * @interface QueueSnapshot
 * @property {number} version - Snapshot format version ({@link QUEUE_STATE_VERSION}).
 * @property {number} concurrency - The concurrency cap in effect when saved.
 * @property {QueueJob[]} jobs - All known jobs; RUNNING entries are remapped to
 *   QUEUED when restored so they are re-run on launch.
 */
export interface QueueSnapshot {
  version: number;
  concurrency: number;
  jobs: QueueJob[];
}

/**
 * Minimal adapter the queue uses to persist and restore its state.
 * @interface QueuePersistence
 */
export interface QueuePersistence {
  /** Loads a previously saved snapshot, or null when none/invalid exists. */
  load(): QueueSnapshot | null;
  /** Persists the given snapshot (replacing any previous state). */
  save(snapshot: QueueSnapshot): void;
  /** Deletes any persisted snapshot (used by cancel-all). */
  clear(): void;
}

/**
 * Filesystem-backed queue persistence writing `queue-state.json` into a
 * user-data directory. Reads are tolerant: a missing file, unparseable JSON,
 * or a snapshot without a `jobs` array simply yields null.
 * @class FileQueuePersistence
 * @implements {QueuePersistence}
 */
export class FileQueuePersistence implements QueuePersistence {
  /** Absolute path of the snapshot file. */
  private readonly filePath: string;

  /**
   * Creates a persistence adapter rooted at the given user-data directory.
   * @param {string} userDataDir - Absolute user-data directory (e.g.
   *   `app.getPath('userData')`) where `queue-state.json` lives.
   */
  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, QUEUE_STATE_FILENAME);
  }

  /**
   * Reads and parses the snapshot file, or returns null when it is missing,
   * unparseable, or structurally invalid.
   * @returns {QueueSnapshot | null} The restored snapshot, or null.
   */
  load(): QueueSnapshot | null {
    let raw: string;
    try {
      raw = fs.readFileSync(this.filePath, 'utf8');
    } catch {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<QueueSnapshot>;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.jobs)) {
        return null;
      }
      return parsed as QueueSnapshot;
    } catch {
      return null;
    }
  }

  /**
   * Writes the snapshot to disk, creating the parent directory as needed.
   * @param {QueueSnapshot} snapshot - The snapshot to persist.
   * @returns {void}
   */
  save(snapshot: QueueSnapshot): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  /**
   * Deletes the snapshot file if it exists; missing files are a no-op.
   * @returns {void}
   */
  clear(): void {
    try {
      fs.unlinkSync(this.filePath);
    } catch {
      // No snapshot to clear - ignore.
    }
  }
}
