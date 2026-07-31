import { describe, it, expect, beforeEach } from 'vitest';
import { useLogStore } from '../logStore';
import type { LogEntry } from '../../../shared/types';

function makeEntry(text: string): LogEntry {
  return { timestamp: '2026-01-01T00:00:00.000Z', level: 'INFO', source: 'renderer', text };
}

describe('logStore', () => {
  beforeEach(() => {
    useLogStore.setState({ entries: [] });
  });

  it('starts with empty entries', () => {
    expect(useLogStore.getState().entries).toEqual([]);
  });

  it('addEntry appends entries in order', () => {
    useLogStore.getState().addEntry(makeEntry('first'));
    useLogStore.getState().addEntry(makeEntry('second'));
    expect(useLogStore.getState().entries.map((e) => e.text)).toEqual(['first', 'second']);
  });

  it('caps entries at MAX_ENTRIES (2000)', () => {
    for (let i = 0; i < 2100; i += 1) {
      useLogStore.getState().addEntry(makeEntry(`entry-${i}`));
    }
    const entries = useLogStore.getState().entries;
    expect(entries).toHaveLength(2000);
    expect(entries[0].text).toBe('entry-100');
    expect(entries[1999].text).toBe('entry-2099');
  });

  it('clear empties the log', () => {
    useLogStore.getState().addEntry(makeEntry('x'));
    useLogStore.getState().clear();
    expect(useLogStore.getState().entries).toEqual([]);
  });
});
