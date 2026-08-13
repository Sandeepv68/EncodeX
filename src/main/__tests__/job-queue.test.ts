import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { FileQueuePersistence, QUEUE_STATE_FILENAME, QUEUE_STATE_VERSION } from '../queue/persistence';
import { cancelledError } from '../../shared/errors';
import { QueueJob } from '../../shared/types';

vi.mock('../transcoders/ffmpeg-core', () => {
  const { EventEmitter } = require('events');
  return {
    FfmpegCore: class {
      emitter = new EventEmitter();
      convert = vi.fn(() => this.emitter);
      cancel = vi.fn();
      pause = vi.fn();
      resume = vi.fn();
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
      pause = vi.fn();
      resume = vi.fn();
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
      pause = vi.fn();
      resume = vi.fn();
      getInfo = vi.fn();
      getType = vi.fn().mockReturnValue('BMF');
    },
  };
});

const { JobQueue } = await import('../queue/job-queue');
import * as factory from '../transcoders/factory';
import type { ITranscoder } from '../transcoders/types';

describe('JobQueue', () => {
  let queue: InstanceType<typeof JobQueue>;

  beforeEach(() => {
    queue = new JobQueue();
  });

  it('starts empty', () => {
    expect(queue.getJobs()).toEqual([]);
  });

  it('adds a job as queued without starting it and returns an id', () => {
    const id = queue.addJob('in.mp4', 'out.mp4', {}, 'FFMPEG');
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(queue.getJobs()).toHaveLength(1);
    expect(queue.getJobs()[0].input).toBe('in.mp4');
    expect(queue.getJobs()[0].output).toBe('out.mp4');
    expect(queue.getJobs()[0].status).toBe('queued');
  });

  it('start begins processing the queued jobs', () => {
    queue.addJob('in.mp4', 'out.mp4', {}, 'FFMPEG');
    expect(queue.getJobs()[0].status).toBe('queued');
    queue.start();
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

  it('clears completed and errored jobs but keeps queued and running jobs', () => {
    (queue as unknown as { queue: { id: string; status: string }[] }).queue = [
      { id: 'done', status: 'done' },
      { id: 'error', status: 'error' },
      { id: 'queued', status: 'queued' },
      { id: 'running', status: 'running' },
    ];
    const removed = queue.clearCompleted();
    expect(removed).toBe(2);
    expect(queue.getJobs().map((j) => j.id)).toEqual(['queued', 'running']);
  });

  it('emits a removed event for each cleared job', () => {
    return new Promise<void>((resolve) => {
      (queue as unknown as { queue: { id: string; status: string }[] }).queue = [
        { id: 'done', status: 'done' },
        { id: 'queued', status: 'queued' },
      ];
      const removedIds: string[] = [];
      queue.on('removed', (id) => {
        removedIds.push(id);
        if (removedIds.length === 1) {
          expect(removedIds).toEqual(['done']);
          resolve();
        }
      });
      queue.clearCompleted();
    });
  });

  describe('concurrency', () => {
    let transcoders: ITranscoder[];

    beforeEach(() => {
      transcoders = [];
      const original = factory.createTranscoder;
      vi.spyOn(factory, 'createTranscoder').mockImplementation((type) => {
        const transcoder = original(type);
        transcoders.push(transcoder);
        return transcoder;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('runs at most the configured number of jobs in parallel', () => {
      queue = new JobQueue(2);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.addJob('c.mp4', 'c_out.mp4', {}, 'FFMPEG');
      queue.start();
      expect(queue.getJobs().map((j) => j.status)).toEqual(['running', 'running', 'queued']);
      expect(transcoders).toHaveLength(2);
    });

    it('drains the queue as running jobs complete', () => {
      queue = new JobQueue(2);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.addJob('c.mp4', 'c_out.mp4', {}, 'FFMPEG');
      queue.start();
      (transcoders[0] as unknown as { emitter: NodeJS.EventEmitter }).emitter.emit('end');
      expect(queue.getJobs().map((j) => j.status)).toEqual(['done', 'running', 'running']);
      expect(transcoders).toHaveLength(3);
      (transcoders[1] as unknown as { emitter: NodeJS.EventEmitter }).emitter.emit('end');
      (transcoders[2] as unknown as { emitter: NodeJS.EventEmitter }).emitter.emit('end');
      expect(queue.getJobs().map((j) => j.status)).toEqual(['done', 'done', 'done']);
    });

    it('continues draining after a job errors', () => {
      queue = new JobQueue(1);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.start();
      expect(queue.getJobs().map((j) => j.status)).toEqual(['running', 'queued']);
      (transcoders[0] as unknown as { emitter: NodeJS.EventEmitter }).emitter.emit('error', new Error('boom'));
      expect(queue.getJobs().map((j) => j.status)).toEqual(['error', 'running']);
      expect((queue.getJobs()[0] as { error?: string }).error).toBe('boom');
    });

    it('starts queued jobs when the concurrency cap is raised', () => {
      queue = new JobQueue(1);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.start();
      expect(queue.getJobs().map((j) => j.status)).toEqual(['running', 'queued']);
      queue.setConcurrency(2);
      expect(queue.getJobs().map((j) => j.status)).toEqual(['running', 'running']);
      expect(transcoders).toHaveLength(2);
    });

    it('does not start queued jobs when the cap is lowered', () => {
      queue = new JobQueue(2);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.addJob('c.mp4', 'c_out.mp4', {}, 'FFMPEG');
      queue.start();
      expect(queue.getJobs().map((j) => j.status)).toEqual(['running', 'running', 'queued']);
      queue.setConcurrency(1);
      expect(queue.getJobs().map((j) => j.status)).toEqual(['running', 'running', 'queued']);
    });

    it('clamps the concurrency cap to at least one', () => {
      queue = new JobQueue(2);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.start();
      queue.setConcurrency(0);
      queue.addJob('c.mp4', 'c_out.mp4', {}, 'FFMPEG');
      expect(queue.getJobs().map((j) => j.status)).toEqual(['running', 'running', 'queued']);
    });
  });

  describe('priority', () => {
    let transcoders: ITranscoder[];

    beforeEach(() => {
      transcoders = [];
      const original = factory.createTranscoder;
      vi.spyOn(factory, 'createTranscoder').mockImplementation((type) => {
        const transcoder = original(type);
        transcoders.push(transcoder);
        return transcoder;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('starts higher-priority queued jobs before lower-priority ones', () => {
      queue = new JobQueue(1);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG', 5);
      queue.addJob('c.mp4', 'c_out.mp4', {}, 'FFMPEG', 1);
      queue.start();
      expect(queue.getJobs().map((j) => j.status)).toEqual(['queued', 'running', 'queued']);
      expect(queue.getJobs()[1].input).toBe('b.mp4');
      (transcoders[0] as unknown as { emitter: NodeJS.EventEmitter }).emitter.emit('end');
      expect(queue.getJobs().map((j) => j.status)).toEqual(['queued', 'done', 'running']);
      expect(queue.getJobs()[2].input).toBe('c.mp4');
      (transcoders[1] as unknown as { emitter: NodeJS.EventEmitter }).emitter.emit('end');
      expect(queue.getJobs().map((j) => j.status)).toEqual(['running', 'done', 'done']);
    });

    it('keeps FIFO order among equal-priority queued jobs', () => {
      queue = new JobQueue(1);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.addJob('c.mp4', 'c_out.mp4', {}, 'FFMPEG');
      queue.start();
      (transcoders[0] as unknown as { emitter: NodeJS.EventEmitter }).emitter.emit('end');
      expect(queue.getJobs().map((j) => j.status)).toEqual(['done', 'running', 'queued']);
      expect(queue.getJobs()[1].input).toBe('b.mp4');
    });
  });

  describe('pause', () => {
    let transcoders: ITranscoder[];

    beforeEach(() => {
      transcoders = [];
      const original = factory.createTranscoder;
      vi.spyOn(factory, 'createTranscoder').mockImplementation((type) => {
        const transcoder = original(type);
        transcoders.push(transcoder);
        return transcoder;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('starts false and reflects the paused state', () => {
      expect(queue.isPaused()).toBe(false);
      queue.pause();
      expect(queue.isPaused()).toBe(true);
      queue.resume();
      expect(queue.isPaused()).toBe(false);
    });

    it('pauses every active transcoder and marks running jobs paused', () => {
      queue = new JobQueue(1);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.start();
      queue.pause();
      expect(transcoders[0].pause).toHaveBeenCalledOnce();
      expect(transcoders[0].resume).not.toHaveBeenCalled();
      expect(queue.getJobs().map((j) => (j as { paused?: boolean }).paused)).toEqual([true, undefined]);
    });

    it('does not start queued jobs while paused', () => {
      queue = new JobQueue(1);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.start();
      queue.pause();
      (transcoders[0] as unknown as { emitter: NodeJS.EventEmitter }).emitter.emit('end');
      expect(queue.getJobs().map((j) => j.status)).toEqual(['done', 'queued']);
      expect(transcoders).toHaveLength(1);
    });

    it('resumes active transcoders and drains the queue', () => {
      queue = new JobQueue(1);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.start();
      queue.pause();
      (transcoders[0] as unknown as { emitter: NodeJS.EventEmitter }).emitter.emit('end');
      expect(queue.getJobs().map((j) => j.status)).toEqual(['done', 'queued']);
      queue.resume();
      expect(queue.getJobs().map((j) => j.status)).toEqual(['done', 'running']);
      expect(transcoders).toHaveLength(2);
    });

    it('resume clears the paused flag on running jobs', () => {
      queue = new JobQueue(1);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.start();
      queue.pause();
      expect((queue.getJobs()[0] as { paused?: boolean }).paused).toBe(true);
      queue.resume();
      expect((queue.getJobs()[0] as { paused?: boolean }).paused).toBe(false);
    });

    it('is idempotent for repeated pause and resume calls', () => {
      queue = new JobQueue(1);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.start();
      queue.pause();
      queue.pause();
      expect(transcoders[0].pause).toHaveBeenCalledOnce();
      queue.resume();
      queue.resume();
      expect(transcoders[0].resume).toHaveBeenCalledOnce();
    });

    it('cancelAll resets the paused state', () => {
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.pause();
      expect(queue.isPaused()).toBe(true);
      queue.cancelAll();
      expect(queue.isPaused()).toBe(false);
    });
  });

  describe('moveJobTo', () => {
    function seedJobs(jobs: { id: string; status: string }[]): void {
      (queue as unknown as { queue: { id: string; status: string }[] }).queue = jobs;
    }

    it('moves a queued job earlier among queued jobs only', () => {
      seedJobs([
        { id: 'running', status: 'running' },
        { id: 'q1', status: 'queued' },
        { id: 'done', status: 'done' },
        { id: 'q2', status: 'queued' },
        { id: 'q3', status: 'queued' },
      ]);
      expect(queue.moveJobTo('q3', 0)).toBe(true);
      expect(queue.getJobs().map((j) => j.id)).toEqual(['running', 'q3', 'done', 'q1', 'q2']);
    });

    it('moves a queued job later among queued jobs only', () => {
      seedJobs([
        { id: 'running', status: 'running' },
        { id: 'q1', status: 'queued' },
        { id: 'done', status: 'done' },
        { id: 'q2', status: 'queued' },
      ]);
      expect(queue.moveJobTo('q1', 1)).toBe(true);
      expect(queue.getJobs().map((j) => j.id)).toEqual(['running', 'q2', 'done', 'q1']);
    });

    it('moves a queued job to the middle of the queued subsequence', () => {
      seedJobs([
        { id: 'q1', status: 'queued' },
        { id: 'q2', status: 'queued' },
        { id: 'q3', status: 'queued' },
        { id: 'q4', status: 'queued' },
      ]);
      expect(queue.moveJobTo('q1', 2)).toBe(true);
      expect(queue.getJobs().map((j) => j.id)).toEqual(['q2', 'q3', 'q1', 'q4']);
    });

    it('clamps target positions to the queued range', () => {
      seedJobs([
        { id: 'q1', status: 'queued' },
        { id: 'q2', status: 'queued' },
      ]);
      expect(queue.moveJobTo('q1', 99)).toBe(true);
      expect(queue.getJobs().map((j) => j.id)).toEqual(['q2', 'q1']);
      seedJobs([
        { id: 'q1', status: 'queued' },
        { id: 'q2', status: 'queued' },
      ]);
      expect(queue.moveJobTo('q2', -5)).toBe(true);
      expect(queue.getJobs().map((j) => j.id)).toEqual(['q2', 'q1']);
    });

    it('returns false for missing, non-queued, and no-op jobs', () => {
      seedJobs([
        { id: 'q1', status: 'queued' },
        { id: 'running', status: 'running' },
        { id: 'q2', status: 'queued' },
      ]);
      expect(queue.moveJobTo('missing', 0)).toBe(false);
      expect(queue.moveJobTo('running', 0)).toBe(false);
      expect(queue.moveJobTo('q1', 0)).toBe(false);
      expect(queue.getJobs().map((j) => j.id)).toEqual(['q1', 'running', 'q2']);
    });

    it('emits a moved event with the target position', () => {
      return new Promise<void>((resolve) => {
        seedJobs([
          { id: 'q1', status: 'queued' },
          { id: 'q2', status: 'queued' },
          { id: 'q3', status: 'queued' },
        ]);
        queue.on('moved', (payload: { id: string; toPosition: number }) => {
          expect(payload).toEqual({ id: 'q3', toPosition: 0 });
          resolve();
        });
        queue.moveJobTo('q3', 0);
      });
    });
  });

  describe('persistence', () => {
    let tempDir: string;
    let persistence: FileQueuePersistence;
    let snapshotPath: string;

    beforeEach(() => {
      tempDir = path.join(os.tmpdir(), 'encodex-queue-test-' + randomUUID());
      fs.mkdirSync(tempDir, { recursive: true });
      persistence = new FileQueuePersistence(tempDir);
      snapshotPath = path.join(tempDir, QUEUE_STATE_FILENAME);
    });

    afterEach(() => {
      vi.restoreAllMocks();
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup.
      }
    });

    function writeSnapshot(jobs: QueueJob[]): void {
      persistence.save({ version: QUEUE_STATE_VERSION, concurrency: 1, jobs });
    }

    it('starts empty when no snapshot exists', () => {
      queue = new JobQueue({ persistence });
      expect(queue.getJobs()).toEqual([]);
    });

    it('starts empty when the snapshot file is corrupt', () => {
      fs.writeFileSync(snapshotPath, '{not json', 'utf8');
      queue = new JobQueue({ persistence });
      expect(queue.getJobs()).toEqual([]);
    });

    it('remaps RUNNING jobs to QUEUED and resets their progress on restore', () => {
      writeSnapshot([
        { id: 'a', input: 'a.mp4', output: 'a_out.mp4', options: {}, transcoder: 'FFMPEG', status: 'running', progress: 45, createdAt: 1 },
        { id: 'b', input: 'b.mp4', output: 'b_out.mp4', options: {}, transcoder: 'FFMPEG', status: 'done', progress: 100, createdAt: 2 },
        { id: 'c', input: 'c.mp4', output: 'c_out.mp4', options: {}, transcoder: 'FFMPEG', status: 'queued', progress: 0, createdAt: 3 },
      ] as QueueJob[]);
      queue = new JobQueue({ persistence });
      expect(queue.getJobs().map((j) => j.status)).toEqual(['queued', 'done', 'queued']);
      expect(queue.getJobs()[0].progress).toBe(0);
      expect(queue.getJobs()[1].progress).toBe(100);
    });

    it('restored RUNNING jobs stay queued until start is called', () => {
      const transcoders: ITranscoder[] = [];
      const original = factory.createTranscoder;
      vi.spyOn(factory, 'createTranscoder').mockImplementation((type) => {
        const transcoder = original(type);
        transcoders.push(transcoder);
        return transcoder;
      });
      writeSnapshot([
        { id: 'a', input: 'a.mp4', output: 'a_out.mp4', options: {}, transcoder: 'FFMPEG', status: 'running', progress: 50, createdAt: 1 },
      ] as QueueJob[]);
      queue = new JobQueue({ persistence });
      expect(transcoders).toHaveLength(0);
      expect(queue.getJobs()[0].status).toBe('queued');
      queue.start();
      expect(transcoders).toHaveLength(1);
      expect(queue.getJobs()[0].status).toBe('running');
    });

    it('restores the saved concurrency cap', () => {
      persistence.save({
        version: QUEUE_STATE_VERSION,
        concurrency: 2,
        jobs: [
          {
            id: 'a',
            input: 'a.mp4',
            output: 'a_out.mp4',
            options: {},
            transcoder: 'FFMPEG',
            status: 'running',
            progress: 10,
            createdAt: 1,
          },
          {
            id: 'b',
            input: 'b.mp4',
            output: 'b_out.mp4',
            options: {},
            transcoder: 'FFMPEG',
            status: 'running',
            progress: 20,
            createdAt: 2,
          },
        ] as QueueJob[],
      });
      const transcoders: ITranscoder[] = [];
      const original = factory.createTranscoder;
      vi.spyOn(factory, 'createTranscoder').mockImplementation((type) => {
        const transcoder = original(type);
        transcoders.push(transcoder);
        return transcoder;
      });
      queue = new JobQueue({ persistence });
      queue.start();
      expect(transcoders).toHaveLength(2);
      expect(queue.getJobs().every((j) => j.status === 'running')).toBe(true);
    });

    it('flushState writes the current jobs to disk', () => {
      queue = new JobQueue({ persistence });
      queue.addJob('in.mp4', 'out.mp4', { videoCodec: 'libx264' }, 'FFMPEG');
      queue.flushState();
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { version: number; concurrency: number; jobs: QueueJob[] };
      expect(snapshot.version).toBe(QUEUE_STATE_VERSION);
      expect(snapshot.concurrency).toBe(1);
      expect(snapshot.jobs).toHaveLength(1);
      expect(snapshot.jobs[0].input).toBe('in.mp4');
      expect(snapshot.jobs[0].options).toEqual({ videoCodec: 'libx264' });
    });

    it('debounces writes after a mutation', async () => {
      queue = new JobQueue({ persistence, persistDelayMs: 20 });
      queue.addJob('in.mp4', 'out.mp4', {}, 'FFMPEG');
      expect(fs.existsSync(snapshotPath)).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(fs.existsSync(snapshotPath)).toBe(true);
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { jobs: QueueJob[] };
      expect(snapshot.jobs).toHaveLength(1);
    });

    it('persists status transitions after a job completes', () => {
      queue = new JobQueue({ persistence });
      queue.addJob('in.mp4', 'out.mp4', {}, 'FFMPEG');
      queue.start();
      const transcoder = (queue as unknown as { activeJobs: Map<string, { emitter: NodeJS.EventEmitter }> }).activeJobs.get(
        queue.getJobs()[0].id,
      );
      transcoder!.emitter.emit('end');
      queue.flushState();
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { jobs: QueueJob[] };
      expect(snapshot.jobs[0].status).toBe('done');
      expect(snapshot.jobs[0].progress).toBe(100);
    });

    it('cancelAll clears the persisted snapshot file', () => {
      queue = new JobQueue({ persistence });
      queue.addJob('in.mp4', 'out.mp4', {}, 'FFMPEG');
      queue.flushState();
      expect(fs.existsSync(snapshotPath)).toBe(true);
      queue.cancelAll();
      expect(fs.existsSync(snapshotPath)).toBe(false);
    });

    it('a restored queue can be re-persisted after another addJob', () => {
      writeSnapshot([
        { id: 'a', input: 'a.mp4', output: 'a_out.mp4', options: {}, transcoder: 'FFMPEG', status: 'done', progress: 100, createdAt: 1 },
      ] as QueueJob[]);
      queue = new JobQueue({ persistence });
      queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
      queue.flushState();
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { jobs: QueueJob[] };
      expect(snapshot.jobs.map((j) => j.id)).toHaveLength(2);
      expect(snapshot.jobs.map((j) => j.input)).toEqual(['a.mp4', 'b.mp4']);
    });
  });

  describe('drained', () => {
    let transcoders: ITranscoder[];

    beforeEach(() => {
      transcoders = [];
      const original = factory.createTranscoder;
      vi.spyOn(factory, 'createTranscoder').mockImplementation((type) => {
        const transcoder = original(type);
        transcoders.push(transcoder);
        return transcoder;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function finish(index: number): void {
      (transcoders[index] as unknown as { emitter: NodeJS.EventEmitter }).emitter.emit('end');
    }

    function failWith(index: number, err: Error): void {
      (transcoders[index] as unknown as { emitter: NodeJS.EventEmitter }).emitter.emit('error', err);
    }

    it('emits drained once when the last job completes naturally', () => {
      return new Promise<void>((resolve) => {
        queue = new JobQueue(1);
        queue.on('drained', () => {
          expect(queue.getJobs().map((j) => j.status)).toEqual(['done']);
          resolve();
        });
        queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
        queue.start();
        finish(0);
      });
    });

    it('emits drained after a batch of jobs finishes, and again on the next batch', () => {
      return new Promise<void>((resolve) => {
        let drains = 0;
        queue = new JobQueue(2);
        queue.on('drained', () => {
          drains += 1;
          if (drains === 1) {
            expect(queue.getJobs().map((j) => j.status)).toEqual(['done', 'done']);
            queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
            queue.start();
            finish(2);
          } else if (drains === 2) {
            expect(queue.getJobs().map((j) => j.status)).toEqual(['done', 'done', 'done']);
            resolve();
          }
        });
        queue.addJob('a1.mp4', 'a1_out.mp4', {}, 'FFMPEG');
        queue.addJob('a2.mp4', 'a2_out.mp4', {}, 'FFMPEG');
        queue.start();
        finish(0);
        finish(1);
      });
    });

    it('emits drained when a job errors (non-cancelled) and none remain', () => {
      return new Promise<void>((resolve) => {
        queue = new JobQueue(1);
        queue.on('drained', () => {
          expect(queue.getJobs().map((j) => j.status)).toEqual(['error']);
          resolve();
        });
        queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
        queue.start();
        failWith(0, new Error('boom'));
      });
    });

    it('does not emit drained when every job was cancelled', () => {
      queue = new JobQueue(1);
      const drained = vi.fn();
      queue.on('drained', drained);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.start();
      queue.cancelAll();
      failWith(0, cancelledError());
      expect(drained).not.toHaveBeenCalled();
    });

    it('does not emit drained after cancelAll even when an active job errors', () => {
      queue = new JobQueue(1);
      const drained = vi.fn();
      queue.on('drained', drained);
      queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
      queue.start();
      queue.cancelAll();
      failWith(0, cancelledError());
      expect(drained).not.toHaveBeenCalled();
    });

    it('emits drained for a new batch added after a cancelled batch', () => {
      return new Promise<void>((resolve) => {
        queue = new JobQueue(1);
        let drains = 0;
        queue.on('drained', () => {
          drains += 1;
          expect(queue.getJobs().map((j) => j.status)).toEqual(['done']);
          resolve();
        });
        queue.addJob('a.mp4', 'a_out.mp4', {}, 'FFMPEG');
        queue.start();
        queue.cancelAll();
        failWith(0, cancelledError());
        queue.addJob('b.mp4', 'b_out.mp4', {}, 'FFMPEG');
        queue.start();
        finish(1);
        expect(drains).toBe(1);
      });
    });
  });
});
