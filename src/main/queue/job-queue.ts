/**
 * @fileoverview Job queue for managing concurrent media conversion tasks.
 * Maintains a FIFO-ish list of conversion jobs, executes them one at a time
 * through the transcoder factory, and relays progress/status/error events to
 * consumers. Because the queue runs a single job at a time (the `running` flag
 * guards `processNext`), concurrency is serialized at the process level; jobs
 * may be added, removed, or cancelled at any time from the IPC layer.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { Logger } from '../../shared/logger';
import { QueueJob, ConversionOptions, TranscoderType } from '../../shared/types';
import { createTranscoder } from '../transcoders/factory';
import type { ITranscoder } from '../transcoders/types';
import { QUEUE_STATUS } from '../../shared/media-options';
import { COMPLETED_PROGRESS } from '../../shared/transcoder-constants';
import {
  LOG_ADD_JOB,
  LOG_ARROW,
  LOG_CANCELLING_ACTIVE_JOB,
  LOG_CANCEL_ALL_CLEARING,
  LOG_CANCEL_JOB,
  LOG_JOB_COMPLETED,
  LOG_JOB_FAILED,
  LOG_JOB_THREW_ON_START,
  LOG_PROCESS_NEXT_ALREADY_RUNNING,
  LOG_PROCESS_NEXT_NO_QUEUED_JOBS,
  LOG_PROCESS_NEXT_STARTING_JOB,
  LOG_QUEUE_SIZE,
  LOG_REMOVE_JOB,
  LOG_TRANSCODER,
} from '../../shared/log-constants';

const log = new Logger('main/queue/job-queue');

/**
 * A serialized queue of media conversion jobs executed through the registered
 * transcoder backends.
 * @class JobQueue
 * @extends EventEmitter
 *
 * @emits {QueueJob} 'added' - Fired after a job is pushed onto the queue
 * @emits {string} 'removed' - Fired with the job id when a job is removed
 *   (explicitly via removeJob or implicitly via cancelJob)
 * @emits {Object} 'statusChange' - Fired with `{ job }` when a job transitions
 *   between QUEUED / RUNNING / DONE / ERROR
 * @emits {Object} 'progress' - Fired with `{ job, progress }` while a job runs;
 *   `progress` is a ConversionProgress from the underlying transcoder
 * @emits {void} 'cancelled' - Fired after cancelAll() clears the queue
 *
 * Concurrency model: `processNext()` is the only place a job is started and it
 * refuses to run while `running` is true, so at most one conversion runs at a
 * time. Jobs are picked in insertion order (first QUEUED entry). Progress,
 * error, and completion handlers always reset `running`/`currentJob`/
 * `currentTranscoder` and call `processNext()` again, which drains the queue
 * until no QUEUED jobs remain.
 */
export class JobQueue extends EventEmitter {
  /** Backing store of all known jobs (queued, running, done, or errored). */
  private queue: QueueJob[] = [];
  /** True while a conversion is in flight, preventing concurrent starts. */
  private running = false;
  /** The job currently being converted, or null when idle. */
  private currentJob: QueueJob | null = null;
  /** The transcoder instance driving the current conversion, or null. */
  private currentTranscoder: ITranscoder | null = null;

  /**
   * Adds a new conversion job to the queue and starts processing.
   *
   * Creates a job with a random UUID, the given input/output/options, the
   * requested transcoder backend, initial status QUEUED, progress 0, and the
   * current timestamp. The job is pushed to the back of the queue, an `added`
   * event is emitted, and `processNext()` is invoked (a no-op if another job is
   * already running).
   * @param {string} input - Absolute path of the input media file
   * @param {string} output - Absolute path where the converted file is written
   * @param {ConversionOptions} options - Encoding/decoding options for the job
   * @param {TranscoderType} transcoder - Backend to use: 'FFMPEG', 'FFTOOL', or 'BMF'
   * @returns {string} The generated unique job id (UUID)
   */
  addJob(input: string, output: string, options: ConversionOptions, transcoder: TranscoderType): string {
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
      createdAt: Date.now(),
    };
    this.queue.push(job);
    log.debug(LOG_QUEUE_SIZE, this.queue.length);
    this.emit('added', job);
    this.processNext();
    return id;
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
  }

  /**
   * Cancels a job: aborts it if running, then removes it from the queue.
   *
   * If the target job is the one currently being converted, the active
   * transcoder's `cancel()` is called (which kills the underlying ffmpeg/BMF
   * process, causing the process 'close' handler to emit a cancellation error
   * and drain the queue). The job is then removed via {@link removeJob},
   * which emits `removed`. Pending (not yet started) jobs are simply dropped.
   * @param {string} id - The job id to cancel
   */
  cancelJob(id: string): void {
    log.info(LOG_CANCEL_JOB, id);
    if (this.currentJob?.id === id && this.currentTranscoder) {
      log.debug(LOG_CANCELLING_ACTIVE_JOB);
      this.currentTranscoder.cancel();
    }
    this.removeJob(id);
  }

  /**
   * Cancels all jobs and resets the queue.
   *
   * Cancels the active transcoder (if any), clears the entire job list, resets
   * `running`, `currentJob` and `currentTranscoder`, and emits a single
   * `cancelled` event. Note that any per-job error/end events fired later by
   * the killed transcoder are effectively ignored because the queue state has
   * already been reset.
   */
  cancelAll(): void {
    log.info(LOG_CANCEL_ALL_CLEARING, this.queue.length, 'jobs');
    if (this.currentTranscoder) {
      this.currentTranscoder.cancel();
    }
    this.queue = [];
    this.currentJob = null;
    this.running = false;
    this.emit('cancelled');
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
   * Starts the next queued job if none is running.
   *
   * Guards against re-entry: if `running` is true this is a no-op. Finds the
   * first job with status QUEUED; if none exists (e.g. all jobs done/errored)
   * it returns silently. Otherwise it marks the job RUNNING, emits
   * `statusChange`, creates a transcoder via {@link createTranscoder}, and calls
   * `transcoder.convert(...)`. The returned emitter is wired up:
   * - `progress` updates `job.progress` and re-emits as `{ job, progress }`,
   * - `error` marks the job ERROR, stores `job.error`, resets state and
   *   recursively calls `processNext()` to drain the queue,
   * - `end` marks the job DONE with 100% progress and drains the queue.
   *
   * If `convert()` throws synchronously (e.g. spawn failure), the job is marked
   * ERROR the same way. All state resets (`running`, `currentJob`,
   * `currentTranscoder`) happen before the recursive `processNext()` so the
   * next job can start immediately.
   */
  private processNext(): void {
    if (this.running) {
      log.debug(LOG_PROCESS_NEXT_ALREADY_RUNNING);
      return;
    }
    const nextJob = this.queue.find((j) => j.status === QUEUE_STATUS.QUEUED);
    if (!nextJob) {
      log.debug(LOG_PROCESS_NEXT_NO_QUEUED_JOBS);
      return;
    }

    log.info(LOG_PROCESS_NEXT_STARTING_JOB, nextJob.id);
    this.running = true;
    this.currentJob = nextJob;
    nextJob.status = QUEUE_STATUS.RUNNING;
    this.emit('statusChange', nextJob);

    const transcoder = createTranscoder(nextJob.transcoder);
    this.currentTranscoder = transcoder;

    try {
      const emitter = transcoder.convert(nextJob.input, nextJob.output, nextJob.options);
      emitter.on('progress', (progress) => {
        nextJob.progress = progress.percent;
        this.emit('progress', { job: nextJob, progress });
      });
      emitter.on('error', (err) => {
        log.error(LOG_JOB_FAILED, nextJob.id, err.message);
        nextJob.status = QUEUE_STATUS.ERROR;
        nextJob.error = err.message;
        this.emit('statusChange', nextJob);
        this.running = false;
        this.currentJob = null;
        this.currentTranscoder = null;
        this.processNext();
      });
      emitter.on('end', () => {
        log.info(LOG_JOB_COMPLETED, nextJob.id);
        nextJob.status = QUEUE_STATUS.DONE;
        nextJob.progress = COMPLETED_PROGRESS.percent;
        this.emit('statusChange', nextJob);
        this.running = false;
        this.currentJob = null;
        this.currentTranscoder = null;
        this.processNext();
      });
    } catch (err: unknown) {
      log.error(LOG_JOB_THREW_ON_START, nextJob.id, err);
      nextJob.status = QUEUE_STATUS.ERROR;
      nextJob.error = err instanceof Error ? err.message : String(err);
      this.emit('statusChange', nextJob);
      this.running = false;
      this.currentJob = null;
      this.currentTranscoder = null;
      this.processNext();
    }
  }
}
