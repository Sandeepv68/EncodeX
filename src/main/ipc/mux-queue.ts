/**
 * @fileoverview IPC handlers for the dedicated remux/demux mux queue.
 *
 * Registers the MUX_QUEUE_* channels and forwards the {@link MuxQueue}'s
 * lifecycle events to the renderer on the MUX_QUEUE_ADDED, MUX_QUEUE_REMOVED,
 * MUX_QUEUE_STATUS_CHANGE, MUX_QUEUE_PROGRESS, MUX_QUEUE_CANCELLED and
 * MUX_QUEUE_MOVED channels. One MuxQueue instance is created per registration
 * call and persists to its own `mux-queue-state.json` snapshot, which is
 * cleared on `will-quit` alongside the batch queue's snapshot.
 */

import { ipcMain, app } from 'electron';
import { MuxQueue } from '../queue/mux-queue';
import path from 'path';
import { getNotifier } from '../notifications/notifier';
import { tNotification } from '../notifications/strings';
import { QUEUE_STATUS } from '../../shared/media-options';
import { FileMuxQueuePersistence } from '../queue/persistence';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';
import { createError, ErrorCode } from '../../shared/errors';
import { isMuxQueueAddPayload } from '../../shared/mux-queue-guards';
import type { ConversionProgress, MuxQueueAddPayload, MuxQueueJob } from '../../shared/types';
import type { IpcSender } from './types';
import { registerQueueSnapshotClear } from './queue';
import {
  LOG_IPC_MUX_QUEUE_ADD,
  LOG_IPC_MUX_QUEUE_CANCEL_ALL_CALLED,
  LOG_IPC_MUX_QUEUE_CLEAR_COMPLETED_CALLED,
  LOG_IPC_MUX_QUEUE_GET_STATE,
  LOG_IPC_MUX_QUEUE_LIST,
  LOG_IPC_MUX_QUEUE_MOVE_TO,
  LOG_IPC_MUX_QUEUE_PAUSE_CALLED,
  LOG_IPC_MUX_QUEUE_REMOVE,
  LOG_IPC_MUX_QUEUE_RESUME_CALLED,
  LOG_IPC_MUX_QUEUE_SET_CONCURRENCY,
  LOG_IPC_MUX_QUEUE_START_CALLED,
  LOG_MUX_QUEUE_CANCELLED,
  LOG_MUX_QUEUE_JOB_ADDED,
  LOG_MUX_QUEUE_JOB_REMOVED,
  LOG_MUX_QUEUE_JOB_STATUS_CHANGE,
  LOG_MUX_QUEUE_MOVE_TO,
} from '../../shared/log-constants';

const log = new Logger('main/ipc/mux-queue');

/**
 * Registers the mux-queue IPC handlers for the given window.
 *
 * @param {BrowserWindow} win - Unused by the mux queue (no dialogs); kept for
 *   symmetry with the other handler modules.
 * @param {IpcSender} send - Main->renderer sender used to push mux queue
 *   lifecycle events.
 * @returns {void} Nothing is returned.
 */
export function registerMuxQueueHandlers(win: unknown, send: IpcSender): void {
  /** The mux queue persistence adapter; the will-quit clear targets its snapshot. */
  const persistence = new FileMuxQueuePersistence(app.getPath('userData'));
  registerQueueSnapshotClear(() => persistence.clear());

  /** The mux queue backing these handlers; one instance per registration call. */
  const muxQueue = new MuxQueue({ persistence });

  /**
   * Handles the IPC.MUX_QUEUE_ADD channel (mux-queue-add).
   *
   * Validates the payload with the shared guard before it reaches the queue:
   * a hostile renderer must not be able to construct a job with a malformed
   * target list. The job is queued and stays QUEUED until the user starts the
   * queue - adding never starts work by itself.
   *
   * @param {MuxQueueAddPayload} payload - The remux or demux job description.
   * @returns {Promise<string>} The id of the newly created job.
   * @throws {AppError} QUEUE_ERROR when the payload fails validation.
   */
  ipcMain.handle(IPC.MUX_QUEUE_ADD, async (_event, payload: MuxQueueAddPayload) => {
    log.info(LOG_IPC_MUX_QUEUE_ADD, payload?.kind, payload?.input);
    if (!isMuxQueueAddPayload(payload)) {
      throw createError(ErrorCode.QUEUE_ERROR, 'The mux queue request is not a valid remux or demux job.');
    }
    return muxQueue.addJob(payload);
  });

  /**
   * Handles the IPC.MUX_QUEUE_REMOVE channel (mux-queue-remove).
   * Cancels a running job and removes it from the queue.
   *
   * @param {string} id - Id of the job to cancel and remove.
   * @returns {Promise<void>} Resolves after the removal request was handled.
   */
  ipcMain.handle(IPC.MUX_QUEUE_REMOVE, async (_event, id: string) => {
    log.info(LOG_IPC_MUX_QUEUE_REMOVE, id);
    muxQueue.cancelJob(id);
  });

  /**
   * Handles the IPC.MUX_QUEUE_LIST channel (mux-queue-list).
   *
   * @returns {Promise<MuxQueueJob[]>} A copy of the mux queue's job list.
   */
  ipcMain.handle(IPC.MUX_QUEUE_LIST, async () => {
    const jobs = muxQueue.getJobs();
    log.debug(LOG_IPC_MUX_QUEUE_LIST, jobs.length, 'jobs');
    return jobs;
  });

  /**
   * Handles the IPC.MUX_QUEUE_GET_STATE channel (mux-queue-get-state).
   *
   * @returns {Promise<{paused: boolean, concurrency: number}>} The paused flag
   *   and the parallel-job cap.
   */
  ipcMain.handle(IPC.MUX_QUEUE_GET_STATE, async () => {
    log.debug(LOG_IPC_MUX_QUEUE_GET_STATE);
    return muxQueue.getState();
  });

  /**
   * Handles the IPC.MUX_QUEUE_START channel (mux-queue-start).
   *
   * @returns {Promise<void>} Resolves once processing is kicked off.
   */
  ipcMain.handle(IPC.MUX_QUEUE_START, async () => {
    log.info(LOG_IPC_MUX_QUEUE_START_CALLED);
    muxQueue.start();
  });

  /**
   * Handles the IPC.MUX_QUEUE_PAUSE channel (mux-queue-pause).
   *
   * @returns {Promise<void>} Resolves once the queue is paused.
   */
  ipcMain.handle(IPC.MUX_QUEUE_PAUSE, async () => {
    log.info(LOG_IPC_MUX_QUEUE_PAUSE_CALLED);
    muxQueue.pause();
  });

  /**
   * Handles the IPC.MUX_QUEUE_RESUME channel (mux-queue-resume).
   *
   * @returns {Promise<void>} Resolves once the queue is resumed.
   */
  ipcMain.handle(IPC.MUX_QUEUE_RESUME, async () => {
    log.info(LOG_IPC_MUX_QUEUE_RESUME_CALLED);
    muxQueue.resume();
  });

  /**
   * Handles the IPC.MUX_QUEUE_CANCEL_ALL channel (mux-queue-cancel-all).
   *
   * @returns {Promise<void>} Resolves after the queue is cleared.
   */
  ipcMain.handle(IPC.MUX_QUEUE_CANCEL_ALL, async () => {
    log.info(LOG_IPC_MUX_QUEUE_CANCEL_ALL_CALLED);
    muxQueue.cancelAll();
  });

  /**
   * Handles the IPC.MUX_QUEUE_CLEAR_COMPLETED channel (mux-queue-clear-completed).
   *
   * @returns {Promise<number>} The number of jobs removed.
   */
  ipcMain.handle(IPC.MUX_QUEUE_CLEAR_COMPLETED, async () => {
    log.info(LOG_IPC_MUX_QUEUE_CLEAR_COMPLETED_CALLED);
    return muxQueue.clearCompleted();
  });

  /**
   * Handles the IPC.MUX_QUEUE_SET_CONCURRENCY channel (mux-queue-set-concurrency).
   *
   * @param {number} concurrency - The concurrency cap.
   * @returns {Promise<void>} Resolves once the cap is applied.
   */
  ipcMain.handle(IPC.MUX_QUEUE_SET_CONCURRENCY, async (_event, concurrency: number) => {
    log.info(LOG_IPC_MUX_QUEUE_SET_CONCURRENCY, concurrency);
    muxQueue.setConcurrency(concurrency);
  });

  /**
   * Handles the IPC.MUX_QUEUE_MOVE_TO channel (mux-queue-move-to).
   *
   * @param {string} id - Id of the QUEUED job to move.
   * @param {number} toPosition - Target index within the QUEUED subsequence.
   * @returns {Promise<boolean>} True when the job was moved.
   */
  ipcMain.handle(IPC.MUX_QUEUE_MOVE_TO, async (_event, id: string, toPosition: number) => {
    log.info(LOG_IPC_MUX_QUEUE_MOVE_TO, id, toPosition);
    return muxQueue.moveJobTo(id, toPosition);
  });

  /**
   * Pushes IPC.MUX_QUEUE_ADDED with the newly queued job.
   * @param {MuxQueueJob} job - The job that was added.
   * @returns {void}
   */
  muxQueue.on('added', (job: MuxQueueJob) => {
    log.info(LOG_MUX_QUEUE_JOB_ADDED, job.id);
    send(IPC.MUX_QUEUE_ADDED, job);
  });

  /**
   * Pushes IPC.MUX_QUEUE_REMOVED with the id of the removed job.
   * @param {string} id - Id of the job that was removed.
   * @returns {void}
   */
  muxQueue.on('removed', (id: string) => {
    log.info(LOG_MUX_QUEUE_JOB_REMOVED, id);
    send(IPC.MUX_QUEUE_REMOVED, id);
  });

  /**
   * Pushes IPC.MUX_QUEUE_STATUS_CHANGE with the job whose status changed.
   * @param {MuxQueueJob} job - The job after its status transition.
   * @returns {void}
   */
  muxQueue.on('statusChange', (job: MuxQueueJob) => {
    log.debug(LOG_MUX_QUEUE_JOB_STATUS_CHANGE, job.id, job.status);
    send(IPC.MUX_QUEUE_STATUS_CHANGE, job);
    const notifier = getNotifier();
    if (notifier && (job.status === QUEUE_STATUS.DONE || job.status === QUEUE_STATUS.ERROR)) {
      const fileName = path.basename(job.input || job.output);
      if (job.status === QUEUE_STATUS.DONE) {
        notifier.notify(
          tNotification('notifications.muxJobCompletedTitle'),
          tNotification('notifications.muxJobCompletedBody', { fileName }),
          `mux:job:${job.id}:done`,
          { target: 'mux' },
        );
      } else {
        notifier.notify(
          tNotification('notifications.muxJobFailedTitle'),
          tNotification('notifications.muxJobFailedBody', { fileName }),
          `mux:job:${job.id}:error`,
          { target: 'mux' },
        );
      }
    }
  });

  /**
   * Pushes IPC.MUX_QUEUE_PROGRESS with the job and its latest progress.
   * @param {{job: MuxQueueJob, progress: ConversionProgress}} payload - The
   *   running job and its aggregated progress.
   * @returns {void}
   */
  muxQueue.on('progress', ({ job, progress }: { job: MuxQueueJob; progress: ConversionProgress }) => {
    send(IPC.MUX_QUEUE_PROGRESS, { job, progress });
  });

  /**
   * Pushes IPC.MUX_QUEUE_CANCELLED to notify the renderer that the mux queue
   * was cleared via cancel-all.
   * @returns {void}
   */
  muxQueue.on('cancelled', () => {
    log.info(LOG_MUX_QUEUE_CANCELLED);
    send(IPC.MUX_QUEUE_CANCELLED);
  });

  /**
   * Pushes IPC.MUX_QUEUE_MOVED with the moved job id and its new position.
   * @param {{id: string, toPosition: number}} payload - The reordered job id
   *   and its new index within the QUEUED subsequence.
   * @returns {void}
   */
  muxQueue.on('moved', ({ id, toPosition }: { id: string; toPosition: number }) => {
    log.info(LOG_MUX_QUEUE_MOVE_TO, id, toPosition);
    send(IPC.MUX_QUEUE_MOVED, { id, toPosition });
  });

  muxQueue.on('drained', () => {
    const notifier = getNotifier();
    if (notifier) {
      const jobs = muxQueue.getJobs();
      const succeeded = jobs.filter((j) => j.status === QUEUE_STATUS.DONE).length;
      const failed = jobs.filter((j) => j.status === QUEUE_STATUS.ERROR).length;
      if (succeeded + failed > 0) {
        notifier.notify(
          tNotification('notifications.muxQueueCompletedTitle'),
          tNotification('notifications.muxQueueCompletedBody', { succeeded, failed }),
          'mux:drained',
          { target: 'mux' },
        );
      }
    }
  });
}
