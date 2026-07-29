import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { QueueJob, ConversionOptions, TranscoderType } from '../../shared/types';
import { FfmpegCore } from '../transcoders/ffmpeg-core';
import { FFToolCore } from '../transcoders/fftool-core';
import { BmfCore } from '../transcoders/bmf-core';
import { ITranscoder } from '../transcoders/interface';
import { QUEUE_STATUS } from '../../shared/ui-constants';

export class JobQueue extends EventEmitter {
  private queue: QueueJob[] = [];
  private running = false;
  private currentJob: QueueJob | null = null;
  private currentTranscoder: ITranscoder | null = null;

  private createTranscoder(type: TranscoderType): ITranscoder {
    switch (type) {
      case 'FFMPEG':
        return new FfmpegCore();
      case 'FFTOOL':
        return new FFToolCore();
      case 'BMF':
        return new BmfCore();
    }
  }

  addJob(input: string, output: string, options: ConversionOptions, transcoder: TranscoderType): string {
    const id = randomUUID();
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
    this.emit('added', job);
    this.processNext();
    return id;
  }

  removeJob(id: string): void {
    this.queue = this.queue.filter((j) => j.id !== id);
    this.emit('removed', id);
  }

  cancelJob(id: string): void {
    if (this.currentJob?.id === id && this.currentTranscoder) {
      this.currentTranscoder.cancel();
    }
    this.removeJob(id);
  }

  cancelAll(): void {
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
    if (this.running) return;
    const nextJob = this.queue.find((j) => j.status === QUEUE_STATUS.QUEUED);
    if (!nextJob) return;

    this.running = true;
    this.currentJob = nextJob;
    nextJob.status = QUEUE_STATUS.RUNNING;
    this.emit('statusChange', nextJob);

    const transcoder = this.createTranscoder(nextJob.transcoder);
    this.currentTranscoder = transcoder;

    try {
      const emitter = transcoder.convert(nextJob.input, nextJob.output, nextJob.options);
      emitter.on('progress', (progress) => {
        nextJob.progress = progress.percent;
        this.emit('progress', { job: nextJob, progress });
      });
      emitter.on('error', (err) => {
        nextJob.status = QUEUE_STATUS.ERROR;
        nextJob.error = err.message;
        this.emit('statusChange', nextJob);
        this.running = false;
        this.currentJob = null;
        this.currentTranscoder = null;
        this.processNext();
      });
      emitter.on('end', () => {
        nextJob.status = QUEUE_STATUS.DONE;
        nextJob.progress = 100;
        this.emit('statusChange', nextJob);
        this.running = false;
        this.currentJob = null;
        this.currentTranscoder = null;
        this.processNext();
      });
    } catch (err: unknown) {
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
