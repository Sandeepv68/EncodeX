import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPage, stubScrollIntoView } from '../../test-utils/page-render';
import { expectAppLog, expectCrash } from '../../test-utils/crash-tripwire';
import { useLogStore } from '../stores/logStore';
import { useQueueStore } from '../stores/queueStore';
import { LOG_ROW_HEIGHT } from '../pages/Logs';
import type { LogEntry, QueueJob } from '../../shared/types';

/**
 * Renderer stress budget for the two pathological list sizes the renderer can
 * reach: every queued job (BatchQueue) and the complete captured log (Logs).
 *
 * BatchQueue pages render eagerly, so its budget scales linearly and the
 * threshold keeps regressions from hiding behind a DOM that is merely slow.
 * Logs is windowed (known follow-up 4, close 2026-10-07): only the configured
 * viewport slice is mounted, so the budget here proves the window stays
 * bounded at the 50,000-row scale AND that scrolling reaches the tail.
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

/** The largest mounted slice the window may legally reach (viewport + 2x overscan). */
const MAX_LOG_WINDOW = 60;

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
  it(`windows ${LOG_COUNT.toLocaleString('en-US')} log entries: only the viewport slice mounts and scrolling reaches the tail`, () => {
    useLogStore.setState({ entries: makeLogEntries() });
    stubScrollIntoView();
    const started = performance.now();
    const { getByTestId, unmount } = renderPage('Logs');
    const elapsed = performance.now() - started;

    const rows = () => document.querySelectorAll('[data-testid="log-entry-row"]');
    // The windowed slice must be nowhere near the 50,000 backing rows.
    expect(rows().length, 'only the windowed slice may be mounted').toBeLessThanOrEqual(MAX_LOG_WINDOW);
    // The top of the list is reachable first.
    expect(screen.getByText(/log line 0/)).toBeInTheDocument();

    // Scrolling to the last estimated row moves the window to the tail.
    act(() => {
      getByTestId('logs-body').scrollTop = (LOG_COUNT - 1) * LOG_ROW_HEIGHT;
      fireEvent.scroll(getByTestId('logs-body'));
    });
    expect(screen.getByText(/log line 49999/)).toBeInTheDocument();
    expect(rows().length, 'window stays bounded while scrolled').toBeLessThanOrEqual(MAX_LOG_WINDOW);

    expect(screen.getByText('logs.entryCount')).toBeInTheDocument();
    expect(elapsed, `${LOG_COUNT.toLocaleString('en-US')} rows must stay windowed and render within budget`).toBeLessThan(12_000);
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
