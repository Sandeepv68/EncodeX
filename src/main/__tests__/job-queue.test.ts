import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../transcoders/ffmpeg-core', () => {
  const { EventEmitter } = require('events');
  return {
    FfmpegCore: class {
      emitter = new EventEmitter();
      convert = vi.fn(() => this.emitter);
      cancel = vi.fn();
      getInfo = vi.fn();
      getType = vi.fn().mockReturnValue('FFMPEG');
    },
  };
});

vi.mock('../transcoders/fftool-core', () => {
  const { EventEmitter } = require('events');
  return {
    FFToolCore: class {
      emitter = new EventEmitter();
      convert = vi.fn(() => this.emitter);
      cancel = vi.fn();
      getInfo = vi.fn();
      getType = vi.fn().mockReturnValue('FFTOOL');
    },
  };
});

vi.mock('../transcoders/bmf-core', () => {
  const { EventEmitter } = require('events');
  return {
    BmfCore: class {
      emitter = new EventEmitter();
      convert = vi.fn(() => this.emitter);
      cancel = vi.fn();
      getInfo = vi.fn();
      getType = vi.fn().mockReturnValue('BMF');
    },
  };
});

const { JobQueue } = await import('../queue/job-queue');

describe('JobQueue', () => {
  let queue: JobQueue;

  beforeEach(() => {
    queue = new JobQueue();
  });

  it('starts empty', () => {
    expect(queue.getJobs()).toEqual([]);
  });

  it('adds a job and returns an id', () => {
    const id = queue.addJob('in.mp4', 'out.mp4', {}, 'FFMPEG');
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(queue.getJobs()).toHaveLength(1);
    expect(queue.getJobs()[0].input).toBe('in.mp4');
    expect(queue.getJobs()[0].output).toBe('out.mp4');
    expect(queue.getJobs()[0].status).toBe('running');
  });

  it('emits added event when a job is added', () => {
    return new Promise<void>((resolve) => {
      queue.on('added', (job) => {
        expect(job.input).toBe('in.mp4');
        resolve();
      });
      queue.addJob('in.mp4', 'out.mp4', {}, 'FFMPEG');
    });
  });

  it('removes a job by id', () => {
    const id = queue.addJob('in.mp4', 'out.mp4', {}, 'FFMPEG');
    expect(queue.getJobs()).toHaveLength(1);
    queue.removeJob(id);
    expect(queue.getJobs()).toHaveLength(0);
  });

  it('emits removed event when a job is removed', () => {
    return new Promise<void>((resolve) => {
      const id = queue.addJob('in.mp4', 'out.mp4', {}, 'FFMPEG');
      queue.on('removed', (removedId) => {
        expect(removedId).toBe(id);
        resolve();
      });
      queue.removeJob(id);
    });
  });

  it('cancels a job and removes it', () => {
    const id = queue.addJob('in.mp4', 'out.mp4', {}, 'FFMPEG');
    queue.cancelJob(id);
    expect(queue.getJobs()).toHaveLength(0);
  });

  it('cancels all jobs and emits cancelled', () => {
    return new Promise<void>((resolve) => {
      queue.on('cancelled', () => {
        expect(queue.getJobs()).toHaveLength(0);
        resolve();
      });
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.cancelAll();
    });
  });
});
