/**
 * @fileoverview Engine for the dedicated remux/demux queue.
 *
 * The mux queue is intentionally a separate engine from the batch
 * {@link JobQueue}: it holds remux and demux jobs (each of which owns one or
 * more sequential FFmpeg targets), persists to its own snapshot file, and has
 * its own concurrency cap so demux work never changes batch throughput.
 *
 * The scheduling model mirrors the batch queue: `processNext()` is the only
 * place jobs start, jobs are picked highest-priority-first then in insertion
 * order, and nothing starts automatically - a job added to the queue stays
 * QUEUED until {@link start} is called or a running queue frees a slot.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { Logger } from '../../shared/logger';
import { createError, ErrorCode, outputExistsError } from '../../shared/errors';
import { QUEUE_STATUS } from '../../shared/media-options';
import { COMPLETED_PROGRESS } from '../../shared/transcoder-constants';
import { DEFAULT_MUX_QUEUE_CONCURRENCY, MAX_MUX_QUEUE_TARGETS, MUX_QUEUE_STATE_VERSION } from '../../shared/constants';
import type { ConversionProgress, MuxQueueAddPayload, MuxQueueJob, MuxQueueSnapshot, TranscoderType } from '../../shared/types';
import { createTranscoder } from '../transcoders/factory';
import type { ITranscoder } from '../transcoders/types';
import { MuxJobRunner } from './mux-job-runner';
import { clampConcurrency, moveQueuedJob, nextQueuedJob, normalizeOutputPath } from './queue-utils';
import { batchOutputClaims, muxOutputClaims } from './output-claims';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import { targetCountBucket } from '../../shared/analytics/analytics-summaries';
import type { MuxQueueOptions, MuxQueuePersistence } from './types';
import {
  LOG_ARROW,
  LOG_MUX_QUEUE_CANCELLED,
  LOG_MUX_QUEUE_CLEAR_COMPLETED,
  LOG_MUX_QUEUE_DRAINED,
  LOG_MUX_QUEUE_JOB_ADDED,
  LOG_MUX_QUEUE_JOB_COMPLETED,
  LOG_MUX_QUEUE_JOB_FAILED,
  LOG_MUX_QUEUE_JOB_REMOVED,
  LOG_MUX_QUEUE_JOB_STATUS_CHANGE,
  LOG_MUX_QUEUE_MOVE_REJECTED_NON_FINITE,
  LOG_MUX_QUEUE_MOVE_SKIPPED,
  LOG_MUX_QUEUE_MOVE_TO,
  LOG_MUX_QUEUE_PAUSE,
  LOG_MUX_QUEUE_RESUME,
  LOG_MUX_QUEUE_SET_CONCURRENCY,
  LOG_MUX_QUEUE_SIZE,
  LOG_MUX_QUEUE_START,
  LOG_MUX_QUEUE_STATE_CLEARED,
  LOG_MUX_QUEUE_STATE_RESTORED,
  LOG_MUX_QUEUE_STATE_SAVED,
  LOG_TRANSCODER,
} from '../../shared/log-constants';

const log = new Logger('main/queue/mux-queue');

/**
 * Default debounce delay before a mux queue mutation is written to disk.
 * @const {number} DEFAULT_PERSIST_DELAY_MS
 */
const DEFAULT_PERSIST_DELAY_MS = 500;

/**
 * A concurrency-capped queue of remux and demux jobs.
 * @class MuxQueue
 * @extends EventEmitter
 *
 * @emits {MuxQueueJob} 'added' - Fired after a job is queued
 * @emits {string} 'removed' - Fired with the job id when a job is removed
 * @emits {MuxQueueJob} 'statusChange' - Fired when a job changes status
 * @emits {Object} 'progress' - Fired with `{ job, progress }` while a job runs
 * @emits {void} 'cancelled' - Fired after cancelAll() clears the queue
 * @emits {Object} 'moved' - Fired with `{ id, toPosition }` after a reorder
 * @emits {void} 'drained' - Fired once the queue drains after real completions
 */
export class MuxQueue extends EventEmitter {
  /** Backing store of all known mux jobs. */
  private queue: MuxQueueJob[] = [];
  /** The runner driving each in-flight job, keyed by job id. */
  private activeJobs = new Map<string, MuxJobRunner>();
  /** Maximum number of mux jobs running in parallel. */
  private concurrency: number;
  /** True while the queue is paused. */
  private paused = false;
  /** Optional adapter that restores/persists mux queue state across restarts. */
  private readonly persistence?: MuxQueuePersistence;
  /** Debounce delay before a mutation is persisted, in milliseconds. */
  private readonly persistDelayMs: number;
  /** Factory used to create the transcoder running each job's targets. */
  private readonly transcoderFactory: (type: TranscoderType) => ITranscoder;
  /** Pending debounced persistence timer, or null when none is scheduled. */
  private persistTimer: NodeJS.Timeout | null = null;
  /** True once at least one job reached a terminal state since the last drain. */
  private jobCompletedSinceLastDrain = false;

  /**
   * Creates a mux queue and restores a persisted snapshot when one is
   * available. Restored RUNNING jobs become QUEUED (progress reset) so they
   * re-run on launch; nothing starts automatically.
   * @param {MuxQueueOptions} [options] - Construction options.
   */
  constructor(options: MuxQueueOptions = {}) {
    super();
    this.concurrency = clampConcurrency(options.concurrency ?? DEFAULT_MUX_QUEUE_CONCURRENCY, DEFAULT_MUX_QUEUE_CONCURRENCY);
    this.persistence = options.persistence;
    this.persistDelayMs = options.persistDelayMs ?? DEFAULT_PERSIST_DELAY_MS;
    this.transcoderFactory = options.transcoderFactory ?? createTranscoder;
    this.loadPersistedState();
  }

  /**
   * Restores a previously persisted mux snapshot, if any.
   * @returns {void}
   */
  private loadPersistedState(): void {
    if (!this.persistence) return;
    const snapshot = this.persistence.load();
    if (!snapshot) return;
    this.concurrency = clampConcurrency(snapshot.concurrency, this.concurrency);
    for (const job of snapshot.jobs) {
      if (job.status === QUEUE_STATUS.RUNNING) {
        job.status = QUEUE_STATUS.QUEUED;
        job.progress = 0;
      }
      job.paused = false;
      this.queue.push(job);
    }
    log.info(LOG_MUX_QUEUE_STATE_RESTORED, this.queue.length, 'jobs');
  }

  /**
   * Schedules a debounced write of the current queue state.
   * @returns {void}
   */
  private schedulePersist(): void {
    const persistence = this.persistence;
    if (!persistence) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      persistence.save(this.buildSnapshot());
      log.debug(LOG_MUX_QUEUE_STATE_SAVED, this.queue.length, 'jobs');
    }, this.persistDelayMs);
    this.persistTimer.unref?.();
  }

  /**
   * Serializes the current queue into a persistable snapshot.
   * @returns {MuxQueueSnapshot} The snapshot to persist.
   */
  private buildSnapshot(): MuxQueueSnapshot {
    return {
      version: MUX_QUEUE_STATE_VERSION,
      concurrency: this.concurrency,
      jobs: this.queue.map((job) => ({ ...job })),
    };
  }

  /**
   * Writes the current queue state immediately, cancelling any pending
   * debounced write.
   * @returns {void}
   */
  flushState(): void {
    if (!this.persistence) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persistence.save(this.buildSnapshot());
    log.debug(LOG_MUX_QUEUE_STATE_SAVED, this.queue.length, 'jobs');
  }

  /**
   * Returns the current concurrency cap.
   * @returns {number} The number of mux jobs that may run in parallel.
   */
  getConcurrency(): number {
    return this.concurrency;
  }

  /**
   * Returns whether the queue is paused.
   * @returns {boolean} True while jobs are suspended.
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Updates the concurrency cap, clamping it into the legal range. A running
   * queue refills the freed slots; a stopped queue is never started here.
   * @param {number} concurrency - The new cap.
   * @returns {void}
   */
  setConcurrency(concurrency: number): void {
    this.concurrency = clampConcurrency(concurrency, this.concurrency);
    log.info(LOG_MUX_QUEUE_SET_CONCURRENCY, this.concurrency);
    this.schedulePersist();
    if (this.activeJobs.size > 0) {
      this.processNext();
    }
  }

  /**
   * Adds a remux or demux job to the queue without starting it.
   *
   * Rejects a job whose target outputs are already claimed by another mux job:
   * the queue would otherwise run the same extraction twice and the second
   * run would overwrite the first one's output.
   * @param {MuxQueueAddPayload} payload - The validated job description.
   * @returns {string} The generated unique job id (UUID).
   * @throws {AppError} QUEUE_ERROR when a target output is already claimed.
   */
  addJob(payload: MuxQueueAddPayload): string {
    if (payload.targets.length === 0 || payload.targets.length > MAX_MUX_QUEUE_TARGETS) {
      throw createError(ErrorCode.QUEUE_ERROR, 'The mux queue job has an invalid number of targets.');
    }
    const seen = new Set<string>();
    for (const target of payload.targets) {
      const normalized = normalizeOutputPath(target.output);
      if (seen.has(normalized)) {
        throw createError(ErrorCode.QUEUE_ERROR, `The output "${target.output}" is listed twice in the same job.`);
      }
      seen.add(normalized);
    }
    const claimed = this.collectClaimedOutputs();
    for (const target of payload.targets) {
      const normalized = normalizeOutputPath(target.output);
      if (claimed.has(normalized)) {
        throw createError(ErrorCode.QUEUE_ERROR, `The output "${target.output}" is already claimed by another mux queue job.`);
      }
    }
    const batchConflicts = batchOutputClaims.findConflicts(payload.targets.map((target) => target.output));
    if (batchConflicts.length > 0) {
      throw createError(ErrorCode.QUEUE_ERROR, `The output "${batchConflicts[0]}" is already claimed by the batch queue.`);
    }
    if (payload.overwrite !== true) {
      for (const target of payload.targets) {
        if (existsSync(target.output)) {
          throw outputExistsError(target.output);
        }
      }
    }
    const id = randomUUID();
    const transcoder: TranscoderType = payload.transcoder ?? 'FFMPEG';
    log.info(LOG_MUX_QUEUE_JOB_ADDED, id, payload.kind, payload.input, LOG_ARROW, payload.output, LOG_TRANSCODER, transcoder);
    const job: MuxQueueJob = {
      id,
      kind: payload.kind,
      input: payload.input,
      output: payload.output,
      targets: payload.targets.map((target) => ({ ...target })),
      transcoder,
      status: QUEUE_STATUS.QUEUED,
      progress: 0,
      priority: 0,
      createdAt: Date.now(),
    };
    this.queue.push(job);
    for (const target of payload.targets) {
      claimed.add(normalizeOutputPath(target.output));
      muxOutputClaims.claim(target.output, id);
    }
    log.debug(LOG_MUX_QUEUE_SIZE, this.queue.length);
    recordAnalyticsEvent(
      createAnalyticsEvent('mux_queue_job_added', {
        kind: payload.kind,
        targetCountBucket: targetCountBucket(payload.targets.length),
        transcoder: transcoder,
      }),
    );
    this.emit('added', job);
    this.schedulePersist();
    return id;
  }

  /**
   * Collects every output path already claimed by a job in the queue.
   * @returns {Set<string>} Normalized output paths.
   */
  private collectClaimedOutputs(): Set<string> {
    const paths = new Set<string>();
    for (const job of this.queue) {
      for (const target of job.targets) {
        paths.add(normalizeOutputPath(target.output));
      }
    }
    return paths;
  }

  /**
   * Reports whether an output path is already claimed by a mux queue job.
   * Used by the cross-queue collision check.
   * @param {string} output - The output path to test.
   * @returns {boolean} True when the path is claimed.
   */
  hasOutputPath(output: string): boolean {
    return this.collectClaimedOutputs().has(normalizeOutputPath(output));
  }

  /**
   * Starts processing the queued jobs.
   * @returns {void}
   */
  start(): void {
    log.info(LOG_MUX_QUEUE_START);
    this.paused = false;
    const queued = this.queue.filter((job: MuxQueueJob) => job.status === QUEUE_STATUS.QUEUED);
    if (queued.length > 0) {
      recordAnalyticsEvent(
        createAnalyticsEvent('mux_queue_started', {
          jobCount: queued.length,
          kindMix: queued.some((job: MuxQueueJob) => job.kind === 'demux')
            ? queued.some((job: MuxQueueJob) => job.kind === 'remux')
              ? 'mixed'
              : 'demux'
            : 'remux',
        }),
      );
    }
    this.processNext();
  }

  /**
   * Pauses the queue: suspends every active runner and blocks new jobs.
   * @returns {void}
   */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    log.info(LOG_MUX_QUEUE_PAUSE, this.activeJobs.size, 'active jobs');
    for (const runner of this.activeJobs.values()) {
      runner.pause();
    }
    for (const job of this.queue) {
      if (job.status === QUEUE_STATUS.RUNNING) {
        job.paused = true;
        this.emitStatusChange(job);
      }
    }
    this.schedulePersist();
  }

  /**
   * Resumes the queue and drains it so queued jobs can start again.
   * @returns {void}
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    log.info(LOG_MUX_QUEUE_RESUME, this.activeJobs.size, 'active jobs');
    for (const runner of this.activeJobs.values()) {
      runner.resume();
    }
    for (const job of this.queue) {
      if (job.paused) {
        job.paused = false;
        this.emitStatusChange(job);
      }
    }
    this.schedulePersist();
    this.processNext();
  }

  /**
   * Removes a job from the queue by id without cancelling it.
   * @param {string} id - The job id to remove.
   * @returns {void}
   */
  removeJob(id: string): void {
    log.info(LOG_MUX_QUEUE_JOB_REMOVED, id);
    const removed = this.queue.find((job: MuxQueueJob) => job.id === id);
    this.queue = this.queue.filter((job) => job.id !== id);
    if (removed) {
      for (const target of removed.targets) {
        muxOutputClaims.release(target.output, id);
      }
    }
    log.debug(LOG_MUX_QUEUE_SIZE, this.queue.length);
    this.emit('removed', id);
    this.schedulePersist();
  }

  /**
   * Cancels a job: aborts it if running, then removes it from the queue.
   * @param {string} id - The job id to cancel.
   * @returns {void}
   */
  cancelJob(id: string): void {
    const runner = this.activeJobs.get(id);
    if (runner) {
      runner.cancel();
      this.activeJobs.delete(id);
    }
    this.removeJob(id);
    if (runner) {
      this.processNext();
    }
  }

  /**
   * Cancels all jobs and resets the queue.
   * @returns {void}
   */
  cancelAll(): void {
    const cancelledCount = this.queue.length;
    for (const runner of this.activeJobs.values()) {
      runner.cancel();
    }
    for (const job of this.queue) {
      for (const target of job.targets) {
        muxOutputClaims.release(target.output, job.id);
      }
    }
    this.activeJobs.clear();
    this.queue = [];
    this.paused = false;
    this.jobCompletedSinceLastDrain = false;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persistence?.clear();
    log.info(LOG_MUX_QUEUE_STATE_CLEARED);
    log.info(LOG_MUX_QUEUE_CANCELLED);
    recordAnalyticsEvent(createAnalyticsEvent('mux_queue_cancelled', { count: cancelledCount }));
    this.emit('cancelled');
  }

  /**
   * Removes every completed and failed job from the queue.
   * @returns {number} How many jobs were removed.
   */
  clearCompleted(): number {
    const completed = this.queue.filter((job) => job.status === QUEUE_STATUS.DONE || job.status === QUEUE_STATUS.ERROR);
    log.info(LOG_MUX_QUEUE_CLEAR_COMPLETED, completed.length, 'jobs');
    for (const job of completed) {
      this.removeJob(job.id);
    }
    return completed.length;
  }

  /**
   * Moves a QUEUED job to a target position within the QUEUED subsequence.
   * @param {string} id - The id of the QUEUED job to move.
   * @param {number} toPosition - Target index within the QUEUED subsequence.
   * @returns {boolean} True when the job was moved.
   */
  moveJobTo(id: string, toPosition: number): boolean {
    if (typeof toPosition !== 'number' || !Number.isFinite(toPosition)) {
      log.debug(LOG_MUX_QUEUE_MOVE_REJECTED_NON_FINITE, id, toPosition);
      return false;
    }
    const applied = moveQueuedJob(this.queue, id, toPosition);
    if (applied === -1) {
      log.debug(LOG_MUX_QUEUE_MOVE_SKIPPED, id);
      return false;
    }
    log.info(LOG_MUX_QUEUE_MOVE_TO, id, applied);
    this.emit('moved', { id, toPosition: applied });
    this.schedulePersist();
    return true;
  }

  /**
   * Returns a shallow copy of the current job list.
   * @returns {MuxQueueJob[]} Snapshot of all jobs in the queue.
   */
  getJobs(): MuxQueueJob[] {
    return [...this.queue];
  }

  /**
   * Returns the queue's runtime state.
   * @returns {{paused: boolean, concurrency: number}} The paused flag and cap.
   */
  getState(): { paused: boolean; concurrency: number } {
    return { paused: this.paused, concurrency: this.concurrency };
  }

  /**
   * Emits a job status change and logs it.
   * @param {MuxQueueJob} job - The job after its status transition.
   * @returns {void}
   */
  private emitStatusChange(job: MuxQueueJob): void {
    log.debug(LOG_MUX_QUEUE_JOB_STATUS_CHANGE, job.id, job.status);
    this.emit('statusChange', job);
  }

  /**
   * Emits `drained` when the queue has fully drained after real completions.
   * @returns {void}
   */
  private emitDrainedIfIdle(): void {
    if (this.activeJobs.size === 0 && this.jobCompletedSinceLastDrain) {
      this.jobCompletedSinceLastDrain = false;
      log.info(LOG_MUX_QUEUE_DRAINED);
      const done = this.queue.filter((job: MuxQueueJob) => job.status === QUEUE_STATUS.DONE).length;
      const failed = this.queue.filter((job: MuxQueueJob) => job.status === QUEUE_STATUS.ERROR).length;
      recordAnalyticsEvent(createAnalyticsEvent('mux_queue_completed', { completed: done, failed }));
      this.emit('drained');
    }
  }

  /**
   * Starts queued jobs until the concurrency cap is reached.
   * @returns {void}
   */
  private processNext(): void {
    if (this.paused) return;
    while (!this.paused && this.activeJobs.size < this.concurrency) {
      const next = nextQueuedJob(this.queue);
      if (!next) {
        this.emitDrainedIfIdle();
        return;
      }
      this.startJob(next);
    }
  }

  /**
   * True while the queue still holds the job with the given id.
   * @param {string} id - The job id to look for.
   * @returns {boolean} True while the job is present.
   */
  private holdsJob(id: string): boolean {
    return this.queue.some((job) => job.id === id);
  }

  /**
   * Marks the job RUNNING and wires its runner's lifecycle events.
   * @param {MuxQueueJob} job - The QUEUED job to start.
   * @returns {void}
   */
  private startJob(job: MuxQueueJob): void {
    job.status = QUEUE_STATUS.RUNNING;
    job.paused = false;
    this.emitStatusChange(job);
    this.schedulePersist();

    const runner = new MuxJobRunner(job, this.transcoderFactory);
    this.activeJobs.set(job.id, runner);

    runner.on('progress', ({ job: activeJob, progress }: { job: MuxQueueJob; progress: ConversionProgress }) => {
      if (this.holdsJob(activeJob.id)) {
        this.emit('progress', { job: activeJob, progress });
      }
    });

    runner.on('end', () => {
      const wasActive = this.activeJobs.delete(job.id);
      log.info(LOG_MUX_QUEUE_JOB_COMPLETED, job.id);
      job.status = QUEUE_STATUS.DONE;
      job.paused = false;
      job.progress = COMPLETED_PROGRESS.percent;
      this.schedulePersist();
      if (this.holdsJob(job.id)) {
        this.emitStatusChange(job);
      }
      if (wasActive) {
        this.jobCompletedSinceLastDrain = true;
      }
      this.processNext();
    });

    runner.on('error', (err: Error) => {
      const wasActive = this.activeJobs.delete(job.id);
      log.error(LOG_MUX_QUEUE_JOB_FAILED, job.id, err?.message ?? String(err));
      const code = (err as { code?: string }).code;
      if (code !== ErrorCode.CANCELLED) {
        recordAnalyticsEvent(
          createAnalyticsEvent('mux_queue_failed', {
            kind: job.kind,
            code: typeof code === 'string' ? code : undefined,
          }),
        );
      }
      job.status = QUEUE_STATUS.ERROR;
      job.paused = false;
      job.error = err?.message ?? String(err);
      this.schedulePersist();
      if (this.holdsJob(job.id)) {
        this.emitStatusChange(job);
      }
      if (wasActive && (err as { code?: string }).code !== ErrorCode.CANCELLED) {
        this.jobCompletedSinceLastDrain = true;
      }
      this.processNext();
    });

    runner.start();
  }
}
