/**
 * @fileoverview Serialization and validation for batch queue export/import.
 * Defines the portable JSON contract (`QueueExport`) used by the queue-export
 * and queue-import IPC channels, plus the builders and validators that convert
 * between live {@link QueueJob} objects and the file format. The export format
 * is deliberately minimal: only the fields needed to re-enqueue a job (input,
 * output, options, transcoder) are written, so imported queues work across
 * versions without leaking runtime state such as ids, status, or progress.
 */

import { ConversionOptions, QueueJob, TranscoderType } from '../../shared/types';

/** Version of the export file format; bumped on incompatible changes. */
export const QUEUE_EXPORT_VERSION = 1;

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

/**
 * Builds a portable export snapshot from the live job list, projecting each
 * job down to its re-enqueuable fields (input/output/options/transcoder).
 * @param {QueueJob[]} jobs - The current queue jobs.
 * @param {number} concurrency - The concurrency cap to record in the file.
 * @returns {QueueExport} The serializable snapshot.
 */
export function buildQueueExport(jobs: QueueJob[], concurrency: number): QueueExport {
  return {
    version: QUEUE_EXPORT_VERSION,
    concurrency,
    jobs: jobs.map(({ input, output, options, transcoder }) => ({ input, output, options, transcoder })),
  };
}

/**
 * Parses and validates raw JSON text into a {@link QueueExport}, or null when
 * the text is not valid JSON or does not match the expected structure.
 * @param {string} raw - The file contents to parse.
 * @returns {QueueExport | null} The validated export, or null on failure.
 */
export function parseQueueExport(raw: string): QueueExport | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return validateQueueExport(parsed);
}

/**
 * Validates an unknown value against the QueueExport shape: the version must
 * match {@link QUEUE_EXPORT_VERSION}, `concurrency` must be a number, and
 * `jobs` must be a non-empty-capable array of records carrying string
 * input/output/transcoder plus an options object. Returns the value re-cast as
 * a {@link QueueExport} when valid, otherwise null.
 * @param {unknown} value - The value to validate.
 * @returns {QueueExport | null} The validated export, or null when invalid.
 */
export function validateQueueExport(value: unknown): QueueExport | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.version !== QUEUE_EXPORT_VERSION) return null;
  if (typeof v.concurrency !== 'number') return null;
  if (!Array.isArray(v.jobs)) return null;
  for (const job of v.jobs) {
    if (!job || typeof job !== 'object') return null;
    const j = job as Record<string, unknown>;
    if (typeof j.input !== 'string' || typeof j.output !== 'string' || typeof j.transcoder !== 'string') return null;
    if (!j.options || typeof j.options !== 'object') return null;
  }
  return { version: v.version, concurrency: v.concurrency, jobs: v.jobs as QueueExportJob[] };
}
