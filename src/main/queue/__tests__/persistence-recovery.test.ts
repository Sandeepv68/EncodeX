/**
 * @fileoverview Phase 4.3 - recovery of the persisted queue across a restart.
 *
 * The plan's reload/quit row ends with: *kill the main process mid-queue and
 * relaunch against the same userDataDir - assert the persisted queue is valid
 * and the app starts*. Two facts make that a hostile boundary rather than a
 * bookkeeping detail:
 *
 *  - **The snapshot is read during construction.** `registerQueueHandlers`
 *    does `new JobQueue({ persistence })` synchronously while the window boots
 *    (`src/main/ipc/queue.ts`), so anything `load()` hands back is dereferenced
 *    before the first frame is drawn. There is no error boundary between the
 *    file and a blank window.
 *  - **`FileQueuePersistence.load()` is the only validator, and it only checks
 *    `Array.isArray(jobs)`.** The file sits in `userData`, editable by the user
 *    and by anything else with write access, and a graceful quit deliberately
 *    deletes it - so what survives a *hard* kill is by definition whatever the
 *    last debounced write managed to leave behind.
 *
 * The suite therefore asserts both halves of the contract: hostile contents
 * yield a queue that still constructs, and a well-formed snapshot restores a
 * queue that still runs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { ConversionOptions, QueueJob, TranscoderType } from '../../../shared/types';
import type { ITranscoder } from '../../transcoders/types';

const { FileQueuePersistence, QUEUE_STATE_FILENAME, QUEUE_STATE_VERSION } = await import('../persistence');
const { JobQueue } = await import('../job-queue');
const { QUEUE_STATUS } = await import('../../../shared/media-options');

/** Minimal transcoder so a restored queue can be proven startable. */
class FakeTranscoder implements ITranscoder {
  readonly emitter = new EventEmitter();
  convert(): EventEmitter {
    return this.emitter;
  }
  cancel(): void {}
  pause(): void {}
  resume(): void {}
  getType(): string {
    return 'FFMPEG';
  }
  async getInfo(): Promise<never> {
    throw new Error('not under test');
  }
}

const OPTS = {} as ConversionOptions;

function makeQueue(persistence: unknown): InstanceType<typeof JobQueue> {
  let created = 0;
  return new (JobQueue as unknown as new (o: unknown) => InstanceType<typeof JobQueue>)({
    concurrency: 1,
    persistDelayMs: 1,
    transcoderFactory: () => {
      created += 1;
      return new FakeTranscoder();
    },
    persistence,
  });
}

/** A well-formed job as the app itself would write it. */
function aJob(overrides: Partial<QueueJob> = {}): QueueJob {
  return {
    id: 'job-1',
    input: 'in/a.mp4',
    output: 'out/a.mp4',
    options: OPTS,
    transcoder: 'FFMPEG' as TranscoderType,
    status: QUEUE_STATUS.QUEUED,
    progress: 0,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

/** Writes raw bytes into `queue-state.json`, bypassing `save()`. */
function writeRaw(dir: string, contents: string): void {
  fs.writeFileSync(path.join(dir, QUEUE_STATE_FILENAME), contents, 'utf8');
}

describe('FileQueuePersistence - hostile contents', () => {
  let dir: string;
  let persistence: any;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-queue-'));
    persistence = new FileQueuePersistence(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when the file does not exist', () => {
    expect(persistence.load()).toBeNull();
  });

  it('round-trips a snapshot it wrote itself', () => {
    const snapshot = { version: QUEUE_STATE_VERSION, concurrency: 3, jobs: [aJob()] };
    persistence.save(snapshot);
    expect(persistence.load()).toEqual(snapshot);
  });

  it('creates the parent directory when it is missing', () => {
    const nested = path.join(dir, 'a', 'b');
    const target = new FileQueuePersistence(nested);
    target.save({ version: QUEUE_STATE_VERSION, concurrency: 1, jobs: [] });
    expect(fs.existsSync(path.join(nested, QUEUE_STATE_FILENAME))).toBe(true);
  });

  it.each([
    ['truncated JSON (a torn write)', '{"version":1,"concurrency":1,"jobs":[{"id":"job-1"'],
    ['an empty file', ''],
    ['a bare string', '"hello"'],
    ['a bare number', '42'],
    ['a bare array', '[]'],
    ['null', 'null'],
    ['jobs that is not an array', '{"version":1,"jobs":"job-1"}'],
    ['not an object', 'not json at all'],
  ])('yields null for %s', (_label, contents) => {
    writeRaw(dir, contents);
    expect(persistence.load()).toBeNull();
  });

  /**
   * The contract `load()` advertises: a snapshot it accepts must be safe to
   * dereference. Everything below is parseable JSON, so `JSON.parse` is happy
   * - the shape is what has to be checked.
   */
  it.each([
    ['a null entry', '[null]'],
    ['a bare string entry', '["job-1"]'],
    ['a bare object entry', '[{"foo":1}]'],
    ['a job whose id is a number', '[{"id":1,"input":"a","output":"b","status":"queued","progress":0}]'],
    ['a job whose progress is NaN-as-string', '[{"id":"a","input":"a","output":"b","status":"queued","progress":"x"}]'],
    ['a job missing status', '[{"id":"a","input":"a","output":"b","progress":0}]'],
  ])('yields null for a jobs array containing %s', (_label, entries) => {
    writeRaw(dir, `{"version":${QUEUE_STATE_VERSION},"concurrency":1,"jobs":${entries}}`);
    expect(persistence.load()).toBeNull();
  });

  it('yields null for a snapshot from an unknown format version', () => {
    writeRaw(dir, `{"version":${QUEUE_STATE_VERSION + 1},"concurrency":1,"jobs":[${JSON.stringify(aJob())}]}`);
    expect(persistence.load()).toBeNull();
  });

  it('yields null for a snapshot with no version at all', () => {
    writeRaw(dir, `{"concurrency":1,"jobs":[${JSON.stringify(aJob())}]}`);
    expect(persistence.load()).toBeNull();
  });
});

describe('JobQueue boot against a persisted snapshot', () => {
  let dir: string;
  let persistence: any;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-queue-'));
    persistence = new FileQueuePersistence(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('constructs and starts a queue from a well-formed snapshot', () => {
    persistence.save({ version: QUEUE_STATE_VERSION, concurrency: 2, jobs: [aJob({ id: 'restored' })] });
    const queue = makeQueue(persistence);
    expect(queue.getJobs().map((j) => j.id)).toEqual(['restored']);
    queue.start();
    expect(queue.getJobs()[0].status).toBe(QUEUE_STATUS.RUNNING);
  });

  it('downgrades a RUNNING job back to QUEUED so it is re-run', () => {
    persistence.save({
      version: QUEUE_STATE_VERSION,
      concurrency: 1,
      jobs: [aJob({ status: QUEUE_STATUS.RUNNING, progress: 61, paused: true })],
    });
    const queue = makeQueue(persistence);
    const [job] = queue.getJobs();
    expect(job.status).toBe(QUEUE_STATUS.QUEUED);
    expect(job.progress).toBe(0);
    expect(job.paused).toBe(false);
  });

  it('keeps DONE and ERROR jobs as they were', () => {
    persistence.save({
      version: QUEUE_STATE_VERSION,
      concurrency: 1,
      jobs: [aJob({ id: 'done', status: QUEUE_STATUS.DONE, progress: 100 }), aJob({ id: 'bad', status: QUEUE_STATUS.ERROR, error: 'x' })],
    });
    const queue = makeQueue(persistence);
    const byId = new Map(queue.getJobs().map((j) => [j.id, j.status]));
    expect(byId.get('done')).toBe(QUEUE_STATUS.DONE);
    expect(byId.get('bad')).toBe(QUEUE_STATUS.ERROR);
  });

  it('clamps a hostile persisted concurrency instead of adopting it', () => {
    writeRaw(dir, `{"version":${QUEUE_STATE_VERSION},"concurrency":1e999,"jobs":[${JSON.stringify(aJob())}]}`);
    const queue = makeQueue(persistence);
    expect(Number.isFinite(queue.getConcurrency())).toBe(true);
    expect(queue.getConcurrency()).toBeGreaterThanOrEqual(1);
  });

  /**
   * The boot assertion. `registerQueueHandlers` constructs the queue with no
   * surrounding try/catch, so a throw here is a window that never appears.
   */
  it.each([
    ['a null entry', '[null'],
    ['a string entry', '["job-1"]'],
    ['an object entry', '[{"foo":1}]'],
    ['a partially valid job', `[${JSON.stringify({ id: 'half' })}]`],
  ])('still constructs when the snapshot contains %s', (_label, entries) => {
    writeRaw(dir, `{"version":${QUEUE_STATE_VERSION},"concurrency":1,"jobs":${entries}}`);
    let queue: InstanceType<typeof JobQueue> | undefined;
    expect(() => {
      queue = makeQueue(persistence);
    }).not.toThrow();
    expect(queue).toBeDefined();
    expect(Array.isArray(queue!.getJobs())).toBe(true);
  });

  it('a snapshot that survives a hard kill is written back unchanged', () => {
    const original = { version: QUEUE_STATE_VERSION, concurrency: 3, jobs: [aJob({ id: 'kept' })] };
    persistence.save(original);

    // Reopen against the same directory - what a relaunch does.
    const relaunched = makeQueue(new FileQueuePersistence(dir));
    relaunched.flushState();

    const after = JSON.parse(fs.readFileSync(path.join(dir, QUEUE_STATE_FILENAME), 'utf8')) as {
      jobs: QueueJob[];
      concurrency: number;
      version: number;
    };
    expect(after.version).toBe(QUEUE_STATE_VERSION);
    expect(after.concurrency).toBe(3);
    expect(after.jobs.map((j) => j.id)).toEqual(['kept']);
  });
});
