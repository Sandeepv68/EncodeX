/**
 * @fileoverview Job queue for managing concurrent media conversion tasks.
 * Handles queuing, dequeuing, and job state management.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { Logger } from '../../shared/logger';
import { QueueJob, ConversionOptions, TranscoderType } from '../../shared/types';
import { createTranscoder } from '../transcoders/factory';
import { ITranscoder } from '../transcoders/interface';
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

export class JobQueue extends EventEmitter {
  private queue: QueueJob[] = [];
  private running = false;
  private currentJob: QueueJob | null = null;
  private currentTranscoder: ITranscoder | null = null;

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

  removeJob(id: string): void {
    log.info(LOG_REMOVE_JOB, id);
    this.queue = this.queue.filter((j) => j.id !== id);
    log.debug(LOG_QUEUE_SIZE, this.queue.length);
    this.emit('removed', id);
  }

  cancelJob(id: string): void {
    log.info(LOG_CANCEL_JOB, id);
    if (this.currentJob?.id === id && this.currentTranscoder) {
      log.debug(LOG_CANCELLING_ACTIVE_JOB);
      this.currentTranscoder.cancel();
    }
    this.removeJob(id);
  }

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

  getJobs(): QueueJob[] {
    return [...this.queue];
  }

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
