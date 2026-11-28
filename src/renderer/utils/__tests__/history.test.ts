import { describe, expect, it } from 'vitest';
import {
  filterHistoryEntries,
  formatHistoryDuration,
  historyBaseName,
  historyFamilyLabelKey,
  historySearchText,
  historySortKeys,
  historySortLabelKey,
  historySourceLabelKey,
  historyStatusLabelKey,
  isHistoryDataUrl,
  isHistoryFamily,
  isHistorySortKey,
  isHistorySource,
  isHistoryStatus,
} from '../history';
import type { HistoryEntry } from '../../../shared/history/types';
import type { HistoryQuery } from '../../stores/types';

function makeEntry(id: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id,
    family: 'convert',
    source: 'gui',
    status: 'succeeded',
    startedAt: 1000,
    finishedAt: 2000,
    durationMs: 1000,
    inputs: [`/tmp/${id}.mp4`],
    outputs: [`/tmp/${id}.mkv`],
    metadata: {},
    ...overrides,
  };
}

function query(overrides: Partial<HistoryQuery> = {}): HistoryQuery {
  return { search: '', status: 'all', family: 'all', source: 'all', sort: 'newest', ...overrides };
}

describe('history helpers', () => {
  it('recognizes known families, sources, statuses and sort keys', () => {
    expect(isHistoryFamily('convert')).toBe(true);
    expect(isHistoryFamily('unknown')).toBe(false);
    expect(isHistorySource('mcp')).toBe(true);
    expect(isHistorySource('other')).toBe(false);
    expect(isHistoryStatus('failed')).toBe(true);
    expect(isHistoryStatus('pending')).toBe(false);
    expect(isHistorySortKey('oldest')).toBe(true);
    expect(isHistorySortKey('random')).toBe(false);
    expect(historySortKeys()).toEqual(['newest', 'oldest', 'longest', 'shortest', 'name']);
  });

  it('maps values to translation keys', () => {
    expect(historyFamilyLabelKey('audio-extract')).toBe('history.familyLabels.audioExtract');
    expect(historySourceLabelKey('mcp')).toBe('history.sourceLabels.mcp');
    expect(historyStatusLabelKey('succeeded')).toBe('history.statusLabels.succeeded');
    expect(historySortLabelKey('newest')).toBe('history.sortNewest');
  });

  it('extracts a base name from POSIX, Windows and empty paths', () => {
    expect(historyBaseName('/tmp/video.mp4')).toBe('video.mp4');
    expect(historyBaseName('C:\\media\\clip.mkv')).toBe('clip.mkv');
    expect(historyBaseName('')).toBe('');
    expect(historyBaseName('/tmp/')).toBe('/tmp/');
  });

  it('builds search text from fields, metadata and errors', () => {
    const entry = makeEntry('a', {
      jobId: 'job-1',
      runId: 'run-1',
      transcoder: 'ffmpeg',
      error: { code: 'E_FAIL', message: 'Broken', detail: 'Details' },
      metadata: { codec: 'h264' },
    });
    const text = historySearchText(entry);
    expect(text).toContain('job-1');
    expect(text).toContain('run-1');
    expect(text).toContain('ffmpeg');
    expect(text).toContain('e_fail');
    expect(text).toContain('broken');
    expect(text).toContain('details');
    expect(text).toContain('codec h264');
  });

  it('formats durations from milliseconds to minutes', () => {
    expect(formatHistoryDuration(250)).toBe('250 ms');
    expect(formatHistoryDuration(1500)).toBe('1.5 s');
    expect(formatHistoryDuration(90_000)).toBe('1 m 30 s');
  });

  it('recognizes only safe inline image data URLs', () => {
    expect(isHistoryDataUrl('data:image/png;base64,YWJj')).toBe(true);
    expect(isHistoryDataUrl('data:image/jpeg;base64,YWJj')).toBe(true);
    expect(isHistoryDataUrl('data:image/svg+xml;base64,YWJj')).toBe(false);
  });

  it('filters by status, family, source and search text', () => {
    const entries = [makeEntry('a'), makeEntry('b', { status: 'failed', family: 'batch', source: 'mcp', error: { message: 'boom' } })];
    expect(filterHistoryEntries(entries, query({ status: 'failed' })).map((entry) => entry.id)).toEqual(['b']);
    expect(filterHistoryEntries(entries, query({ family: 'batch' })).map((entry) => entry.id)).toEqual(['b']);
    expect(filterHistoryEntries(entries, query({ source: 'mcp' })).map((entry) => entry.id)).toEqual(['b']);
    expect(filterHistoryEntries(entries, query({ search: 'BOOM' })).map((entry) => entry.id)).toEqual(['b']);
    expect(filterHistoryEntries(entries, query())).toHaveLength(2);
  });

  it('sorts by every supported key', () => {
    const entries = [
      makeEntry('old-long', { startedAt: 100, finishedAt: 3100, durationMs: 3000, inputs: ['/tmp/z.mp4'] }),
      makeEntry('new-short', { startedAt: 200, finishedAt: 700, durationMs: 500, inputs: ['/tmp/a.mp4'] }),
    ];
    expect(filterHistoryEntries(entries, query({ sort: 'newest' })).map((entry) => entry.id)).toEqual(['new-short', 'old-long']);
    expect(filterHistoryEntries(entries, query({ sort: 'oldest' })).map((entry) => entry.id)).toEqual(['old-long', 'new-short']);
    expect(filterHistoryEntries(entries, query({ sort: 'longest' })).map((entry) => entry.id)).toEqual(['old-long', 'new-short']);
    expect(filterHistoryEntries(entries, query({ sort: 'shortest' })).map((entry) => entry.id)).toEqual(['new-short', 'old-long']);
    expect(filterHistoryEntries(entries, query({ sort: 'name' })).map((entry) => entry.id)).toEqual(['new-short', 'old-long']);
  });

  it('falls back to output paths and ids when sorting by name', () => {
    const entries = [
      makeEntry('only-id', { inputs: [], outputs: [] }),
      makeEntry('with-output', { inputs: [], outputs: ['/tmp/alpha.mkv'] }),
    ];
    expect(filterHistoryEntries(entries, query({ sort: 'name' })).map((entry) => entry.id)).toEqual(['with-output', 'only-id']);
  });
});
