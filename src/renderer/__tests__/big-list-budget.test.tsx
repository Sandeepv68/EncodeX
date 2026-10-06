import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPage, stubScrollIntoView } from '../../test-utils/page-render';
import { expectAppLog, expectCrash } from '../../test-utils/crash-tripwire';
import { useLogStore } from '../stores/logStore';
import { useQueueStore } from '../stores/queueStore';
import type { LogEntry, QueueJob } from '../../shared/types';

/**
 * Renderer stress budget for the two pathological list sizes the renderer can
 * legally reach without virtualization: every queued job (BatchQueue) and the
 * complete captured log (Logs). Both pages render eagerly, so the budgets scale
 * linearly and the thresholds below keep regressions from hiding behind a DOM
 * that is merely slow.
 *
 * This suite owns most of the process heap (50,000 rows / 3,000 MUI cards), so
 * it runs in its own config (`vitest.big-lists.config.ts`) with a dedicated
 * worker rather than sharing a fork with the unit tier.
 *
 * The full 5,000-job scale (plans row 5.2) needs a ~6 GB heap: jsdom + MUI
 * css-in-js for 5,000 cards exceeds the memory GitHub's ubuntu runners provide
 * (7 GB total), so the CI gate renders 3,000 cards at ~11-18 ms/card. The
 * 5,000-card render itself is prescribed to the perf tier (row 8 pattern).
 */
const LOG_COUNT = 50_000;
const JOB_COUNT = 3_000;

function makeLogEntries(): LogEntry[] {
  return Array.from({ length: LOG_COUNT }, (_, i) => ({
    timestamp: '2026-07-31T10:00:00.000Z',
    level: i % 2 === 0 ? 'INFO' : 'DEBUG',
    text: `log line ${i}`,
    source: i % 2 === 0 ? 'main' : 'renderer',
  }));
}

function makeJobs(): QueueJob[] {
  return Array.from({ length: JOB_COUNT }, (_, i) => ({
    id: `job-${i}`,
    input: `/in/file-${i}.mp4`,
    output: `/out/file-${i}_encodex.mp4`,
    options: {},
    status: 'queued',
    progress: 0,
    createdAt: i,
    transcoder: 'FFMPEG',
  }));
}

beforeEach(() => {
  useLogStore.setState({ entries: [] });
  useQueueStore.setState({ jobs: [], progress: {} });
});

describe('5.2 missing-degradation (large-list render budgets)', () => {
  it(`renders ${LOG_COUNT.toLocaleString('en-US')} log entries within budget without erroring`, () => {
    useLogStore.setState({ entries: makeLogEntries() });
    stubScrollIntoView();
    const started = performance.now();
    const { getByTestId, unmount } = renderPage('Logs');
    const elapsed = performance.now() - started;
    expect(getByTestId('logs-body').children.length, 'every row plus the tail anchor must render').toBe(LOG_COUNT + 1);
    expect(screen.getByText('logs.entryCount')).toBeInTheDocument();
    expect(elapsed, `${LOG_COUNT.toLocaleString('en-US')} rows must render within budget`).toBeLessThan(12_000);
    unmount();
  });

  it(`renders ${JOB_COUNT.toLocaleString('en-US')} queued jobs within budget and stays responsive to a collapse toggle`, async () => {
    // The MUI Collapse on the condense toggle settles on a timer outside
    // `act`; declare the same carve-out the axe/shell suites use.
    expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);
    expectCrash('consoleError', /not wrapped in act/);

    const jobs = makeJobs();
    vi.mocked(window.electronAPI.queueList).mockResolvedValue(jobs);
    useQueueStore.setState({ jobs, progress: {} });
    const started = performance.now();
    renderPage('BatchQueue');
    await waitFor(() => expect(document.querySelectorAll('[data-testid^="queue-job-card-"]').length).toBe(JOB_COUNT), { timeout: 165_000 });
    const elapsed = performance.now() - started;
    expect(elapsed, `${JOB_COUNT.toLocaleString('en-US')} job cards must render within budget`).toBeLessThan(120_000);
    const condense = screen.getByTestId('batch-queue-condense');
    expect(condense).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(condense);
    expect(condense).toHaveAttribute('aria-expanded', 'false');
  }, 180_000);
});
