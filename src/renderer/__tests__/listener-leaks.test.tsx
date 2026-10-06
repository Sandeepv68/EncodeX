/**
 * @fileoverview Phase 4.5 - listener, observer and timer leaks across mount/unmount.
 *
 * The plan's row calls this "the classic Electron memory leak": a component
 * registers a `window` or `document` listener in an effect and removes it on a
 * path that never runs, so the listener keeps a detached tree alive forever. In
 * a desktop app mounted for hours that is a slow leak; in the tests one leaked
 * listener per cycle compounds into a `waitFor` that eventually times out for no
 * visible reason.
 *
 * The method matters more than the count. Three properties make these
 * assertions trustworthy rather than lucky:
 *
 *  - **A warm-up cycle before the baseline.** Anything registered once and never
 *    released (a library's document-level focus trap, React's own delegated
 *    handlers) is not a leak and would fail the first comparison. The
 *    measurement is *growth per cycle*, which is what a leak actually is.
 *  - **Only `window` and `document` are counted.** React attaches handlers to
 *    the render container, and testing-library discards containers without
 *    calling `removeEventListener`; counting elements would assert a property of
 *    the harness rather than of the component.
 *  - **A control that must fail.** The timer cases assert behaviour (does a
 *    pending seek still issue IPC?) rather than only a timer count, and each one
 *    runs the identical steps *without* an unmount first to prove the assertion
 *    is capable of failing. jsdom also ships no `ResizeObserver`, so the
 *    observer's `typeof` guard is stubbed in - otherwise that assertion would be
 *    vacuous.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { createRef, type ReactNode, type RefObject } from 'react';
import { MemoryRouter } from 'react-router-dom';
import VideoTimeline from '../components/VideoTimeline';
import MediaPlayer from '../components/MediaPlayer';
import AppDrawer from '../components/AppDrawer';
import BatchQueue from '../pages/BatchQueue';
import { ColorModeProvider } from '../ColorModeContext';
import { useHotkeys } from '../hooks/useHotkeys';
import type { MediaPlayerHandle } from '../components/types';

const playerSeek = vi.mocked(window.electronAPI.playerSeek);
const getMediaInfo = vi.mocked(window.electronAPI.getMediaInfo);

/**
 * Widened signature for jsdom's own `window.addEventListener`/`removeEventListener`.
 * The `Window` interface types them as an overload list with no `| null`
 * parameter, so the originals are captured through this type and cast back on
 * restore.
 */
type WindowListenerFn = (
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | AddEventListenerOptions,
) => void;

/** Live `window`/`document` listeners, keyed `${target}:${type}`. */
interface ListenerProbe {
  counts(): Record<string, number>;
  restore(): void;
}

function installListenerProbe(): ListenerProbe {
  const live = new Map<string, Set<number>>();
  const ids = new WeakMap<object, number>();
  let nextId = 0;
  const idOf = (listener: object): number => {
    let id = ids.get(listener);
    if (id === undefined) {
      nextId += 1;
      id = nextId;
      ids.set(listener, id);
    }
    return id;
  };
  const labelOf = (target: unknown): string | null => {
    if (target === window) return 'window';
    if (target === document) return 'document';
    return null;
  };
  const record = (targetLabel: string, type: string, listener: object): void => {
    const key = `${targetLabel}:${type}`;
    let set = live.get(key);
    if (set === undefined) {
      set = new Set();
      live.set(key, set);
    }
    set.add(idOf(listener));
  };
  const forget = (targetLabel: string, type: string, listener: object): void => {
    const key = `${targetLabel}:${type}`;
    const set = live.get(key);
    if (set !== undefined) {
      set.delete(idOf(listener));
      if (set.size === 0) live.delete(key);
    }
  };

  const protoAdd = EventTarget.prototype.addEventListener;
  const protoRemove = EventTarget.prototype.removeEventListener;
  // jsdom installs `addEventListener` as an **own property of the window
  // object**, so patching `EventTarget.prototype` alone silently misses every
  // `window.addEventListener(...)` call - which is where all four components
  // under test register. The first version of this probe had exactly that hole:
  // it counted `document` listeners, reported a green run, and failed to catch
  // mutations that removed each component's `window` cleanup.
  // `window.addEventListener` types as an overload list that has no `| null`
  // parameter, so the originals are widened once here and cast back on restore.
  const windowAdd = window.addEventListener as unknown as WindowListenerFn;
  const windowRemove = window.removeEventListener as unknown as WindowListenerFn;

  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const label = labelOf(this);
    if (label !== null && listener !== null) record(label, type, listener);
    protoAdd.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    const label = labelOf(this);
    if (label !== null && listener !== null) forget(label, type, listener);
    protoRemove.call(this, type, listener, options);
  };

  window.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (listener !== null) record('window', type, listener);
    windowAdd.call(window, type, listener, options);
  } as typeof window.addEventListener;

  window.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (listener !== null) forget('window', type, listener);
    windowRemove.call(window, type, listener, options);
  } as typeof window.removeEventListener;

  return {
    counts() {
      return Object.fromEntries([...live].map(([key, set]) => [key, set.size]));
    },
    restore() {
      EventTarget.prototype.addEventListener = protoAdd;
      EventTarget.prototype.removeEventListener = protoRemove;
      window.addEventListener = windowAdd as unknown as typeof window.addEventListener;
      window.removeEventListener = windowRemove as unknown as typeof window.removeEventListener;
    },
  };
}

/** ResizeObserver instances created since install, with their disconnect state. */
interface ObserverProbe {
  /** Number of instances still connected. */
  connected(): number;
  restore(): void;
}

/**
 * Stubs the absent `ResizeObserver` and records whether `disconnect()` ran, so
 * the observer branch in `VideoTimeline` is reachable and assertable.
 * @returns {ObserverProbe} The probe and its `restore`.
 */
function installObserverProbe(): ObserverProbe {
  const state: { connected: boolean }[] = [];
  class StubResizeObserver {
    private readonly record: { connected: boolean };

    constructor() {
      this.record = { connected: true };
      state.push(this.record);
    }

    observe(): void {}

    unobserve(): void {}

    disconnect(): void {
      this.record.connected = false;
    }
  }
  const hadOwn = Object.prototype.hasOwnProperty.call(globalThis, 'ResizeObserver');
  const original = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = StubResizeObserver;
  return {
    connected: () => state.filter((entry) => entry.connected).length,
    restore() {
      if (hadOwn) (globalThis as { ResizeObserver?: unknown }).ResizeObserver = original;
      else delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    },
  };
}

let probe: ListenerProbe;
let observers: ObserverProbe;

beforeAll(() => {
  probe = installListenerProbe();
  observers = installObserverProbe();
});

afterAll(() => {
  observers.restore();
  probe.restore();
});

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
  getMediaInfo.mockResolvedValue({ file: '/v.mp4', format: 'mp4', size: 0, duration: 60, bitrate: '', streams: [] });
  vi.mocked(window.electronAPI.queueList).mockResolvedValue([]);
  vi.mocked(window.electronAPI.queueGetState).mockResolvedValue({ paused: false, concurrency: 1 });
  vi.mocked(window.electronAPI.onQueueProgress).mockReturnValue(vi.fn());
  vi.mocked(window.electronAPI.onQueueStatusChange).mockReturnValue(vi.fn());
  vi.mocked(window.electronAPI.onQueueMoved).mockReturnValue(vi.fn());
});

/**
 * Mounts `mount` `cycles` times and requires the live `window`/`document`
 * listener set and the connected ResizeObserver count to return to their
 * post-warm-up values.
 * @param {string} label - Failure message prefix.
 * @param {number} cycles - How many mount/unmount cycles to run.
 * @param {() => { unmount: () => void }} mount - Renders the component.
 * @param {(cycle: number) => void} [beforeUnmount] - Runs against each live instance.
 * @returns {void}
 */
function expectNoLeakAcross(
  label: string,
  cycles: number,
  mount: () => { unmount: () => void },
  beforeUnmount?: (cycle: number) => void,
): void {
  mount().unmount();

  const before = probe.counts();
  const connectedBefore = observers.connected();

  for (let i = 0; i < cycles; i += 1) {
    const result = mount();
    beforeUnmount?.(i);
    result.unmount();
  }

  expect(probe.counts(), `${label} leaked window/document listeners after ${cycles} cycles`).toEqual(before);
  expect(observers.connected(), `${label} leaked a connected ResizeObserver after ${cycles} cycles`).toBe(connectedBefore);
}

function timeline(): { unmount: () => void } {
  return render(
    <VideoTimeline duration={60} currentTime={10} start={5} end={50} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
  );
}

function HotkeyProbe(): ReactNode {
  useHotkeys([{ id: 'convert.start', handler: () => undefined }]);
  return null;
}

describe('VideoTimeline', () => {
  it('releases its window pointer, viewport scroll and ResizeObserver registrations across 100 mounts', () => {
    expectNoLeakAcross('VideoTimeline', 100, timeline, (cycle) => {
      // Arm the window-level pointer listeners the scrub handler installs, and
      // *assert they are armed*. Without this the cycle would exercise only the
      // idle path and a missing cleanup would go unnoticed - which is exactly
      // what happened on the first run of this test.
      const scroller = document.querySelector('[data-testid="timeline-scroller"]');
      expect(scroller, 'timeline scroller must render').not.toBeNull();
      fireEvent.pointerDown(scroller as Element, { clientX: 10, clientY: 5 });
      fireEvent.pointerMove(window, { clientX: 20, clientY: 5 });
      expect(
        probe.counts()['window:pointermove'],
        `cycle ${cycle}: scrubbing must arm exactly one window pointermove listener (counts=${JSON.stringify(probe.counts())})`,
      ).toBe(1);
      expect(probe.counts()['window:pointerup'], `cycle ${cycle}: scrubbing must arm the window pointerup listener`).toBe(1);
    });
  });
});

describe('useHotkeys', () => {
  it('releases its window keydown listener across 100 mounts', () => {
    expectNoLeakAcross('useHotkeys', 100, () => render(<HotkeyProbe />));
  });
});

describe('BatchQueue', () => {
  it('releases its window drag listeners across 100 mounts', () => {
    expectNoLeakAcross('BatchQueue', 100, () => render(<BatchQueue />));
  }, 180_000);
});

describe('AppDrawer', () => {
  function drawer(): { unmount: () => void } {
    return render(
      <MemoryRouter initialEntries={['/convert']}>
        <ColorModeProvider>
          <AppDrawer isMobile={false} condensed={false} onNavigate={vi.fn()} onToggleCondense={vi.fn()} />
        </ColorModeProvider>
      </MemoryRouter>,
    );
  }

  it('releases its window and document registrations across 100 mounts', () => {
    expectNoLeakAcross('AppDrawer', 100, drawer);
  });

  it('clears an armed popover close timer on unmount', () => {
    vi.useFakeTimers();
    try {
      const result = drawer();
      // Baseline is *while mounted*, not zero: `vi.getTimerCount()` picks up
      // bookkeeping timers that have nothing to do with the component, so an
      // absolute `=== 0` would be asserting an artefact of the harness.
      const mounted = vi.getTimerCount();
      const navItem = document.querySelector('[data-testid="nav-item-convert"]');
      expect(navItem, 'nav item must render for the popover path to be reachable').not.toBeNull();
      fireEvent.mouseLeave(navItem as Element);
      expect(vi.getTimerCount(), 'control: leaving a nav item arms the close timer').toBeGreaterThan(mounted);
      result.unmount();
      expect(vi.getTimerCount(), 'armed close timers must not survive unmount').toBe(mounted);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('MediaPlayer', () => {
  beforeEach(() => {
    // The canvas draw path runs on every frame; jsdom has no 2d context.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  function player(ref?: RefObject<MediaPlayerHandle | null>): { unmount: () => void } {
    return render(<MediaPlayer filePath="/v.mp4" ref={ref} />);
  }

  it('releases its window and document registrations across 20 mounts', async () => {
    await act(async () => {
      player().unmount();
    });
    const before = probe.counts();
    for (let i = 0; i < 20; i += 1) {
      const result = player();
      await act(async () => {
        await Promise.resolve();
      });
      result.unmount();
    }
    expect(probe.counts(), 'MediaPlayer leaked window/document listeners after 20 cycles').toEqual(before);
  });

  it('never lets a coalesced seek fire after unmount', async () => {
    vi.useFakeTimers();
    try {
      const controlRef = createRef<MediaPlayerHandle>();
      const control = player(controlRef);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      controlRef.current?.seekTo(5);
      expect(vi.getTimerCount(), 'control: seeking arms the coalescing timer').toBeGreaterThan(0);
      playerSeek.mockClear();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(playerSeek, 'control: a coalesced seek fires while mounted').toHaveBeenCalled();
      control.unmount();

      const doomedRef = createRef<MediaPlayerHandle>();
      const doomed = player(doomedRef);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      doomedRef.current?.seekTo(5);
      doomed.unmount();
      playerSeek.mockClear();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(playerSeek, 'a coalesced seek must not survive unmount').not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
