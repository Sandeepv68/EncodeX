/**
 * @fileoverview MCP-facing asynchronous conversion manager.
 * Wraps the shared {@link JobQueue} and exposes a small, MCP-friendly surface:
 * enqueue a conversion (returns immediately with a job id), query jobs, and
 * cancel them. Consumers poll {@link getJob}/{@link listJobs} to observe
 * progress, exactly as the GUI does through its IPC layer.
 *
 * The underlying queue caps concurrency (1-`MAX_QUEUE_CONCURRENCY`), so at most
 * `concurrency` conversions run in parallel. A transcoder factory can be
 * injected so tests can drive jobs with deterministic fakes.
 */

import { JobQueue } from '../../main/queue/job-queue';
import type { ITranscoder } from '../../main/transcoders/types';
import type { ConversionOptions, TranscoderType } from '../../shared/types';
import { QUEUE_STATUS } from '../../shared/media-options';
import { MAX_QUEUE_CONCURRENCY } from '../../shared/constants';

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

/**
 * Maps a {@link QUEUE_STATUS} value to its MCP-facing status string.
 * @param {string} status - QUEUE_STATUS value from the queue.
 * @returns {MCPJobStatus} The mapped MCP status.
 */
function mapStatus(status: string): MCPJobStatus {
  switch (status) {
    case QUEUE_STATUS.RUNNING:
      return 'running';
    case QUEUE_STATUS.DONE:
      return 'done';
    case QUEUE_STATUS.ERROR:
      return 'error';
    default:
      return 'queued';
  }
}

/**
 * Async conversion manager for the MCP layer.
 * @class MCPJobManager
 */
export class MCPJobManager {
  private readonly queue: JobQueue;

  /**
   * Creates a manager owning a {@link JobQueue} capped at `concurrency`.
   * @param {MCPJobManagerOptions} [options] - Optional concurrency/factory overrides.
   */
  constructor(options: MCPJobManagerOptions = {}) {
    this.queue = new JobQueue({
      concurrency: Math.min(Math.max(Math.floor(options.concurrency ?? 1), 1), MAX_QUEUE_CONCURRENCY),
      transcoderFactory: options.transcoderFactory,
    });
  }

  /**
   * Enqueues a conversion and starts processing immediately.
   *
   * Returns as soon as the job is queued with its generated id and initial
   * `queued` status; the actual transcoding runs in the background. Safe to
   * call while jobs are already running - the queue drains slots as they free.
   *
   * @param {string} input - Absolute input file path.
   * @param {string} output - Absolute output file path.
   * @param {ConversionOptions} options - Encoder/decoder options for the job.
   * @param {TranscoderType} [transcoder='FFMPEG'] - Backend to run the job.
   * @returns {MCPJob} The serialized, newly queued job.
   */
  enqueue(input: string, output: string, options: ConversionOptions, transcoder: TranscoderType = 'FFMPEG'): MCPJob {
    const id = this.queue.addJob(input, output, options, transcoder);
    this.queue.start();
    const job = this.queue.getJobs().find((j) => j.id === id);
    return job ? this.serialize(job) : this.fallbackJob(id, input, output, options);
  }

  /**
   * Returns the current MCP view of a job by id, or `undefined` when unknown
   * (or since cancelled - cancelled jobs are removed from the queue).
   * @param {string} id - The job id.
   * @returns {MCPJob | undefined} The serialized job, if present.
   */
  getJob(id: string): MCPJob | undefined {
    const job = this.queue.getJobs().find((j) => j.id === id);
    return job ? this.serialize(job) : undefined;
  }

  /**
   * Returns the MCP view of every known job, oldest first.
   * @returns {MCPJob[]} All jobs currently tracked by the queue.
   */
  listJobs(): MCPJob[] {
    return this.queue.getJobs().map((job) => this.serialize(job));
  }

  /**
   * Cancels a job, aborting it when running and removing it from the queue.
   * @param {string} id - The job id to cancel.
   * @returns {boolean} True when the job existed (and was cancelled), false when unknown.
   */
  cancelJob(id: string): boolean {
    const existed = this.queue.getJobs().some((j) => j.id === id);
    if (existed) {
      this.queue.cancelJob(id);
    }
    return existed;
  }

  /**
   * Cancels every queued and running job and resets the queue, mirroring the
   * GUI's "cancel all" action on the shared queue.
   * @returns {void}
   */
  cancelAll(): void {
    this.queue.cancelAll();
  }

  /**
   * Updates the shared queue's concurrency cap (clamped to 1-max by the queue).
   * Applied to the active queue, so it takes effect for queued and future jobs.
   * @param {number} concurrency - The new cap (1-`MAX_QUEUE_CONCURRENCY`).
   * @returns {void}
   */
  setConcurrency(concurrency: number): void {
    this.queue.setConcurrency(concurrency);
  }

  /**
   * Returns the number of jobs (queued + running) that are not yet terminal.
   * @returns {number} Count of non-terminal (queued/running) jobs.
   */
  pendingCount(): number {
    return this.queue.getJobs().filter((j) => j.status === QUEUE_STATUS.QUEUED || j.status === QUEUE_STATUS.RUNNING).length;
  }

  /**
   * Serializes a queue job into its MCP-facing view.
   * @param {import('../../shared/types').QueueJob} job - The queue job.
   * @returns {MCPJob} The serialized job.
   */
  private serialize(job: import('../../shared/types').QueueJob): MCPJob {
    return {
      id: job.id,
      input: job.input,
      output: job.output,
      status: mapStatus(job.status),
      progress: job.progress,
      error: job.error,
      createdAt: job.createdAt,
    };
  }

  /**
   * Last-resort view used if the queued job cannot be re-found synchronously
   * (should not happen; addJob always appends before returning).
   * @param {string} id - The generated job id.
   * @param {string} input - The input path.
   * @param {string} output - The output path.
   * @param {ConversionOptions} options - The job options.
   * @returns {MCPJob} A synthetic queued job view.
   */
  private fallbackJob(id: string, input: string, output: string, _options: ConversionOptions): MCPJob {
    return { id, input, output, status: 'queued', progress: 0, createdAt: Date.now() };
  }
}
