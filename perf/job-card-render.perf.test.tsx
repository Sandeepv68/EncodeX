/**
 * @fileoverview Phase 8 renderer memory/scaling budget: a full 5,000-job
 * card render in jsdom.
 *
 * The big-list gate renders 3,000 jobs (plans row 5.2) because 5,000 MUI cards
 * need a ~6 GB jsdom heap that GitHub's 7 GB ubuntu runners cannot clear. So
 * the full 5,000-card render -- the plan's row 8 pattern -- lives here in the
 * perf tier, which is meant to run on the larger reference machines that also
 * record perf baselines.
 *
 * It is a scaled clone of the BatchQueue budget test at
 * `src/renderer/__tests__/big-list-budget.test.tsx`, but mounts only the
 * `QueueJobCard` component (inside the @dnd-kit context it requires) so a
 * heap regression in the card itself -- the unit that scales with job count --
 * cannot hide behind page chrome.
 *
 * The suite self-skips on machines without ~8 GB of free memory (the reference
 * machines and CI boxes below that bar cannot run it; `ENCODEX_PERF_FORCE=1`
 * overrides the guard for big-iron baselining). A skipped run writes nothing,
 * so `perf-compare` treats the row as "no baseline yet" (a pass) until a
 * machine big enough records one. Results are written under the `phase8-queue`
 * phase so the card budget sits next to the scheduler budget in the same row
 * set and the shared perf gate.
 *
 * @see plans/ADVERSARIAL_TEST_HARDENING_PLAN.md, Phase 5.2 / Phase 8
 */

// @vitest-environment jsdom

import { describe, it, expect, afterAll, vi } from 'vitest';
import * as os from 'os';
import { render, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import QueueJobCard from '../src/renderer/components/QueueJobCard';
import { QUEUE_STATUS } from '../src/shared/media-options';
import type { QueueJob } from '../src/shared/types';
import { memorySnapshot, formatBytes, writeResults, logSummary } from './test-utils';
import type { PerfResult } from './test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const JOB_COUNT = Number(process.env.ENCODEX_PERF_JOB_CARDS) || 5_000;
const RENDER_BUDGET_MS = 180_000;
const HEAP_BUDGET = 6.5 * 1024 * 1024 * 1024;
const MIN_FREE_MEM = 8 * 1024 * 1024 * 1024;

const canRun = process.env.ENCODEX_PERF_FORCE === '1' || os.freemem() >= MIN_FREE_MEM;

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/**
 * A window.electronAPI stub good enough for the card's lazy preview path:
 * every async IPC method resolves to null (no preview), the `on*` subscriptions
 * return an unsubscribe function. Cards below the fold never call it anyway.
 */
const IPC_STUB = new Proxy(Object.create(null) as Record<string, unknown>, {
  get: (target, prop) => {
    if (typeof prop !== 'string') return undefined;
    if (!(prop in target)) {
      const isEvent = /^on[A-Z]/.test(prop);
      target[prop] = vi.fn(isEvent ? () => () => {} : async () => null);
    }
    return target[prop];
  },
});

function makeJobs(): QueueJob[] {
  return Array.from({ length: JOB_COUNT }, (_, i) => ({
    id: `job-${i}`,
    input: `C:/videos/input-${i}.mp4`,
    output: `C:/out/input-${i}_encodex.mp4`,
    options: {},
    transcoder: 'FFMPEG',
    status: QUEUE_STATUS.QUEUED,
    progress: 0,
    createdAt: i,
  }));
}

describe('Phase 8 job-card render: full 5,000-job card render', () => {
  const results: PerfResult[] = [];
  const skipped = !canRun;
  const jobs = makeJobs();

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis, 'electronAPI', { value: IPC_STUB, writable: true });

  afterAll(() => {
    if (results.length === 0) {
      console.warn(
        `  [SKIP] ${JOB_COUNT}-card render requires ${formatBytes(MIN_FREE_MEM)} free RAM ` +
          `(have ${formatBytes(os.freemem())}); run on a reference machine or set ENCODEX_PERF_FORCE=1.`,
      );
      return;
    }
    const filePath = writeResults('phase8-queue', results);
    logSummary(results);
    console.log(`Results written to: ${filePath}`);
  });

  it(`renders ${JOB_COUNT.toLocaleString('en-US')} MUI job cards within budget and bounded heap`, { skip: skipped }, () => {
    const before = memorySnapshot();
    const started = performance.now();
    render(
      <DndContext>
        <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.map((job) => (
            <QueueJobCard key={job.id} job={job} onRemove={() => {}} />
          ))}
        </SortableContext>
      </DndContext>,
    );
    const renderMs = performance.now() - started;
    const mounted = document.querySelectorAll('[data-testid^="queue-job-card-"]').length;

    const after = memorySnapshot();
    const heapDelta = after.heapUsed - before.heapUsed;

    expect(mounted, 'every job must mount a card').toBe(JOB_COUNT);
    expect(renderMs, `${JOB_COUNT.toLocaleString('en-US')} cards must render within budget`).toBeLessThan(RENDER_BUDGET_MS);
    expect(heapDelta, 'jsdom heap must stay under the plan bound').toBeLessThan(HEAP_BUDGET);

    console.log(
      `  ${JOB_COUNT.toLocaleString('en-US')} MUI job cards: render ${renderMs.toFixed(0)}ms, ` + `heap ${formatBytes(heapDelta)}`,
    );

    results.push({
      test: `Phase 8 renderer: ${JOB_COUNT.toLocaleString('en-US')} MUI job cards with bounded memory`,
      phase: 'phase8-queue',
      durationMs: renderMs,
      memoryBefore: { rss: before.rss, heapUsed: before.heapUsed },
      memoryAfter: { rss: after.rss, heapUsed: after.heapUsed },
      memoryDeltaRss: after.rss - before.rss,
      memoryDeltaHeap: heapDelta,
      passed: mounted === JOB_COUNT && renderMs < RENDER_BUDGET_MS && heapDelta < HEAP_BUDGET,
      details: { jobCount: JOB_COUNT, mounted, heapDelta },
      timestamp: new Date().toISOString(),
    });

    cleanup();
  });
});
