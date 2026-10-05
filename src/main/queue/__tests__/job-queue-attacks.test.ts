/**
 * @fileoverview Phase 4.1 - adversarial state-machine attacks against JobQueue.
 *
 * The plan's queue row lists illegal transitions and hostile numeric input. Every
 * argument here reaches `JobQueue` over IPC from the renderer (or, for
 * `queueImport`, from a file on disk), so nothing at this boundary can be assumed
 * well-formed: `structuredClone` happily carries `NaN`, and `Infinity` survives a
 * JSON round trip as `1e999`.
 *
 * Two invariants are asserted throughout rather than per-test, because both are
 * properties of the machine rather than of any one transition:
 *
 *  - **The queue never wedges.** After any hostile call, a QUEUED job must still be
 *    startable. A queue that silently stops processing is worse than one that
 *    throws, because nothing reports it.
 *  - **Every emitted number is finite and in range.** The preload drops any payload
 *    failing `isQueueJob` / `isQueueMovedEvent`, so a single `NaN` does not crash the
 *    renderer - it silently deletes the event, which looks like "drag and drop does
 *    nothing" or "the progress bar stopped updating".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ConversionOptions, TranscoderType } from '../../../shared/types';
import type { ITranscoder } from '../../transcoders/types';

const { JobQueue } = await import('../job-queue');
const { QUEUE_STATUS } = await import('../../../shared/media-options');
const { MAX_QUEUE_CONCURRENCY } = await import('../../../shared/constants');

type Handler = (payload: unknown) => void;

/** A transcoder whose lifecycle is driven by the test rather than by a process. */
class FakeTranscoder implements ITranscoder {
  readonly emitter = new EventEmitter();
  cancelled = false;
  pauseCount = 0;
  resumeCount = 0;
  convertCalls = 0;

  convert(): EventEmitter {
    this.convertCalls += 1;
    return this.emitter;
  }
  cancel(): void {
    this.cancelled = true;
  }
  pause(): void {
    this.pauseCount += 1;
  }
  resume(): void {
    this.resumeCount += 1;
  }
  getType(): string {
    return 'FFMPEG';
  }
  async getInfo(): Promise<never> {
    throw new Error('not under test');
  }
}

/** Collects everything the queue emits so assertions can be made after the fact. */
class Recorder {
  readonly statusChange: unknown[] = [];
  readonly moved: { id: string; toPosition: number }[] = [];
  readonly drained: number[] = [];
  readonly cancelled: number[] = [];
  readonly removed: string[] = [];

  attach(queue: InstanceType<typeof JobQueue>): void {
    const on: Record<string, Handler> = {
      statusChange: (p) => this.statusChange.push(p),
      moved: (p) => this.moved.push(p as { id: string; toPosition: number }),
      drained: () => this.drained.push(this.drained.length),
      cancelled: () => this.cancelled.push(this.cancelled.length),
      removed: (p) => this.removed.push(String(p)),
    };
    for (const [event, handler] of Object.entries(on)) {
      queue.on(event, handler);
    }
  }
}

function makeQueue(transcoders: FakeTranscoder[], options: Record<string, unknown> = {}) {
  let created = 0;
  const queue = new (JobQueue as unknown as new (o: unknown) => InstanceType<typeof JobQueue>)({
    concurrency: 1,
    persistDelayMs: 1,
    // Indexes by *creation order*, not by push order: a test may pre-seed some
    // fakes with `next()` and let the rest be created on demand, but every fake
    // the queue actually starts must land in the array so the test can drive it.
    // The previous `transcoders[created++] ?? new FakeTranscoder()` silently
    // created an untracked transcoder once the seeds ran out, which made the
    // caller's `transcoders[i].emitter` an undefined dereference rather than a
    // meaningful assertion failure.
    transcoderFactory: () => {
      const existing = transcoders[created];
      if (existing) {
        created += 1;
        return existing;
      }
      const fresh = new FakeTranscoder();
      transcoders[created] = fresh;
      created += 1;
      return fresh;
    },
    ...options,
  });
  const recorder = new Recorder();
  recorder.attach(queue);
  return { queue, recorder };
}

const OPTS = {} as ConversionOptions;

describe('JobQueue - hostile numeric input', () => {
  let transcoders: FakeTranscoder[];

  beforeEach(() => {
    transcoders = [];
  });

  const next = () => {
    const t = new FakeTranscoder();
    transcoders.push(t);
    return t;
  };

  it('setConcurrency(NaN) does not wedge the queue', () => {
    const { queue } = makeQueue(transcoders);
    queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.setConcurrency(NaN);

    expect(Number.isFinite(queue.getConcurrency())).toBe(true);
    expect(queue.getConcurrency()).toBeGreaterThanOrEqual(1);
    expect(queue.getConcurrency()).toBeLessThanOrEqual(MAX_QUEUE_CONCURRENCY);

    queue.start();
    expect(queue.getJobs()[0].status).toBe(QUEUE_STATUS.RUNNING);
  });

  it.each([
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['NaN', NaN],
    ['0', 0],
    ['-5', -5],
    ['99', 99],
    ['2.5', 2.5],
  ])('setConcurrency(%s) is clamped to 1..MAX', (_label, value) => {
    const { queue } = makeQueue(transcoders);
    queue.setConcurrency(value);
    const actual = queue.getConcurrency();
    expect(Number.isFinite(actual)).toBe(true);
    expect(actual).toBeGreaterThanOrEqual(1);
    expect(actual).toBeLessThanOrEqual(MAX_QUEUE_CONCURRENCY);
    expect(Number.isInteger(actual)).toBe(true);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['0', 0],
    ['99', 99],
    ['undefined', undefined],
    ['null', null],
    ['string', '4'],
  ])('constructor concurrency=%s is clamped to 1..MAX', (_label, value) => {
    const { queue } = makeQueue([], { concurrency: value });
    const actual = queue.getConcurrency();
    expect(Number.isFinite(actual)).toBe(true);
    expect(actual).toBeGreaterThanOrEqual(1);
    expect(actual).toBeLessThanOrEqual(MAX_QUEUE_CONCURRENCY);
    expect(Number.isInteger(actual)).toBe(true);
  });

  it('setConcurrency(NaN) with a paused-then-resumed queue still drains', () => {
    const { queue } = makeQueue(transcoders);
    const first = next();
    queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.addJob('b.mp4', 'out/b.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    expect(queue.getJobs()[0].status).toBe(QUEUE_STATUS.RUNNING);

    queue.pause();
    queue.setConcurrency(NaN);
    queue.resume();

    expect(queue.getConcurrency()).toBeGreaterThanOrEqual(1);
    first.emitter.emit('end');
    const statuses = queue.getJobs().map((j) => j.status);
    expect(statuses).toContain(QUEUE_STATUS.RUNNING);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['1.7', 1.7],
    ['undefined', undefined],
    ['null', null],
    ['string', '1'],
  ])('moveJobTo target %s never emits a non-finite toPosition', (_label, value) => {
    const { queue, recorder } = makeQueue(transcoders, { concurrency: 4 });
    const id = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.addJob('b.mp4', 'out/b.mp4', OPTS, 'FFMPEG' as TranscoderType);

    const moved = queue.moveJobTo(id, value as number);
    for (const event of recorder.moved) {
      expect(Number.isFinite(event.toPosition)).toBe(true);
      expect(Number.isInteger(event.toPosition)).toBe(true);
      expect(event.toPosition).toBeGreaterThanOrEqual(0);
      expect(event.toPosition).toBeLessThanOrEqual(1);
    }
    if (moved) {
      expect(recorder.moved).toHaveLength(1);
    }
    // The live order must stay a permutation of the original job set.
    expect(
      queue
        .getJobs()
        .map((j) => j.id)
        .sort(),
    ).toEqual(
      queue
        .getJobs()
        .map((j) => j.id)
        .sort(),
    );
    expect(queue.getJobs()).toHaveLength(2);
  });

  it('moveJobTo with a non-finite target does not relocate the job', () => {
    const { queue, recorder } = makeQueue(transcoders, { concurrency: 4 });
    const a = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.addJob('b.mp4', 'out/b.mp4', OPTS, 'FFMPEG' as TranscoderType);

    const moved = queue.moveJobTo(a, NaN);
    expect(queue.getJobs()[0].id).toBe(a);
    if (moved) {
      expect(recorder.moved[0].toPosition).toBeGreaterThanOrEqual(0);
    }
  });

  it('moveJobTo against an empty queue is a no-op, not a crash', () => {
    const { queue, recorder } = makeQueue(transcoders);
    expect(queue.moveJobTo('nope', NaN)).toBe(false);
    expect(queue.moveJobTo('nope', 0)).toBe(false);
    expect(recorder.moved).toHaveLength(0);
  });

  it('progress payloads handed to the queue are persisted as finite numbers', () => {
    const { queue } = makeQueue(transcoders);
    const t = next();
    queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();

    for (const percent of [NaN, Infinity, -Infinity, 50]) {
      t.emitter.emit('progress', { percent, time: '00:00:00', fps: 0, speed: '1x', eta: '0', bitrate: '' });
      expect(Number.isFinite(queue.getJobs()[0].progress)).toBe(true);
    }
  });
});

describe('JobQueue - illegal transitions', () => {
  let transcoders: FakeTranscoder[];

  beforeEach(() => {
    transcoders = [];
  });

  const next = () => {
    const t = new FakeTranscoder();
    transcoders.push(t);
    return t;
  };

  const running = (queue: InstanceType<typeof JobQueue>) => queue.getJobs().find((j) => j.status === QUEUE_STATUS.RUNNING);

  it('updateJobOptions is refused on a DONE job and leaves options untouched', () => {
    const { queue } = makeQueue(transcoders);
    const t = next();
    const id = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    t.emitter.emit('end');

    const before = queue.getJobs()[0].options;
    expect(queue.updateJobOptions(id, { videoCodec: 'hevc' } as ConversionOptions)).toBe(false);
    expect(queue.getJobs()[0].options).toBe(before);
    expect(queue.getJobs()[0].status).toBe(QUEUE_STATUS.DONE);
  });

  it('updateJobOptions is refused on a RUNNING job', () => {
    const { queue } = makeQueue(transcoders);
    next();
    const id = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();

    expect(queue.updateJobOptions(id, { videoCodec: 'hevc' } as ConversionOptions)).toBe(false);
    expect(running(queue)?.options).toEqual(OPTS);
  });

  it('updateJobOptions on an unknown id returns false', () => {
    const { queue } = makeQueue(transcoders);
    expect(queue.updateJobOptions('ghost', OPTS)).toBe(false);
  });

  it('updateJobOptions on a QUEUED job replaces options and emits statusChange', () => {
    const { queue, recorder } = makeQueue(transcoders);
    const id = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    expect(queue.updateJobOptions(id, { videoCodec: 'hevc' } as ConversionOptions, 'out/b.mp4')).toBe(true);
    expect(queue.getJobs()[0].options).toEqual({ videoCodec: 'hevc' });
    expect(queue.getJobs()[0].output).toBe('out/b.mp4');
    expect(recorder.statusChange).toHaveLength(1);
  });

  it('moveJobTo is refused for RUNNING, DONE and ERROR jobs', () => {
    const { queue } = makeQueue(transcoders, { concurrency: 1 });
    const running = next();
    const errored = next();
    const idA = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    const idB = queue.addJob('b.mp4', 'out/b.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.addJob('c.mp4', 'out/c.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.addJob('d.mp4', 'out/d.mp4', OPTS, 'FFMPEG' as TranscoderType);
    const idE = queue.addJob('e.mp4', 'out/e.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();

    expect(queue.moveJobTo(idA, 0)).toBe(false); // RUNNING
    running.emitter.emit('end');
    expect(queue.getJobs().find((j) => j.id === idA)?.status).toBe(QUEUE_STATUS.DONE);
    expect(queue.moveJobTo(idA, 0)).toBe(false); // DONE
    expect(queue.moveJobTo(idB, 0)).toBe(false); // b took the slot, so RUNNING

    errored.emitter.emit('error', new Error('boom'));
    expect(queue.getJobs().find((j) => j.id === idB)?.status).toBe(QUEUE_STATUS.ERROR);
    expect(queue.moveJobTo(idB, 0)).toBe(false); // ERROR

    // c is RUNNING, so exactly d and e are left to reorder.
    expect(queue.moveJobTo(idE, 0)).toBe(true);
    expect(queue.moveJobTo('ghost', 0)).toBe(false);
  });

  it('cancelling an already-DONE job removes it without disturbing the rest', () => {
    const { queue, recorder } = makeQueue(transcoders, { concurrency: 1 });
    const t = next();
    const doneId = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    const keepId = queue.addJob('b.mp4', 'out/b.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    t.emitter.emit('end');

    queue.cancelJob(doneId);
    queue.cancelJob(doneId);

    expect(queue.getJobs().map((j) => j.id)).toEqual([keepId]);
    expect(recorder.removed).toEqual([doneId, doneId]);
  });

  it('clearCompleted keeps QUEUED and RUNNING jobs', () => {
    const { queue } = makeQueue(transcoders, { concurrency: 4 });
    const t = next();
    const doneId = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    const runningId = queue.addJob('b.mp4', 'out/b.mp4', OPTS, 'FFMPEG' as TranscoderType);
    const queuedId = queue.addJob('c.mp4', 'out/c.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    t.emitter.emit('end');

    expect(queue.clearCompleted()).toBe(1);
    expect(
      queue
        .getJobs()
        .map((j) => j.id)
        .sort(),
    ).toEqual([queuedId, runningId].sort());
    expect(queue.getJobs().find((j) => j.id === doneId)).toBeUndefined();
  });

  it('start() on a fully terminal queue does not re-emit drained', () => {
    const { queue, recorder } = makeQueue(transcoders);
    const t = next();
    queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    t.emitter.emit('end');
    expect(recorder.drained).toHaveLength(1);

    queue.start();
    queue.start();
    expect(recorder.drained).toHaveLength(1);
  });

  it('cancelAll never arms the drained event', () => {
    const { queue, recorder } = makeQueue(transcoders);
    const t = next();
    queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    queue.cancelAll();
    t.emitter.emit('error', new Error('late'));

    expect(recorder.drained).toHaveLength(0);
    expect(recorder.cancelled).toHaveLength(1);
    expect(queue.getJobs()).toHaveLength(0);
  });
});

describe('JobQueue - cancel/complete races', () => {
  let transcoders: FakeTranscoder[];

  beforeEach(() => {
    transcoders = [];
  });

  const next = () => {
    const t = new FakeTranscoder();
    transcoders.push(t);
    return t;
  };

  it('cancelling a job releases its concurrency slot even if the transcoder never reports back', () => {
    const { queue } = makeQueue(transcoders, { concurrency: 1 });
    const t = next();
    queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    const bId = queue.addJob('b.mp4', 'out/b.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    expect(t.cancelled).toBe(false);

    queue.cancelJob(queue.getJobs()[0].id);
    expect(t.cancelled).toBe(true);

    // The slot must be free now: `b` is the only remaining job.
    queue.start();
    const b = queue.getJobs().find((j) => j.id === bId);
    expect(b?.status).toBe(QUEUE_STATUS.RUNNING);
  });

  it('cancelling every job frees every slot', () => {
    const { queue } = makeQueue(transcoders, { concurrency: 4 });
    for (let i = 0; i < 4; i += 1) next();
    const ids = Array.from({ length: 4 }, (_, i) => queue.addJob(`in${i}.mp4`, `out/o${i}.mp4`, OPTS, 'FFMPEG' as TranscoderType));
    const queued = queue.addJob('queued.mp4', 'out/queued.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();

    for (const id of ids) queue.cancelJob(id);
    queue.start();

    expect(queue.getJobs().map((j) => j.id)).toEqual([queued]);
    expect(queue.getJobs()[0].status).toBe(QUEUE_STATUS.RUNNING);
  });

  it('a job that finishes while the queue is paused is not left flagged paused', () => {
    const { queue, recorder } = makeQueue(transcoders);
    const t = next();
    queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    queue.pause();
    t.emitter.emit('end');

    const job = queue.getJobs()[0];
    expect(job.status).toBe(QUEUE_STATUS.DONE);
    expect(job.paused).toBe(false);

    const statuses = recorder.statusChange.map((p) => (p as { paused?: boolean }).paused);
    expect(statuses.every((p) => p !== true)).toBe(true);
  });

  it('resume() after a terminal job emits no statusChange for it', () => {
    const { queue, recorder } = makeQueue(transcoders);
    const t = next();
    queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    queue.pause();
    t.emitter.emit('end');
    const before = recorder.statusChange.length;

    queue.resume();
    expect(recorder.statusChange.length).toBe(before);
  });

  it('late transcoder events after cancelAll do not report jobs the queue no longer holds', () => {
    const { queue, recorder } = makeQueue(transcoders);
    const t = next();
    queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    const heldIds = new Set(queue.getJobs().map((j) => j.id));

    queue.cancelAll();
    t.emitter.emit('error', new Error('late failure'));
    t.emitter.emit('end');

    for (const event of recorder.statusChange) {
      expect(heldIds.has((event as { id: string }).id)).toBe(true);
    }
    expect(queue.getJobs()).toHaveLength(0);
  });

  it('removing a RUNNING job then completing it does not report an unknown job', () => {
    const { queue, recorder } = makeQueue(transcoders, { concurrency: 2 });
    const t = next();
    const id = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    expect(recorder.statusChange).toHaveLength(1); // a -> RUNNING

    queue.removeJob(id);
    const emitted = recorder.statusChange.length;

    t.emitter.emit('end');
    // The transition happened, but the queue no longer holds the job, so it
    // must not be reported: the renderer would be told to update a row it has
    // already dropped, and the log would claim a change for a job the queue
    // does not contain.
    expect(recorder.statusChange).toHaveLength(emitted);
    expect(queue.getJobs()).toHaveLength(0);
  });

  it('a double cancel does not leave the queue wedged', () => {
    const { queue } = makeQueue(transcoders, { concurrency: 1 });
    const t = next();
    const a = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    const b = queue.addJob('b.mp4', 'out/b.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();

    queue.cancelJob(a);
    queue.cancelJob(a);
    t.cancelled = true;
    queue.start();

    expect(queue.getJobs().find((j) => j.id === b)?.status).toBe(QUEUE_STATUS.RUNNING);
  });

  it('progress arriving after a job was cancelled does not resurrect it', () => {
    const { queue } = makeQueue(transcoders, { concurrency: 1 });
    const t = next();
    const a = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    const b = queue.addJob('b.mp4', 'out/b.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.start();
    queue.cancelJob(a);

    t.emitter.emit('progress', { percent: 42, time: '00:00:01', fps: 24, speed: '1x', eta: '1', bitrate: '' });
    t.emitter.emit('end');

    expect(queue.getJobs().map((j) => j.id)).toEqual([b]);
    expect(queue.getJobs()[0].status).toBe(QUEUE_STATUS.RUNNING);
  });
});

describe('JobQueue - bulk and reentrancy', () => {
  let transcoders: FakeTranscoder[];

  beforeEach(() => {
    transcoders = [];
  });

  const next = () => {
    const t = new FakeTranscoder();
    transcoders.push(t);
    return t;
  };

  it('200 jobs sharing one output path each start exactly once and respect the cap', () => {
    const { queue } = makeQueue(transcoders, { concurrency: 4 });
    for (let i = 0; i < 199; i += 1) next();
    const ids = Array.from({ length: 200 }, () => queue.addJob('in.mp4', 'same-out.mp4', OPTS, 'FFMPEG' as TranscoderType));
    expect(new Set(ids).size).toBe(200);

    queue.start();
    const finished = new Set<number>();
    let peak = 0;
    // Drive completions from the jobs the machine actually started instead of
    // firing `end` on every fake and hoping the snapshot taken at the top of
    // each round still describes reality - the previous version asserted on a
    // stale view and failed without ever reaching a real invariant.
    for (let round = 0; round < 500 && finished.size < 200; round += 1) {
      const running = queue.getJobs().filter((j) => j.status === QUEUE_STATUS.RUNNING);
      peak = Math.max(peak, running.length);
      expect(running.length).toBeLessThanOrEqual(4);
      expect(running.length).toBeGreaterThan(0); // never wedged, never over the cap

      const victim = transcoders.findIndex((t, i) => t.convertCalls > 0 && !finished.has(i));
      expect(victim).toBeGreaterThanOrEqual(0);
      finished.add(victim);
      transcoders[victim].emitter.emit('end');
    }

    expect(peak).toBeGreaterThan(1);
    expect(finished.size).toBe(200);
    expect(queue.getJobs().every((j) => j.status === QUEUE_STATUS.DONE)).toBe(true);
    expect(transcoders.every((t) => t.convertCalls === 1)).toBe(true);
    const totalStarts = transcoders.reduce((sum, t) => sum + t.convertCalls, 0);
    expect(totalStarts).toBe(200);
  });

  it('a statusChange listener that pauses the queue stops further starts', () => {
    const { queue } = makeQueue(transcoders, { concurrency: 4 });
    for (let i = 0; i < 3; i += 1) next();
    const a = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.addJob('b.mp4', 'out/b.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.addJob('c.mp4', 'out/c.mp4', OPTS, 'FFMPEG' as TranscoderType);
    let pausedOnce = false;
    queue.on('statusChange', (job: { id: string; status: string }) => {
      if (pausedOnce || job.status !== QUEUE_STATUS.RUNNING || job.id !== a) return;
      pausedOnce = true;
      queue.pause();
    });

    queue.start();
    // The drain started `a`, the listener paused, and the loop must honour it:
    // with a concurrency cap of 4 the remaining two jobs are otherwise started
    // in the very same synchronous pass, before pause() could ever return.
    expect(queue.getJobs().map((j) => j.status)).toEqual([QUEUE_STATUS.RUNNING, QUEUE_STATUS.QUEUED, QUEUE_STATUS.QUEUED]);

    queue.resume();
    expect(queue.getJobs().filter((j) => j.status === QUEUE_STATUS.RUNNING)).toHaveLength(3);
  });

  it('an "added" listener that starts the queue does not double-start a job', () => {
    const { queue } = makeQueue(transcoders, { concurrency: 1 });
    next();
    const id = queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    queue.on('added', () => queue.start());
    queue.start();

    const job = queue.getJobs().find((j) => j.id === id);
    expect(job?.status).toBe(QUEUE_STATUS.RUNNING);
    expect(transcoders.filter((t) => t.convertCalls > 0)).toHaveLength(1);
  });

  it('a drained listener that enqueues and starts a job runs it before start() returns', () => {
    const { queue } = makeQueue(transcoders, { concurrency: 1 });
    next();
    next();
    queue.addJob('a.mp4', 'out/a.mp4', OPTS, 'FFMPEG' as TranscoderType);
    let revived = false;
    queue.on('drained', () => {
      if (revived) return;
      revived = true;
      queue.addJob('b.mp4', 'out/b.mp4', OPTS, 'FFMPEG' as TranscoderType);
      queue.start();
      expect(queue.getJobs().find((j) => j.input === 'b.mp4')?.status).toBe(QUEUE_STATUS.RUNNING);
    });

    queue.start();
    transcoders[0].emitter.emit('end');

    expect(revived).toBe(true);
    expect(queue.getJobs().at(-1)?.status).toBe(QUEUE_STATUS.RUNNING);
  });

  it('a batch where every job fails synchronously fails in place instead of overflowing the stack', () => {
    // A crafted queue import can carry any string as a transcoder type and any
    // object as `options`, and `validateQueueExport` accepts both. Such a batch
    // makes `startJob` throw on every job; if the failure path recursed through
    // `processNext` once per job, `start()` would blow the stack at the import
    // cap and strand the rest of the queue in QUEUED with no error reported.
    const failures = { count: 0 };
    const { queue } = makeQueue([], {
      concurrency: 4,
      transcoderFactory: () => {
        failures.count += 1;
        throw new Error('unknown transcoder');
      },
    });
    const total = 10_000;
    for (let i = 0; i < total; i += 1) queue.addJob(`in${i}.mp4`, `out/o${i}.mp4`, OPTS, 'FFMPEG' as TranscoderType);

    expect(() => queue.start()).not.toThrow();

    expect(failures.count).toBe(total);
    expect(queue.getJobs()).toHaveLength(total);
    expect(queue.getJobs().every((j) => j.status === QUEUE_STATUS.ERROR)).toBe(true);
    expect(queue.getJobs().every((j) => j.error === 'unknown transcoder')).toBe(true);
    expect(queue.getConcurrency()).toBe(4);
  });
});
