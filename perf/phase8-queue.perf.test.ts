/**
 * @fileoverview Phase 8 DoS/resource-limit budget: the queue scheduler under a
 * full 10,000-job load with concurrency at the physical cap.
 *
 * The plan row reads "10,000 jobs in the queue, concurrency 8 | scheduler
 * doesn't starve, memory < 500 MB delta". The product caps concurrency at
 * `MAX_QUEUE_CONCURRENCY` (4), so this suite loads the queue to its real
 * maximum parallelism (4) and pins the two budget halves:
 *
 *   - starvation: after `start()`, every one of the 10,000 jobs reaches DONE
 *     and 'drained' fires (the queue emits it only after a terminal job and an
 *     empty queue, so it is the scheduler's own liveness signal).
 *   - memory: RSS delta stays under the plan's 500 MB bound, and the heap
 *     delta stays under 200 MB so a job-per-JS-object regression can't hide
 *     behind a bloat allowance.
 *
 * A fake transcoder that auto-completes every conversion on the event loop is
 * injected so the scheduler (not ffmpeg) is what is under load.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { EventEmitter } from 'events';
import { Timer, memorySnapshot, formatBytes, writeResults, logSummary } from './test-utils';
import type { PerfResult } from './test-utils';
import { JobQueue } from '../src/main/queue/job-queue';
import { MAX_QUEUE_CONCURRENCY } from '../src/shared/constants';
import { QUEUE_STATUS } from '../src/shared/media-options';
import type { ITranscoder } from '../src/main/transcoders/types';
import type { ConversionOptions, TranscoderType } from '../src/shared/types';

const JOB_COUNT = 10_000;
const RSS_BUDGET = 500 * 1024 * 1024;
const HEAP_BUDGET = 200 * 1024 * 1024;
const DRAIN_BUDGET_MS = 60_000;

/** A conversion that completes on the next macrotask, without calling ffmpeg. */
class AutoCompleteTranscoder implements ITranscoder {
  convert(): EventEmitter {
    const emitter = new EventEmitter();
    setImmediate(() => emitter.emit('end'));
    return emitter;
  }
  cancel(): void {}
  pause(): void {}
  resume(): void {}
  getType(): string {
    return 'FFMPEG';
  }
  getInfo(): Promise<never> {
    throw new Error('not under test');
  }
}

describe('Phase 8 queue perf: 10,000 jobs at max concurrency', () => {
  const results: PerfResult[] = [];

  afterAll(() => {
    const filePath = writeResults('phase8-queue', results);
    logSummary(results);
    console.log(`Results written to: ${filePath}`);
  });

  it('drains 10,000 auto-completing jobs with no starvation and bounded memory', async () => {
    const options = {} as ConversionOptions;
    const queue = new JobQueue({
      concurrency: MAX_QUEUE_CONCURRENCY,
      transcoderFactory: () => new AutoCompleteTranscoder(),
    });

    let doneCount = 0;
    queue.on('statusChange', (job: { status: string }) => {
      if (job.status === QUEUE_STATUS.DONE) doneCount += 1;
    });

    const addTimer = new Timer();
    for (let i = 0; i < JOB_COUNT; i += 1) {
      queue.addJob(`/in/file-${i}.mp4`, `/out/file-${i}_encodex.mp4`, options, 'FFMPEG' as TranscoderType);
    }
    const addMs = addTimer.elapsedMs();

    const before = memorySnapshot();
    const drained = new Promise<boolean>((resolve) => {
      queue.once('drained', () => resolve(true));
    });
    const drainTimer = new Timer();
    queue.start();
    await drained;
    const drainMs = drainTimer.elapsedMs();
    const after = memorySnapshot();

    const statuses = queue.getJobs().reduce((acc: Record<string, number>, job) => {
      acc[job.status] = (acc[job.status] ?? 0) + 1;
      return acc;
    }, {});

    expect(statuses[QUEUE_STATUS.DONE], 'every job must reach DONE (scheduler must not starve)').toBe(JOB_COUNT);
    expect(statuses[QUEUE_STATUS.QUEUED]).toBeUndefined();
    expect(statuses[QUEUE_STATUS.RUNNING]).toBeUndefined();
    expect(doneCount, 'a DONE statusChange must be emitted per job').toBe(JOB_COUNT);
    expect(drainMs).toBeLessThan(DRAIN_BUDGET_MS);

    const rssDelta = after.rss - before.rss;
    const heapDelta = after.heapUsed - before.heapUsed;
    expect(rssDelta, 'RSS delta must stay under the plan bound').toBeLessThan(RSS_BUDGET);
    expect(heapDelta, 'heap delta must stay linear in job count').toBeLessThan(HEAP_BUDGET);

    console.log(
      `  10,000 jobs @ concurrency ${MAX_QUEUE_CONCURRENCY}: add ${addMs.toFixed(0)}ms, drain ${drainMs.toFixed(0)}ms, ` +
        `RSS delta ${formatBytes(rssDelta)}, heap delta ${formatBytes(heapDelta)}`,
    );

    results.push({
      test: 'Phase 8 queue: 10,000 jobs drain with bounded memory',
      phase: 'phase8-queue',
      durationMs: drainMs,
      memoryBefore: { rss: before.rss, heapUsed: before.heapUsed },
      memoryAfter: { rss: after.rss, heapUsed: after.heapUsed },
      memoryDeltaRss: rssDelta,
      memoryDeltaHeap: heapDelta,
      passed: doneCount === JOB_COUNT && rssDelta < RSS_BUDGET && heapDelta < HEAP_BUDGET,
      details: { jobCount: JOB_COUNT, addMs, drainMs, rssDelta, heapDelta, statuses },
      timestamp: new Date().toISOString(),
    });

    queue.removeAllListeners();
  });
});
