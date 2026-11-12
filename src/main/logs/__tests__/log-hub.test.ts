import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogHub } from '../log-hub';
import { LOG_MAX_ENTRIES } from '../../../shared/constants';
import type { LogEntry } from '../../../shared/types';

function entry(text: string, source: 'main' | 'renderer' = 'main'): LogEntry {
  return { timestamp: '2026-01-01T00:00:00.000Z', level: 'INFO', text, source };
}

function subscriber(id: number) {
  const send = vi.fn();
  return { id, webContentsId: id, send, isDestroyed: () => false };
}

describe('LogHub', () => {
  let hub: LogHub;

  beforeEach(() => {
    hub = new LogHub();
  });

  it('stamps every published entry with a monotonic sequence number', () => {
    const first = hub.publish(entry('one'));
    const second = hub.publish(entry('two'));
    expect(first.seq).toBe(1);
    expect(second.seq).toBe(2);
  });

  it('keeps the published history for a late subscriber', () => {
    hub.publish(entry('one'));
    hub.publish(entry('two'));
    expect(hub.snapshot().map((e) => e.text)).toEqual(['one', 'two']);
  });

  it('returns a copy of the history so a caller cannot corrupt it', () => {
    hub.publish(entry('one'));
    const snapshot = hub.snapshot();
    snapshot.push(entry('injected'));
    expect(hub.snapshot()).toHaveLength(1);
  });

  it('empties the history when cleared', () => {
    hub.publish(entry('one'));
    hub.publish(entry('two'));
    hub.clear();
    expect(hub.snapshot()).toEqual([]);
  });

  it('keeps sequence numbers advancing after a clear', () => {
    hub.publish(entry('before'));
    hub.clear();
    const after = hub.publish(entry('after'));
    expect(after.seq).toBe(2);
  });

  it('broadcasts an entry to every subscriber', () => {
    const a = subscriber(1);
    const b = subscriber(2);
    hub.subscribe(a);
    hub.subscribe(b);
    hub.publish(entry('hello'));
    expect(a.send).toHaveBeenCalledTimes(1);
    expect(b.send).toHaveBeenCalledTimes(1);
  });

  it('excludes the publishing window from the broadcast', () => {
    const origin = subscriber(1);
    const other = subscriber(2);
    hub.subscribe(origin);
    hub.subscribe(other);
    hub.publish(entry('hello'), 1);
    expect(origin.send).not.toHaveBeenCalled();
    expect(other.send).toHaveBeenCalledTimes(1);
  });

  it('skips a destroyed subscriber', () => {
    const gone = { id: 1, webContentsId: 1, send: vi.fn(), isDestroyed: () => true };
    hub.subscribe(gone);
    hub.publish(entry('hello'));
    expect(gone.send).not.toHaveBeenCalled();
  });

  it('removes a subscriber on unsubscribe', () => {
    const sub = subscriber(1);
    const id = hub.subscribe(sub);
    hub.unsubscribe(id);
    hub.publish(entry('hello'));
    expect(sub.send).not.toHaveBeenCalled();
    expect(hub.subscriberCount()).toBe(0);
  });

  it('gives every subscription its own identity', () => {
    const first = hub.subscribe({ webContentsId: undefined, isDestroyed: () => false, send: vi.fn() });
    const second = hub.subscribe({ webContentsId: undefined, isDestroyed: () => false, send: vi.fn() });
    expect(first).not.toBe(second);
    expect(hub.subscriberCount()).toBe(2);
  });

  it('trims the history to the shared entry cap', () => {
    for (let i = 0; i < LOG_MAX_ENTRIES + 10; i += 1) {
      hub.publish(entry(`entry-${i}`));
    }
    const history = hub.snapshot();
    expect(history).toHaveLength(LOG_MAX_ENTRIES);
    expect(history[history.length - 1].text).toBe(`entry-${LOG_MAX_ENTRIES + 9}`);
  });
});
