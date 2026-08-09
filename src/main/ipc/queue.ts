/**
 * @fileoverview IPC handlers for the batch conversion job queue.
 * Registers handlers for the QUEUE_ADD, QUEUE_REMOVE, QUEUE_LIST,
 * QUEUE_GET_STATE, QUEUE_CANCEL_ALL, QUEUE_CLEAR_COMPLETED, QUEUE_SET_CONCURRENCY,
 * QUEUE_MOVE_TO, QUEUE_PAUSE and QUEUE_RESUME channels and forwards the
 * JobQueue's lifecycle events to the renderer on the QUEUE_ADDED,
 * QUEUE_REMOVED, QUEUE_STATUS_CHANGE, QUEUE_PROGRESS, QUEUE_CANCELLED and
 * QUEUE_MOVED channels. One JobQueue
 * instance (src/main/queue/job-queue.ts) is created per registration call and
 * executes conversions in the main process, running up to the configured
 * concurrency of jobs at a time and processing the next queued job on
 * completion.
 */

import { ipcMain, BrowserWindow, app, dialog } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { JobQueue } from '../queue/job-queue';
import { FileQueuePersistence } from '../queue/persistence';
import { buildQueueExport, parseQueueExport } from '../queue/queue-transfer';
import { Logger } from '../../shared/logger';
import { ConversionOptions, QueueJob, TranscoderType, ConversionProgress } from '../../shared/types';
import { IPC } from '../../shared/ipc-channels';
import { invalidQueueFileError, outputExistsError } from '../../shared/errors';
import type { IpcSender } from './types';
import {
  LOG_ARROW,
  LOG_IPC_QUEUE_ADD,
  LOG_IPC_QUEUE_CANCEL_ALL_CALLED,
  LOG_IPC_QUEUE_CLEAR_COMPLETED_CALLED,
  LOG_IPC_QUEUE_EXPORT_CALLED,
  LOG_IPC_QUEUE_GET_STATE,
  LOG_IPC_QUEUE_IMPORT_CALLED,
  LOG_IPC_QUEUE_LIST,
  LOG_IPC_QUEUE_MOVE_TO,
  LOG_IPC_QUEUE_PAUSE_CALLED,
  LOG_IPC_QUEUE_REMOVE,
  LOG_IPC_QUEUE_RESUME_CALLED,
  LOG_IPC_QUEUE_SET_CONCURRENCY,
  LOG_QUEUE_CANCELLED,
  LOG_QUEUE_EXPORTED,
  LOG_QUEUE_IMPORTED,
  LOG_QUEUE_JOB_ADDED,
  LOG_QUEUE_JOB_REMOVED,
  LOG_QUEUE_JOB_STATUS_CHANGE,
  LOG_TRANSCODER,
} from '../../shared/log-constants';

const log = new Logger('main/ipc/queue');

/**
 * Normalizes a file path for duplicate comparison: lowercases and unifies
 * Windows backslashes with POSIX forward slashes. Mirrors the renderer's
 * add-time dedupe so an imported queue skips the same jobs the batch page
 * would.
 * @param {string} path - The file path to normalize.
 * @returns {string} The normalized path.
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

/**
 * Registers the job-queue IPC handlers for the given window.
 *
 * @param {BrowserWindow} win - The BrowserWindow associated with the
 *   renderer. Used as the modal parent of the export/import file dialogs.
 * @param {IpcSender} send - Main→renderer sender used to push queue lifecycle
 *   events (added, removed, status change, progress, cancelled).
 * @returns {void} Nothing is returned.
 */
export function registerQueueHandlers(win: BrowserWindow, send: IpcSender): void {
  /** The job queue backing these handlers; one instance per registration call. */
  const jobQueue = new JobQueue({ persistence: new FileQueuePersistence(app.getPath('userData')) });

  /**
   * Handles the IPC.QUEUE_ADD channel (queue-add).
   * Enqueues a new conversion job. When `overwrite` is not true and the output
   * path already exists on disk, the request is rejected with an
   * OUTPUT_EXISTS AppError so the renderer can surface it. Otherwise the job
   * is queued, processing is kicked off (if idle), and a QUEUE_ADDED event
   * with the full job is pushed.
   *
   * @param {string} input - Absolute path of the source media file.
   * @param {string} output - Absolute path of the destination file.
   * @param {ConversionOptions} options - Codec, bitrate, scaling and trim
   *   options for the job.
   * @param {TranscoderType} transcoder - Transcoder backend to use
   *   ('FFMPEG' | 'FFTOOL' | 'BMF').
   * @param {boolean} [overwrite] - When true, an existing output file is
   *   allowed to be replaced; when false (or omitted) an existing output
   *   rejects the request.
   * @returns {Promise<string>} The id of the newly created job.
   * @throws {AppError} OUTPUT_EXISTS when the output exists and overwrite is
   *   not enabled.
   */
  ipcMain.handle(
    IPC.QUEUE_ADD,
    async (_event, input: string, output: string, options: ConversionOptions, transcoder: TranscoderType, overwrite?: boolean) => {
      log.info(LOG_IPC_QUEUE_ADD, input, LOG_ARROW, output, LOG_TRANSCODER, transcoder, 'overwrite:', overwrite === true);
      if (overwrite !== true && existsSync(output)) {
        throw outputExistsError(output);
      }
      return jobQueue.addJob(input, output, options, transcoder);
    },
  );

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
   * Handles the IPC.QUEUE_GET_STATE channel (queue-get-state).
   * Returns a snapshot of the queue's runtime state: whether it is paused
   * (active conversions suspended, queued jobs blocked) and the concurrency cap.
   *
   * @returns {Promise<{paused: boolean, concurrency: number}>} The paused flag
   *   and the parallel-job cap.
   */
  ipcMain.handle(IPC.QUEUE_GET_STATE, async () => {
    log.debug(LOG_IPC_QUEUE_GET_STATE);
    return { paused: jobQueue.isPaused(), concurrency: jobQueue.getConcurrency() };
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
   * Handles the IPC.QUEUE_CLEAR_COMPLETED channel (queue-clear-completed).
   * Drops every DONE and ERROR job from the queue, keeping queued and running
   * jobs intact.
   *
   * @returns {Promise<number>} The number of jobs removed.
   */
  ipcMain.handle(IPC.QUEUE_CLEAR_COMPLETED, async () => {
    log.info(LOG_IPC_QUEUE_CLEAR_COMPLETED_CALLED);
    return jobQueue.clearCompleted();
  });

  /**
   * Handles the IPC.QUEUE_SET_CONCURRENCY channel (queue-set-concurrency).
   * Updates how many queued jobs run in parallel (1-4) and starts any jobs
   * that the new cap allows.
   *
   * @param {number} concurrency - The concurrency cap (1-4).
   * @returns {Promise<void>} Resolves once the cap is applied.
   */
  ipcMain.handle(IPC.QUEUE_SET_CONCURRENCY, async (_event, concurrency: number) => {
    log.info(LOG_IPC_QUEUE_SET_CONCURRENCY, concurrency);
    jobQueue.setConcurrency(concurrency);
  });

  /**
   * Handles the IPC.QUEUE_MOVE_TO channel (queue-move-to).
   * Reorders a QUEUED job to a target position within the QUEUED subsequence
   * (clamped). Non-queued jobs are left in place.
   *
   * @param {string} id - Id of the QUEUED job to move.
   * @param {number} toPosition - Target index within the QUEUED subsequence.
   * @returns {Promise<boolean>} True when the job was moved, false when the
   *   job is missing, not queued, or already at the target position.
   */
  ipcMain.handle(IPC.QUEUE_MOVE_TO, async (_event, id: string, toPosition: number) => {
    log.info(LOG_IPC_QUEUE_MOVE_TO, id, toPosition);
    return jobQueue.moveJobTo(id, toPosition);
  });

  /**
   * Handles the IPC.QUEUE_PAUSE channel (queue-pause).
   * Suspends every active conversion and blocks queued jobs from starting
   * until QUEUE_RESUME is handled.
   *
   * @returns {Promise<void>} Resolves once the queue is paused.
   */
  ipcMain.handle(IPC.QUEUE_PAUSE, async () => {
    log.info(LOG_IPC_QUEUE_PAUSE_CALLED);
    jobQueue.pause();
  });

  /**
   * Handles the IPC.QUEUE_RESUME channel (queue-resume).
   * Resumes every suspended conversion and drains the queue, starting queued
   * jobs the concurrency cap now allows.
   *
   * @returns {Promise<void>} Resolves once the queue is resumed.
   */
  ipcMain.handle(IPC.QUEUE_RESUME, async () => {
    log.info(LOG_IPC_QUEUE_RESUME_CALLED);
    jobQueue.resume();
  });

  /**
   * Handles the IPC.QUEUE_EXPORT channel (queue-export).
   * Shows a save dialog for a JSON file and writes the current queue as a
   * portable snapshot ({@link buildQueueExport}). When the dialog is
   * cancelled, no file is written and 0 is returned.
   *
   * @returns {Promise<number>} The number of jobs exported, or 0 when the
   *   dialog was cancelled.
   */
  ipcMain.handle(IPC.QUEUE_EXPORT, async () => {
    log.info(LOG_IPC_QUEUE_EXPORT_CALLED);
    const result = await dialog.showSaveDialog(win, {
      title: 'Export Queue',
      defaultPath: 'queue.json',
      filters: [{ name: 'EncodeX Queue', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return 0;
    const snapshot = buildQueueExport(jobQueue.getJobs(), jobQueue.getConcurrency());
    writeFileSync(result.filePath, JSON.stringify(snapshot, null, 2), 'utf8');
    log.info(LOG_QUEUE_EXPORTED, snapshot.jobs.length, 'jobs');
    return snapshot.jobs.length;
  });

  /**
   * Handles the IPC.QUEUE_IMPORT channel (queue-import).
   * Shows an open dialog for a JSON queue file, parses and validates it, then
   * applies the recorded concurrency cap and enqueues every job via
   * `jobQueue.addJob`. Jobs whose `input|output` pair is already queued, or
   * whose output path is already claimed by an existing job, are skipped so
   * importing a queue never duplicates work (mirrors the batch page's
   * add-time dedupe). An unreadable or structurally invalid file rejects with
   * an INVALID_QUEUE_FILE AppError.
   *
   * @returns {Promise<number>} The number of jobs actually imported (excluding
   *   skipped duplicates), or 0 when the dialog was cancelled.
   * @throws {AppError} INVALID_QUEUE_FILE when the selected file cannot be
   *   read or does not match the expected export format.
   */
  ipcMain.handle(IPC.QUEUE_IMPORT, async () => {
    log.info(LOG_IPC_QUEUE_IMPORT_CALLED);
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'EncodeX Queue', extensions: ['json'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return 0;
    let raw: string;
    try {
      raw = readFileSync(result.filePaths[0], 'utf8');
    } catch (err) {
      throw invalidQueueFileError(err instanceof Error ? err.message : String(err));
    }
    const snapshot = parseQueueExport(raw);
    if (!snapshot) throw invalidQueueFileError();
    jobQueue.setConcurrency(snapshot.concurrency);
    const existingKeys = new Set(jobQueue.getJobs().map((job: QueueJob) => `${normalizePath(job.input)}|${normalizePath(job.output)}`));
    const existingOutputs = new Set(jobQueue.getJobs().map((job: QueueJob) => normalizePath(job.output)));
    let imported = 0;
    for (const job of snapshot.jobs) {
      const key = `${normalizePath(job.input)}|${normalizePath(job.output)}`;
      if (existingKeys.has(key) || existingOutputs.has(normalizePath(job.output))) {
        continue;
      }
      existingKeys.add(key);
      existingOutputs.add(normalizePath(job.output));
      jobQueue.addJob(job.input, job.output, job.options, job.transcoder);
      imported += 1;
    }
    log.info(LOG_QUEUE_IMPORTED, imported, 'jobs');
    return imported;
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

  /**
   * Pushes IPC.QUEUE_MOVED with the moved job id and its new position within
   * the QUEUED subsequence so the renderer can mirror the reorder.
   * @param {{id: string, toPosition: number}} payload - The reordered job id
   *   and its new index within the QUEUED subsequence.
   * @returns {void} Nothing is returned.
   */
  jobQueue.on('moved', ({ id, toPosition }: { id: string; toPosition: number }) => {
    send(IPC.QUEUE_MOVED, { id, toPosition });
  });
}
