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

export function registerQueueHandlers(_win: BrowserWindow, send: IpcSender): void {
  const jobQueue = new JobQueue();

  ipcMain.handle(IPC.QUEUE_ADD, async (_event, input: string, output: string, options: ConversionOptions, transcoder: TranscoderType) => {
    log.info(LOG_IPC_QUEUE_ADD, input, LOG_ARROW, output, LOG_TRANSCODER, transcoder);
    return jobQueue.addJob(input, output, options, transcoder);
  });

  ipcMain.handle(IPC.QUEUE_REMOVE, async (_event, id: string) => {
    log.info(LOG_IPC_QUEUE_REMOVE, id);
    jobQueue.cancelJob(id);
  });

  ipcMain.handle(IPC.QUEUE_LIST, async () => {
    const jobs = jobQueue.getJobs();
    log.debug(LOG_IPC_QUEUE_LIST, jobs.length, 'jobs');
    return jobs;
  });

  ipcMain.handle(IPC.QUEUE_CANCEL_ALL, async () => {
    log.info(LOG_IPC_QUEUE_CANCEL_ALL_CALLED);
    jobQueue.cancelAll();
  });

  jobQueue.on('added', (job: QueueJob) => {
    log.info(LOG_QUEUE_JOB_ADDED, job.id, job.input);
    send(IPC.QUEUE_ADDED, job);
  });
  jobQueue.on('removed', (id: string) => {
    log.info(LOG_QUEUE_JOB_REMOVED, id);
    send(IPC.QUEUE_REMOVED, id);
  });
  jobQueue.on('statusChange', (job: QueueJob) => {
    log.debug(LOG_QUEUE_JOB_STATUS_CHANGE, job.id, job.status);
    send(IPC.QUEUE_STATUS_CHANGE, job);
  });
  jobQueue.on('progress', ({ job, progress }: { job: QueueJob; progress: ConversionProgress }) => {
    send(IPC.QUEUE_PROGRESS, { job, progress });
  });
  jobQueue.on('cancelled', () => {
    log.info(LOG_QUEUE_CANCELLED);
    send(IPC.QUEUE_CANCELLED);
  });
}
