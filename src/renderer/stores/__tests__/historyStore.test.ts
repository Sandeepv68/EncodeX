import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHistoryStore } from '../historyStore';
import type { HistoryEntry } from '../../../shared/history/types';

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

describe('historyStore', () => {
  beforeEach(() => {
    useHistoryStore.getState().reset();
    vi.mocked(window.electronAPI.historyList).mockResolvedValue([]);
    vi.mocked(window.electronAPI.historyGetThumbnail).mockResolvedValue(null);
    vi.mocked(window.electronAPI.historyClear).mockResolvedValue(undefined);
    vi.mocked(window.electronAPI.historyRemove).mockResolvedValue(true);
  });

  it('loads validated entries from the bridge', async () => {
    vi.mocked(window.electronAPI.historyList).mockResolvedValue([makeEntry('a'), { id: 'bad' } as HistoryEntry]);

    await useHistoryStore.getState().load();

    expect(useHistoryStore.getState().entries).toEqual([makeEntry('a')]);
    expect(useHistoryStore.getState().loadState).toBe('ready');
  });

  it('falls back to an empty list when the bridge is absent', async () => {
    const api = window.electronAPI as { historyList?: () => Promise<HistoryEntry[]> };
    const original = api.historyList;
    api.historyList = undefined;
    try {
      await useHistoryStore.getState().load();
      expect(useHistoryStore.getState().entries).toEqual([]);
      expect(useHistoryStore.getState().loadState).toBe('ready');
    } finally {
      api.historyList = original;
    }
  });

  it('caches validated thumbnails', async () => {
    const data = `data:image/png;base64,${Buffer.from('ok').toString('base64')}`;
    vi.mocked(window.electronAPI.historyGetThumbnail).mockResolvedValue(data);
    const entry = makeEntry('a', { thumbnail: { path: '/tmp/a.png', mimeType: 'image/png' } });

    await useHistoryStore.getState().loadThumbnail(entry);

    expect(useHistoryStore.getState().thumbnails.a).toBe(data);
  });

  it('rejects invalid thumbnail payloads', async () => {
    vi.mocked(window.electronAPI.historyGetThumbnail).mockResolvedValue('javascript:alert(1)');
    const entry = makeEntry('a', { thumbnail: { path: '/tmp/a.png', mimeType: 'image/png' } });

    await useHistoryStore.getState().loadThumbnail(entry);

    expect(useHistoryStore.getState().thumbnails.a).toBeNull();
  });

  it('removes an entry and clears the selected id', async () => {
    useHistoryStore.setState({
      entries: [makeEntry('a'), makeEntry('b')],
      selectedId: 'a',
      loadState: 'ready',
    });

    await useHistoryStore.getState().remove('a');

    expect(useHistoryStore.getState().entries.map((entry) => entry.id)).toEqual(['b']);
    expect(useHistoryStore.getState().selectedId).toBeNull();
    expect(window.electronAPI.historyRemove).toHaveBeenCalledWith('a');
  });
});
