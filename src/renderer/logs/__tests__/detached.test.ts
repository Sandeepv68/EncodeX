import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLogStore } from '../../stores/logStore';
import type { LogEntry } from '../../../shared/types';

/**
 * Builds a log entry with a hub sequence number.
 * @param text - The entry text.
 * @param seq - The hub sequence number.
 * @returns {LogEntry} The entry.
 */
function makeEntry(text: string, seq: number): LogEntry {
  return { timestamp: '2026-01-01T00:00:00.000Z', level: 'INFO', source: 'main', text, seq };
}

describe('detached log bridge', () => {
  beforeEach(() => {
    useLogStore.setState({ entries: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mirrors a console entry to the main process in one batch', async () => {
    const publish = vi.fn();
    window.electronAPI.logsPublishEntries = publish;
    const { mirrorLogEntry } = await import('../detached');
    mirrorLogEntry(makeEntry('one', 1));
    mirrorLogEntry(makeEntry('two', 2));
    expect(publish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toHaveLength(2);
  });

  it('does not mirror anything from the detached window itself', async () => {
    const publish = vi.fn();
    window.electronAPI.logsPublishEntries = publish;
    window.history.replaceState({}, '', '/?detached=1');
    const { isDetachedMode, mirrorLogEntry } = await import('../detached');
    expect(isDetachedMode()).toBe(true);
    mirrorLogEntry(makeEntry('own noise', 1));
    vi.advanceTimersByTime(500);
    expect(publish).not.toHaveBeenCalled();
    window.history.replaceState({}, '', '/');
  });

  it('seeds the detached store from the history and merges the live stream', async () => {
    let live: ((entry: LogEntry) => void) | undefined;
    window.electronAPI.onLogMessage = vi.fn((cb: (entry: LogEntry) => void) => {
      live = cb;
      return () => {};
    });
    window.electronAPI.logsGetHistory = vi.fn().mockResolvedValue([makeEntry('history', 1)]);
    const { subscribeDetachedLogFeed } = await import('../detached');
    const stop = subscribeDetachedLogFeed();
    await vi.waitFor(() => expect(useLogStore.getState().entries).toHaveLength(1));
    expect(useLogStore.getState().entries[0].text).toBe('history');
    live?.(makeEntry('live', 2));
    expect(useLogStore.getState().entries.map((e) => e.text)).toEqual(['history', 'live']);
    stop();
  });

  it('stores an entry that arrives through both the history and the live stream only once', async () => {
    let live: ((entry: LogEntry) => void) | undefined;
    window.electronAPI.onLogMessage = vi.fn((cb: (entry: LogEntry) => void) => {
      live = cb;
      return () => {};
    });
    window.electronAPI.logsGetHistory = vi.fn().mockResolvedValue([makeEntry('shared', 7)]);
    const { subscribeDetachedLogFeed } = await import('../detached');
    subscribeDetachedLogFeed();
    live?.(makeEntry('shared', 7));
    await vi.waitFor(() => expect(useLogStore.getState().entries).toHaveLength(1));
  });

  it('ignores a live entry that carries no sequence number', async () => {
    let live: ((entry: LogEntry) => void) | undefined;
    window.electronAPI.onLogMessage = vi.fn((cb: (entry: LogEntry) => void) => {
      live = cb;
      return () => {};
    });
    window.electronAPI.logsGetHistory = vi.fn().mockResolvedValue([]);
    const { subscribeDetachedLogFeed } = await import('../detached');
    subscribeDetachedLogFeed();
    live?.({ timestamp: '2026-01-01T00:00:00.000Z', level: 'INFO', source: 'main', text: 'no seq' });
    await vi.waitFor(() => expect(useLogStore.getState().entries).toHaveLength(0));
  });

  it('keeps working when the history request fails', async () => {
    let live: ((entry: LogEntry) => void) | undefined;
    window.electronAPI.onLogMessage = vi.fn((cb: (entry: LogEntry) => void) => {
      live = cb;
      return () => {};
    });
    window.electronAPI.logsGetHistory = vi.fn().mockRejectedValue(new Error('no history'));
    const { subscribeDetachedLogFeed } = await import('../detached');
    subscribeDetachedLogFeed();
    await vi.waitFor(() => expect(window.electronAPI.logsGetHistory).toHaveBeenCalled());
    live?.(makeEntry('live only', 3));
    await vi.waitFor(() => expect(useLogStore.getState().entries.map((e) => e.text)).toEqual(['live only']));
  });

  it('sorts the merged entries by their sequence number', async () => {
    let live: ((entry: LogEntry) => void) | undefined;
    window.electronAPI.onLogMessage = vi.fn((cb: (entry: LogEntry) => void) => {
      live = cb;
      return () => {};
    });
    window.electronAPI.logsGetHistory = vi.fn().mockResolvedValue([makeEntry('third', 3), makeEntry('first', 1)]);
    const { subscribeDetachedLogFeed } = await import('../detached');
    subscribeDetachedLogFeed();
    await vi.waitFor(() => expect(useLogStore.getState().entries).toHaveLength(2));
    expect(useLogStore.getState().entries.map((e) => e.text)).toEqual(['first', 'third']);
    live?.(makeEntry('second', 2));
    await vi.waitFor(() => expect(useLogStore.getState().entries.map((e) => e.text)).toEqual(['first', 'second', 'third']));
  });

  it('reports no detached mode when there is no window', async () => {
    const { isDetachedMode } = await import('../detached');
    const original = globalThis.window;
    // @ts-expect-error - the branch under test is the absence of a window.
    delete globalThis.window;
    try {
      expect(isDetachedMode()).toBe(false);
    } finally {
      globalThis.window = original;
    }
  });
});
