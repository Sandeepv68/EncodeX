import { ipcMain, BrowserWindow } from 'electron';
import { JobQueue } from '../queue/job-queue';
import { Logger } from '../../shared/logger';
import { ConversionOptions, QueueJob, TranscoderType, ConversionProgress } from '../../shared/types';
import { IPC } from '../../shared/ipc-channels';
import { IpcSender } from './send';

const log = new Logger('main/ipc/queue');

export function registerQueueHandlers(_win: BrowserWindow, send: IpcSender): void {
  const jobQueue = new JobQueue();

  ipcMain.handle(IPC.QUEUE_ADD, async (_event, input: string, output: string, options: ConversionOptions, transcoder: TranscoderType) => {
    log.info('QUEUE_ADD:', input, '->', output, 'transcoder:', transcoder);
    return jobQueue.addJob(input, output, options, transcoder);
  });

  ipcMain.handle(IPC.QUEUE_REMOVE, async (_event, id: string) => {
    log.info('QUEUE_REMOVE:', id);
    jobQueue.cancelJob(id);
  });

  ipcMain.handle(IPC.QUEUE_LIST, async () => {
    const jobs = jobQueue.getJobs();
    log.debug('QUEUE_LIST:', jobs.length, 'jobs');
    return jobs;
  });

  ipcMain.handle(IPC.QUEUE_CANCEL_ALL, async () => {
    log.info('QUEUE_CANCEL_ALL called');
    jobQueue.cancelAll();
  });

  jobQueue.on('added', (job: QueueJob) => {
    log.info('Queue job added:', job.id, job.input);
    send(IPC.QUEUE_ADDED, job);
  });
  jobQueue.on('removed', (id: string) => {
    log.info('Queue job removed:', id);
    send(IPC.QUEUE_REMOVED, id);
  });
  jobQueue.on('statusChange', (job: QueueJob) => {
    log.debug('Queue job status change:', job.id, job.status);
    send(IPC.QUEUE_STATUS_CHANGE, job);
  });
  jobQueue.on('progress', ({ job, progress }: { job: QueueJob; progress: ConversionProgress }) => {
    send(IPC.QUEUE_PROGRESS, { job, progress });
  });
  jobQueue.on('cancelled', () => {
    log.info('Queue cancelled');
    send(IPC.QUEUE_CANCELLED);
  });
}
