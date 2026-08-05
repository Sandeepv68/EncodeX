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

const log = new Logger('main/queue/job-queue');

export class JobQueue extends EventEmitter {
  private queue: QueueJob[] = [];
  private running = false;
  private currentJob: QueueJob | null = null;
  private currentTranscoder: ITranscoder | null = null;

  addJob(input: string, output: string, options: ConversionOptions, transcoder: TranscoderType): string {
    const id = randomUUID();
    log.info('addJob:', id, input, '->', output, 'transcoder:', transcoder);
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
    log.debug('Queue size:', this.queue.length);
    this.emit('added', job);
    this.processNext();
    return id;
  }

  removeJob(id: string): void {
    log.info('removeJob:', id);
    this.queue = this.queue.filter((j) => j.id !== id);
    log.debug('Queue size:', this.queue.length);
    this.emit('removed', id);
  }

  cancelJob(id: string): void {
    log.info('cancelJob:', id);
    if (this.currentJob?.id === id && this.currentTranscoder) {
      log.debug('Cancelling active job');
      this.currentTranscoder.cancel();
    }
    this.removeJob(id);
  }

  cancelAll(): void {
    log.info('cancelAll - clearing', this.queue.length, 'jobs');
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
      log.debug('processNext: already running');
      return;
    }
    const nextJob = this.queue.find((j) => j.status === QUEUE_STATUS.QUEUED);
    if (!nextJob) {
      log.debug('processNext: no queued jobs');
      return;
    }

    log.info('processNext: starting job', nextJob.id);
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
        log.error('Job failed:', nextJob.id, err.message);
        nextJob.status = QUEUE_STATUS.ERROR;
        nextJob.error = err.message;
        this.emit('statusChange', nextJob);
        this.running = false;
        this.currentJob = null;
        this.currentTranscoder = null;
        this.processNext();
      });
      emitter.on('end', () => {
        log.info('Job completed:', nextJob.id);
        nextJob.status = QUEUE_STATUS.DONE;
        nextJob.progress = 100;
        this.emit('statusChange', nextJob);
        this.running = false;
        this.currentJob = null;
        this.currentTranscoder = null;
        this.processNext();
      });
    } catch (err: unknown) {
      log.error('Job threw on start:', nextJob.id, err);
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
