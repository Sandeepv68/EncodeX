/**
 * @fileoverview Phase 8 DoS row: 1,000 rapid route changes during a running
 * conversion must not leak listeners, crash, or corrupt queue state.
 *
 * This is the dedicated harness the plan listed as "partly covered" by the
 * strict-mode + listener-leaks suites: it mounts the real App shell once and
 * drives 1,000 react-router navigations across all 12 routes while a conversion
 * is RUNNING, then proves the shell is unchanged in the ways a missed effect
 * cleanup would corrupt:
 *
 *   - no window/document listener growth (a page whose cleanup path never runs
 *     leaks one listener per visit - the same failure mode `listener-leaks`
 *     asserts per component, here across *route transitions* of the whole app);
 *   - no page error captured by the error store, and no crash under the strict
 *     crash tripwire;
 *   - the seeded RUNNING job is untouched by navigation (no state corruption);
 *   - the router is still honouring navigations at the end (the harness
 *     verifies it at checkpoints, so a "router gave up early" cannot pass).
 *
 * A warm-up pass visits every route once before the listener baseline is
 * snapshotted, so one-time registrations (React's own delegated handlers, the
 * shell's hotkey listener) are not misread as per-navigation growth.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom';
import App from '../App';
import { useQueueStore } from '../stores/queueStore';
import { useErrorStore } from '../stores/errorStore';
import { stubScrollIntoView } from '../../test-utils/page-render';
import { installListenerProbe } from '../../test-utils/listener-probe';
import type { ListenerProbe } from '../../test-utils/listener-probe';
import type { QueueJob } from '../../shared/types';

const ROUTES = [
  '/',
  '/convert',
  '/media-info',
  '/image-compress',
  '/audio-extract',
  '/video-cut',
  '/remux',
  '/demux',
  '/batch',
  '/logs',
  '/settings',
  '/about',
];

const NAVIGATION_COUNT = 1_000;
const CHECKPOINTS = new Set([250, 500, 750, NAVIGATION_COUNT]);

/** Deterministic PRNG so the navigation sequence is identical on every run. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exposes the live router `navigate` and `location` to the harness. */
interface RouterHandles {
  navigate: React.Dispatch<React.SetStateAction<string>>;
  location: React.MutableRefObject<string>;
}

function RouterProbe({ setHandles }: { setHandles: (handles: RouterHandles) => void }): ReactNode {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;
  useEffect(() => {
    setHandles({ navigate: navigate as unknown as React.Dispatch<React.SetStateAction<string>>, location: locationRef });
  }, [navigate, setHandles]);
  return null;
}

function flushedAct(fn: () => void): Promise<void> {
  return act(async () => {
    fn();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

let probe: ListenerProbe;

beforeAll(() => {
  probe = installListenerProbe();
});

afterAll(() => {
  probe.restore();
});

describe('Phase 8: 1,000 rapid route changes during a running conversion', () => {
  it('leaves listeners, error store, and the running job unchanged', async () => {
    const handles: { current?: RouterHandles } = {};
    const runningJob: QueueJob = {
      id: 'conv-running',
      input: '/in/running.mp4',
      output: '/out/running_encodex.mp4',
      options: {},
      status: 'running',
      progress: 35,
      createdAt: Date.now(),
      transcoder: 'FFMPEG',
    };
    useQueueStore.setState({
      jobs: [runningJob],
      progress: {
        [runningJob.id]: { percent: 35, time: '00:00:42', fps: 0, speed: '0.0x', eta: '00:01:10', bitrate: '0k' },
      },
    });
    // The BatchQueue page re-syncs the mirror from `queueList()` on every mount,
    // so the main-process queue must report the same running job or the seeded
    // conversion is legitimately wiped by the very navigation under test.
    vi.mocked(window.electronAPI.queueList).mockResolvedValue([runningJob]);
    vi.mocked(window.electronAPI.queueGetState).mockResolvedValue({ paused: false, concurrency: 4 });
    // jsdom has no layout: `Logs`'s follow-tail effect calls `scrollIntoView`
    // the moment it renders. Same harness fact `page-render` handles.
    stubScrollIntoView();

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
        <RouterProbe
          setHandles={(value) => {
            handles.current = value;
          }}
        />
      </MemoryRouter>,
    );
    expect(handles.current, 'router probe must be wired').toBeDefined();

    // Warm-up: visit every route once so one-time registrations settle before
    // the baseline is snapshotted (the "warm-up cycle" principle of the
    // listener-leaks suite).
    for (const route of ROUTES) {
      await flushedAct(() => handles.current!.navigate(route));
    }

    const before = probe.counts();
    const beforeStatus = useQueueStore.getState().jobs[0].status;

    const random = mulberry32(0x8a11);
    let lastPath = handles.current!.location.current;
    let navigations = 0;
    for (let i = 1; i <= NAVIGATION_COUNT; i += 1) {
      const next = ROUTES[Math.floor(random() * ROUTES.length)];
      await flushedAct(() => handles.current!.navigate(next));
      lastPath = next;
      navigations += 1;
      if (CHECKPOINTS.has(i)) {
        expect(handles.current!.location.current, `router must have switched to the ${i}-th navigation`).toBe(next);
      }
    }

    expect(navigations).toBe(NAVIGATION_COUNT);
    expect(handles.current!.location.current, 'router ends on the final navigation').toBe(lastPath);
    expect(useErrorStore.getState().currentError, 'no page may surface an error under rapid navigation').toBeNull();

    // Per-route listeners are transient by design (each page arms its own
    // `useHotkeys` binding and some pages add drop/select handlers), so the
    // growth check must compare the same route at both ends of the walk, not
    // whatever route the PRNG happened to land on last.
    await flushedAct(() => handles.current!.navigate(ROUTES[ROUTES.length - 1]));
    const after = probe.counts();
    expect(after, 'window/document listener set must not grow across 1,000 route changes').toEqual(before);

    const afterJob = useQueueStore.getState().jobs[0];
    expect(afterJob.status, 'a running conversion must survive navigation untouched').toBe(beforeStatus);
    expect(useQueueStore.getState().progress[runningJob.id].percent).toBe(35);

    // The shell is still alive and interactive: the final route actually
    // rendered its content (the app layout provides no `main` landmark).
    expect(screen.getByText('about.title')).toBeInTheDocument();
  }, 240_000);
});
