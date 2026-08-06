/**
 * @fileoverview IPC handlers for the batch conversion job queue.
 * Registers handlers for the QUEUE_ADD, QUEUE_REMOVE, QUEUE_LIST and
 * QUEUE_CANCEL_ALL channels and forwards the JobQueue's lifecycle events to
 * the renderer on the QUEUE_ADDED, QUEUE_REMOVED, QUEUE_STATUS_CHANGE,
 * QUEUE_PROGRESS and QUEUE_CANCELLED channels. One JobQueue instance
 * (src/main/queue/job-queue.ts) is created per registration call and executes
 * conversions sequentially in the main process, running at most one job at a
 * time and processing the next queued job on completion.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { JobQueue } from '../queue/job-queue';
import { Logger } from '../../shared/logger';
import { ConversionOptions, QueueJob, TranscoderType, ConversionProgress } from '../../shared/types';
import { IPC } from '../../shared/ipc-channels';
import type { IpcSender } from './types';
import {
  LOG_ARROW,
  LOG_IPC_QUEUE_ADD,
  LOG_IPC_QUEUE_CANCEL_ALL_CALLED,
  LOG_IPC_QUEUE_LIST,
  LOG_IPC_QUEUE_REMOVE,
  LOG_QUEUE_CANCELLED,
  LOG_QUEUE_JOB_ADDED,
  LOG_QUEUE_JOB_REMOVED,
  LOG_QUEUE_JOB_STATUS_CHANGE,
  LOG_TRANSCODER,
} from '../../shared/log-constants';

const log = new Logger('main/ipc/queue');

/**
 * Registers the job-queue IPC handlers for the given window.
 *
 * @param {BrowserWindow} _win - The BrowserWindow associated with the
 *   renderer. Unused directly; retained for API symmetry with the other
 *   registration modules.
 * @param {IpcSender} send - Main→renderer sender used to push queue lifecycle
 *   events (added, removed, status change, progress, cancelled).
 * @returns {void} Nothing is returned.
 */
export function registerQueueHandlers(_win: BrowserWindow, send: IpcSender): void {
  /** The job queue backing these handlers; one instance per registration call. */
  const jobQueue = new JobQueue();

  /**
   * Handles the IPC.QUEUE_ADD channel (queue-add).
   * Enqueues a new conversion job. The job is queued, processing is kicked
   * off (if idle), and a QUEUE_ADDED event with the full job is pushed.
   *
   * @param {string} input - Absolute path of the source media file.
   * @param {string} output - Absolute path of the destination file.
   * @param {ConversionOptions} options - Codec, bitrate, scaling and trim
   *   options for the job.
   * @param {TranscoderType} transcoder - Transcoder backend to use
   *   ('FFMPEG' | 'FFTOOL' | 'BMF').
   * @returns {Promise<string>} The id of the newly created job.
   */
  ipcMain.handle(IPC.QUEUE_ADD, async (_event, input: string, output: string, options: ConversionOptions, transcoder: TranscoderType) => {
    log.info(LOG_IPC_QUEUE_ADD, input, LOG_ARROW, output, LOG_TRANSCODER, transcoder);
    return jobQueue.addJob(input, output, options, transcoder);
  });

  /**
   * Handles the IPC.QUEUE_REMOVE channel (queue-remove).
   * Cancels and removes the job with the given id. If it is the currently
   * active job its transcoder is cancelled first; a QUEUE_REMOVED event is
   * pushed afterwards.
   *
   * @param {string} id - Id of the job to cancel and remove.
   * @returns {Promise<void>} Resolves after the cancellation is issued.
   */
  ipcMain.handle(IPC.QUEUE_REMOVE, async (_event, id: string) => {
    log.info(LOG_IPC_QUEUE_REMOVE, id);
    jobQueue.cancelJob(id);
  });

  /**
   * Handles the IPC.QUEUE_LIST channel (queue-list).
   * Returns a snapshot of all current jobs (queued, running, completed or
   * errored).
   *
   * @returns {Promise<QueueJob[]>} A copy of the job queue array.
   */
  ipcMain.handle(IPC.QUEUE_LIST, async () => {
    const jobs = jobQueue.getJobs();
    log.debug(LOG_IPC_QUEUE_LIST, jobs.length, 'jobs');
    return jobs;
  });

  /**
   * Handles the IPC.QUEUE_CANCEL_ALL channel (queue-cancel-all).
   * Cancels the active job (if any) and clears the entire queue, then pushes
   * a QUEUE_CANCELLED notification to the renderer.
   *
   * @returns {Promise<void>} Resolves after the queue is cleared.
   */
  ipcMain.handle(IPC.QUEUE_CANCEL_ALL, async () => {
    log.info(LOG_IPC_QUEUE_CANCEL_ALL_CALLED);
    jobQueue.cancelAll();
  });

  /**
   * Pushes IPC.QUEUE_ADDED with the newly queued job.
   * @param {QueueJob} job - The job that was added to the queue.
   * @returns {void} Nothing is returned.
   */
  jobQueue.on('added', (job: QueueJob) => {
    log.info(LOG_QUEUE_JOB_ADDED, job.id, job.input);
    send(IPC.QUEUE_ADDED, job);
  });

  /**
   * Pushes IPC.QUEUE_REMOVED with the id of the removed job.
   * @param {string} id - Id of the job that was removed.
   * @returns {void} Nothing is returned.
   */
  jobQueue.on('removed', (id: string) => {
    log.info(LOG_QUEUE_JOB_REMOVED, id);
    send(IPC.QUEUE_REMOVED, id);
  });

  /**
   * Pushes IPC.QUEUE_STATUS_CHANGE with the job whose status changed.
   * @param {QueueJob} job - The job snapshot after its status transition
   *   (queued, running, completed, error, etc.).
   * @returns {void} Nothing is returned.
   */
  jobQueue.on('statusChange', (job: QueueJob) => {
    log.debug(LOG_QUEUE_JOB_STATUS_CHANGE, job.id, job.status);
    send(IPC.QUEUE_STATUS_CHANGE, job);
  });

  /**
   * Pushes IPC.QUEUE_PROGRESS with the job and its latest progress snapshot.
   * @param {{job: QueueJob, progress: ConversionProgress}} payload - The
   *   running job and its current ConversionProgress (percent, time, fps,
   *   speed, eta, bitrate).
   * @returns {void} Nothing is returned.
   */
  jobQueue.on('progress', ({ job, progress }: { job: QueueJob; progress: ConversionProgress }) => {
    send(IPC.QUEUE_PROGRESS, { job, progress });
  });

  /**
   * Pushes IPC.QUEUE_CANCELLED to notify the renderer that the queue was
   * cleared via cancel-all.
   * @returns {void} Nothing is returned.
   */
  jobQueue.on('cancelled', () => {
    log.info(LOG_QUEUE_CANCELLED);
    send(IPC.QUEUE_CANCELLED);
  });
}
