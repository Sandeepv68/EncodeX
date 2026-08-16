/**
 * @fileoverview Job queue for managing concurrent media conversion tasks.
 * Maintains a FIFO-ish list of conversion jobs, executes up to `concurrency`
 * jobs in parallel through the transcoder factory, and relays
 * progress/status/error events to consumers. Because the queue caps how many
 * jobs run at once (the active set is drained by `processNext`), the number of
 * simultaneous conversions is bounded; jobs may be added, removed, or
 * cancelled at any time from the IPC layer. When a persistence adapter is
 * supplied, the queue restores itself across restarts and debounce-writes its
 * state to disk after mutations.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { Logger } from '../../shared/logger';
import { QueueJob, ConversionOptions, TranscoderType } from '../../shared/types';
import { ErrorCode } from '../../shared/errors';
import { createTranscoder } from '../transcoders/factory';
import type { ITranscoder } from '../transcoders/types';
import { QUEUE_STATUS } from '../../shared/media-options';
import { COMPLETED_PROGRESS } from '../../shared/transcoder-constants';
import { MAX_QUEUE_CONCURRENCY } from '../../shared/constants';
import { QUEUE_STATE_VERSION, QueuePersistence } from './persistence';
import {
  LOG_ADD_JOB,
  LOG_ARROW,
  LOG_CANCELLING_ACTIVE_JOB,
  LOG_CANCEL_ALL_CLEARING,
  LOG_CANCEL_JOB,
  LOG_JOB_COMPLETED,
  LOG_JOB_FAILED,
  LOG_JOB_THREW_ON_START,
  LOG_PROCESS_NEXT_NO_QUEUED_JOBS,
  LOG_PROCESS_NEXT_STARTING_JOB,
  LOG_QUEUE_CLEAR_COMPLETED,
  LOG_QUEUE_DRAINED,
  LOG_QUEUE_MOVE_TO,
  LOG_QUEUE_MOVE_SKIPPED,
  LOG_QUEUE_MOVE_TO_CLAMPED,
  LOG_QUEUE_UPDATE_OPTIONS,
  LOG_QUEUE_UPDATE_OPTIONS_SKIPPED,
  LOG_QUEUE_PAUSE,
  LOG_QUEUE_RESUME,
  LOG_QUEUE_START,
  LOG_QUEUE_SET_CONCURRENCY,
  LOG_QUEUE_SIZE,
  LOG_QUEUE_STATE_CLEARED,
  LOG_QUEUE_STATE_RESTORED,
  LOG_QUEUE_STATE_SAVED,
  LOG_REMOVE_JOB,
  LOG_TRANSCODER,
} from '../../shared/log-constants';

const log = new Logger('main/queue/job-queue');

/**
 * Default debounce delay before a queue mutation is written to disk.
 * @const {number} DEFAULT_PERSIST_DELAY_MS
 */
const DEFAULT_PERSIST_DELAY_MS = 500;

/**
 * Construction options for a {@link JobQueue}.
 * @interface JobQueueOptions
 * @property {number} [concurrency=1] - Initial concurrency cap (clamped 1-4).
 * @property {QueuePersistence} [persistence] - Optional adapter used to restore
 *   the queue on startup and persist it after mutations. When omitted, the
 *   queue is in-memory only.
 * @property {number} [persistDelayMs=500] - Debounce delay before a mutation is
 *   written through the persistence adapter.
 */
export interface JobQueueOptions {
  concurrency?: number;
  persistence?: QueuePersistence;
  persistDelayMs?: number;
}

/**
 * A concurrency-capped queue of media conversion jobs executed through the
 * registered transcoder backends.
 * @class JobQueue
 * @extends EventEmitter
 *
 * @emits {QueueJob} 'added' - Fired after a job is pushed onto the queue
 * @emits {string} 'removed' - Fired with the job id when a job is removed
 *   (explicitly via removeJob or implicitly via cancelJob)
 * @emits {Object} 'statusChange' - Fired with `{ job }` when a job transitions
 *   between QUEUED / RUNNING / DONE / ERROR
 * @emits {Object} 'moved' - Fired with `{ id, toPosition }` after a QUEUED job
 *   is reordered via moveJobTo
 * @emits {Object} 'progress' - Fired with `{ job, progress }` while a job runs;
 *   `progress` is a ConversionProgress from the underlying transcoder
 * @emits {void} 'cancelled' - Fired after cancelAll() clears the queue
 * @emits {void} 'drained' - Fired once the queue fully drains after at least
 *   one job reached a terminal state (DONE or non-cancelled ERROR) and no
 *   queued or active jobs remain. Cancellations never emit it.
 *
 * Concurrency model: `processNext()` is the only place jobs are started. It
 * starts new QUEUED jobs while fewer than `concurrency` conversions are in
 * flight (tracked by `activeJobs`), so at most `concurrency` conversions run
 * at once. Jobs are picked highest `priority` first, then in insertion order
 * (first QUEUED entries). Every progress, error, and completion handler
 * removes the finished job from the active set and calls `processNext()`
 * again, which drains the queue until no QUEUED jobs remain.
 *
 * Explicit start: jobs added via `addJob()` (and jobs restored from a
 * persisted snapshot) are left QUEUED until {@link start} is called - nothing
 * starts automatically. `processNext()` is invoked only by `start()`, by
 * `resume()` after a pause, and by the in-flight completion/error handlers so
 * a running queue drains. Changing the concurrency cap refills currently
 * active slots but never starts a stopped queue.
 */
export class JobQueue extends EventEmitter {
  /** Backing store of all known jobs (queued, running, done, or errored). */
  private queue: QueueJob[] = [];
  /** The transcoder driving each in-flight conversion, keyed by job id. */
  private activeJobs = new Map<string, ITranscoder>();
  /** Maximum number of conversions running in parallel (1-4). */
  private concurrency: number;
  /** True while the queue is paused: active conversions are suspended and no
   * new QUEUED jobs are started until resume(). */
  private paused = false;
  /** Optional adapter that restores/persists queue state across restarts. */
  private readonly persistence?: QueuePersistence;
  /** Debounce delay before a mutation is persisted, in milliseconds. */
  private readonly persistDelayMs: number;
  /** Pending debounced persistence timer, or null when none is scheduled. */
  private persistTimer: NodeJS.Timeout | null = null;
  /** True once at least one job reached a terminal state (DONE or non-cancelled
   * ERROR) since the last 'drained' emission or queue reset. Gates the
   * 'drained' event so it only fires for natural completions, never for
   * cancels or no-ops. */
  private jobCompletedSinceLastDrain = false;

  /**
   * Creates a queue that runs up to `concurrency` conversions in parallel.
   * When a persistence adapter is provided, a previously saved snapshot is
   * loaded immediately: RUNNING jobs are remapped to QUEUED (progress reset)
   * so they re-run on launch, DONE/ERROR entries are preserved, and the saved
   * concurrency cap is restored. Nothing starts automatically - call
   * {@link start} to process the restored QUEUED jobs.
   * @param {number | JobQueueOptions} [options=1] - Concurrency cap as a bare
   *   number, or a full {@link JobQueueOptions} object.
   */
  constructor(options: number | JobQueueOptions = {}) {
    super();
    const resolved: JobQueueOptions = typeof options === 'number' ? { concurrency: options } : options;
    this.concurrency = Math.min(Math.max(resolved.concurrency ?? 1, 1), MAX_QUEUE_CONCURRENCY);
    this.persistence = resolved.persistence;
    this.persistDelayMs = resolved.persistDelayMs ?? DEFAULT_PERSIST_DELAY_MS;
    this.loadPersistedState();
  }

  /**
   * Restores a previously persisted snapshot, if any.
   *
   * RUNNING jobs are downgraded to QUEUED (with progress reset) so they are
   * re-run on launch; DONE/ERROR jobs are kept as-is; the saved concurrency
   * cap is applied (clamped). No events are emitted: the renderer performs a
   * fresh `queueList()` on mount. Restored jobs stay QUEUED until {@link start}
   * is called.
   * @returns {void}
   */
  private loadPersistedState(): void {
    if (!this.persistence) return;
    const snapshot = this.persistence.load();
    if (!snapshot) return;
    this.concurrency = Math.min(Math.max(snapshot.concurrency ?? 1, 1), MAX_QUEUE_CONCURRENCY);
    for (const job of snapshot.jobs) {
      if (job.status === QUEUE_STATUS.RUNNING) {
        job.status = QUEUE_STATUS.QUEUED;
        job.progress = 0;
      }
      job.paused = false;
      this.queue.push(job);
    }
    log.info(LOG_QUEUE_STATE_RESTORED, this.queue.length, 'jobs');
  }

  /**
   * Schedules a debounced write of the current queue state through the
   * persistence adapter. Multiple rapid mutations collapse into a single disk
   * write; the timer is unref'd so it never keeps the process alive.
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
      log.debug(LOG_QUEUE_STATE_SAVED, this.queue.length, 'jobs');
    }, this.persistDelayMs);
    this.persistTimer.unref?.();
  }

  /**
   * Serializes the current queue into a persistable snapshot.
   * @returns {import('./persistence').QueueSnapshot} The snapshot to persist.
   */
  private buildSnapshot(): import('./persistence').QueueSnapshot {
    return {
      version: QUEUE_STATE_VERSION,
      concurrency: this.concurrency,
      jobs: this.queue.map((job) => ({ ...job })),
    };
  }

  /**
   * Writes the current queue state immediately, cancelling any pending
   * debounced write. Useful on app shutdown and in tests.
   * @returns {void}
   */
  flushState(): void {
    if (!this.persistence) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persistence.save(this.buildSnapshot());
    log.debug(LOG_QUEUE_STATE_SAVED, this.queue.length, 'jobs');
  }

  /**
   * Updates the concurrency cap. If the queue is currently running (at least
   * one active conversion), now-possible queued jobs are started to refill the
   * freed slots; a stopped queue is never started by this method.
   * The value is clamped to 1-4.
   * @param {number} concurrency - The new cap (1-4).
   * @returns {void}
   */
  setConcurrency(concurrency: number): void {
    this.concurrency = Math.min(Math.max(concurrency, 1), MAX_QUEUE_CONCURRENCY);
    log.info(LOG_QUEUE_SET_CONCURRENCY, this.concurrency);
    this.schedulePersist();
    if (this.activeJobs.size > 0) {
      this.processNext();
    }
  }

  /**
   * Returns whether the queue is currently paused.
   * @returns {boolean} True while conversions are suspended.
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Returns the current concurrency cap (1-4).
   * @returns {number} The number of jobs that may run in parallel.
   */
  getConcurrency(): number {
    return this.concurrency;
  }

  /**
   * Pauses the whole queue: suspends every active conversion, marks its job
   * `paused` (emitting a statusChange per affected job so the renderer styles
   * the progress bar), and blocks new jobs from starting until {@link resume}
   * is called.
   * @returns {void}
   */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    log.info(LOG_QUEUE_PAUSE, this.activeJobs.size, 'active jobs');
    for (const transcoder of this.activeJobs.values()) {
      transcoder.pause();
    }
    for (const job of this.queue) {
      if (job.status === QUEUE_STATUS.RUNNING) {
        job.paused = true;
        this.emit('statusChange', job);
      }
    }
    this.schedulePersist();
  }

  /**
   * Resumes a paused queue: resumes every active conversion, clears the
   * `paused` flag on affected jobs (emitting a statusChange per job), and
   * drains the queue so queued jobs can start again.
   * @returns {void}
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    log.info(LOG_QUEUE_RESUME, this.activeJobs.size, 'active jobs');
    for (const transcoder of this.activeJobs.values()) {
      transcoder.resume();
    }
    for (const job of this.queue) {
      if (job.paused) {
        job.paused = false;
        this.emit('statusChange', job);
      }
    }
    this.schedulePersist();
    this.processNext();
  }

  /**
   * Adds a new conversion job to the queue without starting it.
   *
   * Creates a job with a random UUID, the given input/output/options, the
   * requested transcoder backend, initial status QUEUED, progress 0, and the
   * current timestamp. The job is pushed to the back of the queue and an
   * `added` event is emitted. The job stays QUEUED until {@link start} is
   * called (or, if the queue is already running, until a slot frees up) - it
   * is never started automatically by adding files.
   * @param {string} input - Absolute path of the input media file
   * @param {string} output - Absolute path where the converted file is written
   * @param {ConversionOptions} options - Encoding/decoding options for the job
   * @param {TranscoderType} transcoder - Backend to use: 'FFMPEG', 'FFTOOL', or 'BMF'
   * @param {number} [priority=0] - Scheduling priority; higher-priority jobs
   *   start before lower-priority QUEUED jobs.
   * @returns {string} The generated unique job id (UUID)
   */
  addJob(input: string, output: string, options: ConversionOptions, transcoder: TranscoderType, priority = 0): string {
    const id = randomUUID();
    log.info(LOG_ADD_JOB, id, input, LOG_ARROW, output, LOG_TRANSCODER, transcoder);
    const job: QueueJob = {
      id,
      input,
      output,
      options,
      transcoder,
      status: QUEUE_STATUS.QUEUED,
      progress: 0,
      priority,
      createdAt: Date.now(),
    };
    this.queue.push(job);
    log.debug(LOG_QUEUE_SIZE, this.queue.length);
    this.emit('added', job);
    this.schedulePersist();
    return id;
  }

  /**
   * Starts processing the queued jobs.
   *
   * Marks the queue as not paused and invokes `processNext()`, which begins
   * running QUEUED jobs up to the concurrency cap. No-op when the queue is
   * already running or when there is nothing queued.
   * @returns {void}
   */
  start(): void {
    log.info(LOG_QUEUE_START);
    this.paused = false;
    this.processNext();
  }

  /**
   * Removes a job from the queue by id without cancelling it.
   *
   * Filters the queue so the given id is dropped. If the job was already
   * running, removing it from the queue has no effect on the live ffmpeg
   * process - use {@link cancelJob} to abort an in-flight conversion. Emits a
   * `removed` event with the id.
   * @param {string} id - The job id to remove
   */
  removeJob(id: string): void {
    log.info(LOG_REMOVE_JOB, id);
    this.queue = this.queue.filter((j) => j.id !== id);
    log.debug(LOG_QUEUE_SIZE, this.queue.length);
    this.emit('removed', id);
    this.schedulePersist();
  }

  /**
   * Cancels a job: aborts it if running, then removes it from the queue.
   *
   * If the target job is currently being converted, the active transcoder's
   * `cancel()` is called (which kills the underlying ffmpeg/BMF process,
   * causing the process 'close' handler to emit a cancellation error and drain
   * the queue). The job is then removed via {@link removeJob}, which emits
   * `removed`. Pending (not yet started) jobs are simply dropped.
   * @param {string} id - The job id to cancel
   */
  cancelJob(id: string): void {
    log.info(LOG_CANCEL_JOB, id);
    const transcoder = this.activeJobs.get(id);
    if (transcoder) {
      log.debug(LOG_CANCELLING_ACTIVE_JOB);
      transcoder.cancel();
    }
    this.removeJob(id);
  }

  /**
   * Cancels all jobs and resets the queue.
   *
   * Cancels every active transcoder, clears the entire job list and the active
   * set, and emits a single `cancelled` event. Note that any per-job
   * error/end events fired later by the killed transcoders are effectively
   * ignored because the queue state has already been reset.
   */
  cancelAll(): void {
    log.info(LOG_CANCEL_ALL_CLEARING, this.queue.length, 'jobs');
    for (const transcoder of this.activeJobs.values()) {
      transcoder.cancel();
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
    log.info(LOG_QUEUE_STATE_CLEARED);
    this.emit('cancelled');
  }

  /**
   * Removes every completed (DONE) and failed (ERROR) job from the queue.
   *
   * Queued and running jobs are kept; a `removed` event is emitted for each
   * dropped entry so the renderer stays in sync. Returns the number of jobs
   * removed.
   * @returns {number} How many jobs were removed.
   */
  clearCompleted(): number {
    const completed = this.queue.filter((j) => j.status === QUEUE_STATUS.DONE || j.status === QUEUE_STATUS.ERROR);
    log.info(LOG_QUEUE_CLEAR_COMPLETED, completed.length, 'jobs');
    for (const job of completed) {
      this.removeJob(job.id);
    }
    return completed.length;
  }

  /**
   * Moves a QUEUED job to a target position within the QUEUED subsequence,
   * preserving the slots of non-queued (running/done/errored) jobs. The target
   * is clamped to `[0, queuedCount - 1]`; jobs without a matching id, non-queued
   * jobs, and no-op moves return `false`.
   *
   * On success a `moved` event is emitted with `{ id, toPosition }` so the
   * renderer can mirror the reorder. Used by the batch queue drag-and-drop
   * reordering (position-based, unlike the old one-step arrow buttons).
   * @param {string} id - The id of the QUEUED job to move.
   * @param {number} toPosition - Target index within the QUEUED subsequence.
   * @returns {boolean} True when the job was moved.
   */
  moveJobTo(id: string, toPosition: number): boolean {
    const queuedIndexes = this.queue.map((job, index) => (job.status === QUEUE_STATUS.QUEUED ? index : -1)).filter((index) => index !== -1);
    const fromPos = queuedIndexes.findIndex((index) => this.queue[index].id === id);
    if (fromPos === -1) {
      log.debug(LOG_QUEUE_MOVE_SKIPPED, id);
      return false;
    }
    const toPos = Math.max(0, Math.min(Math.floor(toPosition), queuedIndexes.length - 1));
    if (toPos === fromPos) {
      log.debug(LOG_QUEUE_MOVE_TO_CLAMPED, id, toPos);
      return false;
    }
    const ordered = queuedIndexes.map((index) => this.queue[index]);
    const [moved] = ordered.splice(fromPos, 1);
    ordered.splice(toPos, 0, moved);
    queuedIndexes.forEach((index, k) => {
      this.queue[index] = ordered[k];
    });
    log.info(LOG_QUEUE_MOVE_TO, id, toPos);
    this.emit('moved', { id, toPosition: toPos });
    this.schedulePersist();
    return true;
  }

  /**
   * Replaces the encoding options (and optionally the output path) of a QUEUED
   * job.
   *
   * Only jobs that are still waiting (status QUEUED) can be edited - a job that
   * is RUNNING is handed to the transcoder with a fixed output, and DONE/ERROR
   * jobs are terminal. On success the job's `options` are replaced wholesale
   * (and `output` when given), the mutation is persisted, and a `statusChange`
   * event is emitted so the renderer's store refresh picks up the new values.
   * @param {string} id - The id of the QUEUED job to update.
   * @param {ConversionOptions} options - The full replacement options object.
   * @param {string} [output] - Optional new absolute output path; when omitted
   *   the job keeps its current output.
   * @returns {boolean} True when the job was updated, false when the id is
   *   unknown or the job is no longer QUEUED.
   */
  updateJobOptions(id: string, options: ConversionOptions, output?: string): boolean {
    log.info(LOG_QUEUE_UPDATE_OPTIONS, id);
    const job = this.queue.find((j) => j.id === id);
    if (!job || job.status !== QUEUE_STATUS.QUEUED) {
      log.debug(LOG_QUEUE_UPDATE_OPTIONS_SKIPPED, id);
      return false;
    }
    job.options = { ...options };
    if (output) {
      job.output = output;
    }
    this.schedulePersist();
    this.emit('statusChange', job);
    return true;
  }

  /**
   * Returns a shallow copy of the current job list.
   *
   * The returned array is a new array, so mutating it does not affect the
   * internal queue; however the QueueJob objects themselves are shared
   * references.
   * @returns {QueueJob[]} Snapshot of all jobs in the queue
   */
  getJobs(): QueueJob[] {
    return [...this.queue];
  }

  /**
   * Emits the `drained` event when the queue has fully drained since the last
   * natural completion. Called from `processNext` whenever no QUEUED jobs
   * remain: if the active set is empty and at least one job reached a terminal
   * state since the last drain (or reset), the flag is cleared and `drained`
   * is emitted. Cancellations reset the flag and never trigger it, so a
   * cancel-all or single-job cancel cannot arm the "when done" power action.
   * @returns {void}
   */
  private emitDrainedIfIdle(): void {
    if (this.activeJobs.size === 0 && this.jobCompletedSinceLastDrain) {
      this.jobCompletedSinceLastDrain = false;
      log.info(LOG_QUEUE_DRAINED);
      this.emit('drained');
    }
  }

  /**
   * Starts queued jobs until the concurrency cap is reached.
   *
   * While fewer than `concurrency` conversions are in flight, takes the next
   * QUEUED job in insertion order and starts it via {@link startJob}. When no
   * QUEUED jobs remain or the cap is reached, returns silently.
   * @returns {void}
   */
  private processNext(): void {
    if (this.paused) {
      log.debug(LOG_PROCESS_NEXT_NO_QUEUED_JOBS);
      return;
    }
    while (this.activeJobs.size < this.concurrency) {
      const queued = this.queue.filter((j) => j.status === QUEUE_STATUS.QUEUED);
      if (queued.length === 0) {
        log.debug(LOG_PROCESS_NEXT_NO_QUEUED_JOBS);
        this.emitDrainedIfIdle();
        return;
      }
      const maxPriority = Math.max(...queued.map((j) => j.priority ?? 0));
      const nextJob = queued.find((j) => (j.priority ?? 0) === maxPriority) as QueueJob;
      this.startJob(nextJob);
    }
  }

  /**
   * Marks the job RUNNING, creates its transcoder, and wires the conversion
   * emitter. Registers the transcoder in `activeJobs` under the job id and
   * wires up the emitter lifecycle:
   * - `progress` updates `job.progress` and re-emits as `{ job, progress }`,
   * - `error` marks the job ERROR, stores `job.error`, removes the job from
   *   `activeJobs` and recursively calls `processNext()` to drain the queue,
   * - `end` marks the job DONE with 100% progress and drains the queue.
   *
   * If `convert()` throws synchronously (e.g. spawn failure), the job is marked
   * ERROR the same way. In every terminal branch the job is removed from
   * `activeJobs` before `processNext()` so the next queued job can start.
   * @param {QueueJob} nextJob - The QUEUED job to start.
   * @returns {void}
   */
  private startJob(nextJob: QueueJob): void {
    log.info(LOG_PROCESS_NEXT_STARTING_JOB, nextJob.id);
    nextJob.status = QUEUE_STATUS.RUNNING;
    nextJob.paused = false;
    this.emit('statusChange', nextJob);
    this.schedulePersist();

    const transcoder = createTranscoder(nextJob.transcoder);
    this.activeJobs.set(nextJob.id, transcoder);

    try {
      const emitter = transcoder.convert(nextJob.input, nextJob.output, nextJob.options);
      emitter.on('progress', (progress) => {
        nextJob.progress = progress.percent;
        this.schedulePersist();
        this.emit('progress', { job: nextJob, progress });
      });
      emitter.on('error', (err) => {
        const wasActive = this.activeJobs.delete(nextJob.id);
        log.error(LOG_JOB_FAILED, nextJob.id, err.message);
        nextJob.status = QUEUE_STATUS.ERROR;
        nextJob.error = err.message;
        this.schedulePersist();
        this.emit('statusChange', nextJob);
        if (wasActive && err.code !== ErrorCode.CANCELLED) {
          this.jobCompletedSinceLastDrain = true;
        }
        this.processNext();
      });
      emitter.on('end', () => {
        const wasActive = this.activeJobs.delete(nextJob.id);
        log.info(LOG_JOB_COMPLETED, nextJob.id);
        nextJob.status = QUEUE_STATUS.DONE;
        nextJob.progress = COMPLETED_PROGRESS.percent;
        this.schedulePersist();
        this.emit('statusChange', nextJob);
        if (wasActive) {
          this.jobCompletedSinceLastDrain = true;
        }
        this.processNext();
      });
    } catch (err: unknown) {
      this.activeJobs.delete(nextJob.id);
      log.error(LOG_JOB_THREW_ON_START, nextJob.id, err);
      nextJob.status = QUEUE_STATUS.ERROR;
      nextJob.error = err instanceof Error ? err.message : String(err);
      this.schedulePersist();
      this.emit('statusChange', nextJob);
      this.jobCompletedSinceLastDrain = true;
      this.processNext();
    }
  }
}
