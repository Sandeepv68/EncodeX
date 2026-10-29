/**
 * @fileoverview Type definitions for the MCP job manager.
 * Describes the MCP-facing view of a queued conversion: its lifecycle status,
 * the serialized job record, and the construction options of the manager that
 * owns the shared job queue.
 */

import type { ITranscoder } from '../../main/transcoders/types';
import type { TranscoderType } from '../../shared/types';

/**
 * MCP-facing job lifecycle status. Cancelled jobs are removed entirely, so
 * 'cancelled' is never observed.
 * @typedef {'queued'|'running'|'done'|'error'} MCPJobStatus
 */
export type MCPJobStatus = 'queued' | 'running' | 'done' | 'error';

/**
 * Serialized, MCP-facing view of a queued conversion job.
 * @interface MCPJob
 * @property {string} id - Unique job id (UUID) returned by {@link MCPJobManager.enqueue}.
 * @property {string} input - Absolute input file path.
 * @property {string} output - Absolute output file path.
 * @property {MCPJobStatus} status - Current lifecycle status.
 * @property {number} progress - Progress percentage (0-100).
 * @property {string} [error] - Error message when the job failed.
 * @property {number} createdAt - Epoch milliseconds when the job was created.
 */
export interface MCPJob {
  id: string;
  input: string;
  output: string;
  status: MCPJobStatus;
  progress: number;
  error?: string;
  createdAt: number;
}

/**
 * Construction options for a {@link MCPJobManager}.
 * @interface MCPJobManagerOptions
 * @property {number} [concurrency=1] - Max parallel conversions, clamped to
 *   the 1-`MAX_QUEUE_CONCURRENCY` range.
 * @property {function(TranscoderType): ITranscoder} [transcoderFactory] -
 *   Overrides the transcoder backend creation (test seam; defaults to the
 *   shared factory).
 */
export interface MCPJobManagerOptions {
  concurrency?: number;
  transcoderFactory?: (type: TranscoderType) => ITranscoder;
}
