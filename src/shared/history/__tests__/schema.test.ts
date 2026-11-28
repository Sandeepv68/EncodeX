import { describe, expect, it } from 'vitest';
import { HISTORY_LIMITS } from '../limits';
import { parseHistoryContext, parseHistoryEntry, parseHistoryStoreJson } from '../schema';
import type { HistoryEntry } from '../types';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'entry-1',
    family: 'convert',
    source: 'gui',
    status: 'succeeded',
    startedAt: 1000,
    finishedAt: 2000,
    durationMs: 1000,
    inputs: ['/input/video.mp4'],
    outputs: ['/output/video.mp4'],
    metadata: {},
    ...overrides,
  };
}

describe('history schema', () => {
  it('parses a valid entry unchanged', () => {
    const entry = makeEntry({ metadata: { codec: 'libx264', quality: 20, copy: true } });
    expect(parseHistoryEntry(entry)).toEqual(entry);
  });

  it('rejects invalid families, durations, and unbounded metadata', () => {
    expect(parseHistoryEntry(makeEntry({ family: 'unknown' as unknown as HistoryEntry['family'] }))).toBeNull();
    expect(parseHistoryEntry(makeEntry({ durationMs: 999 }))).toBeNull();
    expect(parseHistoryEntry(makeEntry({ metadata: { key: 'x'.repeat(HISTORY_LIMITS.maxMetadataValueLength + 1) } }))).toBeNull();
  });

  it('drops invalid entries while reading a store snapshot', () => {
    const valid = makeEntry();
    const invalid = makeEntry({ id: 'bad', durationMs: -1 });
    const raw = JSON.stringify({ version: 1, entries: [valid, invalid] });
    expect(parseHistoryStoreJson(raw)).toEqual({ version: 1, entries: [valid] });
    expect(parseHistoryStoreJson('{')).toEqual({ version: 1, entries: [] });
    expect(parseHistoryStoreJson('[]')).toEqual({ version: 1, entries: [] });
  });

  it('parses a bounded conversion context and rejects unknown families', () => {
    expect(parseHistoryContext({ family: 'audio-extract', source: 'gui', metadata: { codec: 'mp3' } })).toEqual({
      family: 'audio-extract',
      source: 'gui',
      metadata: { codec: 'mp3' },
    });
    expect(parseHistoryContext({ family: 'batch', source: 'gui' })).toBeNull();
  });
});
