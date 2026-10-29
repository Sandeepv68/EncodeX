/**
 * @fileoverview Type definitions for the batch conversion queue.
 * Describes the queue's construction options, the durable snapshot contract the
 * queue persists through, and the portable export/import format used by the
 * queue-export and queue-import IPC channels.
 */

import type { ConversionOptions, QueueJob, TranscoderType } from '../../shared/types';
import type { ITranscoder } from '../transcoders/types';

/**
 * Construction options for a {@link JobQueue}.
 * @interface JobQueueOptions
 * @property {number} [concurrency=1] - Initial concurrency cap (clamped 1-4).
 * @property {QueuePersistence} [persistence] - Optional adapter used to restore
 *   the queue on startup and persist it after mutations. When omitted, the
 *   queue is in-memory only.
 * @property {number} [persistDelayMs=500] - Debounce delay before a mutation is
 *   written through the persistence adapter.
 * @property {function(TranscoderType): ITranscoder} [transcoderFactory] -
 *   Factory used to create the transcoder driving each job. Defaults to
 *   {@link createTranscoder}; overridable so tests (and the MCP layer) can
 *   inject deterministic fakes.
 */
export interface JobQueueOptions {
  concurrency?: number;
  persistence?: QueuePersistence;
  persistDelayMs?: number;
  transcoderFactory?: (type: TranscoderType) => ITranscoder;
}

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
 * A single portable job record inside a {@link QueueExport} file.
 * @interface QueueExportJob
 * @property {string} input - Absolute path of the source file.
 * @property {string} output - Absolute path of the destination file.
 * @property {ConversionOptions} options - Encoding options for the job.
 * @property {TranscoderType} transcoder - Transcoder backend to use.
 */
export interface QueueExportJob {
  input: string;
  output: string;
  options: ConversionOptions;
  transcoder: TranscoderType;
}

/**
 * The portable JSON shape written by queue export and read by queue import.
 * @interface QueueExport
 * @property {number} version - Export format version ({@link QUEUE_EXPORT_VERSION}).
 * @property {number} concurrency - The concurrency cap in effect when exported.
 * @property {QueueExportJob[]} jobs - One record per queued job.
 */
export interface QueueExport {
  version: number;
  concurrency: number;
  jobs: QueueExportJob[];
}
