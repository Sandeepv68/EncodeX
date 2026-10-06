/**
 * @fileoverview Phase 4.6 - every page rendered under React 19 StrictMode.
 *
 * The app runs `<StrictMode>` in development (`src/renderer/main.tsx`), which
 * means StrictMode's mount -> unmount -> remount of every component and its
 * double-invocation of every render and effect body is what developers actually
 * work against - yet no test rendered a page inside it. Two classes of defect
 * therefore shipped untested:
 *
 *  - **Effects that assume they run once.** StrictMode runs the effect, its
 *    cleanup, and the effect again. An effect that registers an IPC listener
 *    without releasing it in the returned cleanup ends up with two live
 *    subscriptions, and one whose second run does not re-derive state left over
 *    from the first shows stale data.
 *  - **Render bodies with side effects.** Double-invoking a render that writes
 *    to a store, mutates `document`, or appends to a module-level accumulator
 *    produces double writes that a single render never exposes.
 *
 * The assertions are deliberately thin - "renders, produces nodes, unmounts"
 * - because the crash tripwire already converts any `console.error`, render
 * throw, or unhandled rejection into a failure. The value here is putting every
 * page through the StrictMode path at all.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StrictMode, type ComponentType } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ColorModeProvider } from '../../ColorModeContext';
import About from '../About';
import AudioExtract from '../AudioExtract';
import BatchQueue from '../BatchQueue';
import Convert from '../Convert';
import Dashboard from '../Dashboard';
import Demux from '../Demux';
import ImageCompress from '../ImageCompress';
import Logs from '../Logs';
import MediaInfo from '../MediaInfo';
import Remux from '../Remux';
import Settings from '../Settings';
import VideoCut from '../VideoCut';

const PAGES: [string, ComponentType][] = [
  ['About', About],
  ['AudioExtract', AudioExtract],
  ['BatchQueue', BatchQueue],
  ['Convert', Convert],
  ['Dashboard', Dashboard],
  ['Demux', Demux],
  ['ImageCompress', ImageCompress],
  ['Logs', Logs],
  ['MediaInfo', MediaInfo],
  ['Remux', Remux],
  ['Settings', Settings],
  ['VideoCut', VideoCut],
];

let originalScrollIntoView: PropertyDescriptor | undefined;

beforeAll(() => {
  // jsdom implements no `scrollIntoView`, so `Logs`'s follow-tail effect throws
  // the moment it runs. `Logs.test.tsx` stubs the same method at module scope,
  // so this is an established harness gap rather than an app defect - in a
  // shipped browser the method always exists.
  originalScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterAll(() => {
  if (originalScrollIntoView) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScrollIntoView);
  else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(window.electronAPI.queueList).mockResolvedValue([]);
  vi.mocked(window.electronAPI.queueGetState).mockResolvedValue({ paused: false, concurrency: 1 });
  vi.mocked(window.electronAPI.onQueueProgress).mockReturnValue(vi.fn());
  vi.mocked(window.electronAPI.onQueueStatusChange).mockReturnValue(vi.fn());
  vi.mocked(window.electronAPI.onQueueMoved).mockReturnValue(vi.fn());
});

describe.each(PAGES)('%s under StrictMode', (name, Page) => {
  it('mounts, double-invokes and unmounts without throwing', async () => {
    let container!: HTMLElement;
    expect(() => {
      ({ container } = render(
        <StrictMode>
          <MemoryRouter initialEntries={['/']}>
            <ColorModeProvider>
              <Page />
            </ColorModeProvider>
          </MemoryRouter>
        </StrictMode>,
      ));
    }, `${name} threw while mounting under StrictMode`).not.toThrow();

    // Non-vacuity: a page that rendered nothing at all would still satisfy
    // "did not throw".
    expect(container, `${name} rendered no DOM under StrictMode`).toBeTruthy();
    expect(container.childElementCount, `${name} rendered an empty container`).toBeGreaterThan(0);

    expect(() => cleanup(), `${name} threw while unmounting under StrictMode`).not.toThrow();
  });
});

describe('StrictMode effect double-invocation', () => {
  it('BatchQueue releases every IPC subscription it registers', () => {
    // StrictMode mounts, unmounts, then remounts: each `useEffect` body runs
    // twice and its cleanup runs between them. An effect that subscribes
    // without unsubscribing leaves two live listeners on the second pass and a
    // third after unmount - invisible in a normal render, which is exactly why
    // this is asserted here rather than in `BatchQueue.test.tsx`.
    const subscriptions = [
      ['onQueueProgress', vi.mocked(window.electronAPI.onQueueProgress)],
      ['onQueueStatusChange', vi.mocked(window.electronAPI.onQueueStatusChange)],
      ['onQueueMoved', vi.mocked(window.electronAPI.onQueueMoved)],
    ] as const;
    for (const [, mock] of subscriptions) mock.mockReturnValue(vi.fn());

    const { unmount } = render(
      <StrictMode>
        <MemoryRouter initialEntries={['/']}>
          <ColorModeProvider>
            <BatchQueue />
          </ColorModeProvider>
        </MemoryRouter>
      </StrictMode>,
    );
    unmount();

    for (const [name, mock] of subscriptions) {
      const registered = mock.mock.results.map((result) => result.value as ReturnType<typeof vi.fn>);
      expect(registered.length, `${name} never subscribed - the assertion would be vacuous`).toBeGreaterThan(0);
      const stillLive = registered.filter((dispose) => dispose?.mock.calls.length === 0);
      expect(stillLive, `${name} left ${stillLive.length} of ${registered.length} subscriptions live after unmount`).toEqual([]);
    }
  });
});
