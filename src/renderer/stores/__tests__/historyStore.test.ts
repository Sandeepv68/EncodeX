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

  it('deduplicates entries and keeps a selected id that still exists', async () => {
    vi.mocked(window.electronAPI.historyList).mockResolvedValue([makeEntry('a'), makeEntry('a'), makeEntry('b')]);
    useHistoryStore.setState({ selectedId: 'b' });

    await useHistoryStore.getState().load();

    expect(useHistoryStore.getState().entries.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(useHistoryStore.getState().selectedId).toBe('b');
  });

  it('drops a selected id that is no longer present', async () => {
    vi.mocked(window.electronAPI.historyList).mockResolvedValue([makeEntry('a')]);
    useHistoryStore.setState({ selectedId: 'gone' });

    await useHistoryStore.getState().load();

    expect(useHistoryStore.getState().selectedId).toBeNull();
  });

  it('reports a non-Error load failure as a string', async () => {
    vi.mocked(window.electronAPI.historyList).mockRejectedValue('list failed');

    await useHistoryStore.getState().load();

    expect(useHistoryStore.getState().loadState).toBe('error');
    expect(useHistoryStore.getState().error).toBe('list failed');
  });

  it('ignores a stale load response', async () => {
    let resolveFirst: ((entries: HistoryEntry[]) => void) | undefined;
    const first = new Promise<HistoryEntry[]>((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(window.electronAPI.historyList)
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce([]);

    const pending = useHistoryStore.getState().load();
    await useHistoryStore.getState().load();
    resolveFirst!([makeEntry('stale')]);
    await pending;

    expect(useHistoryStore.getState().entries).toEqual([]);
  });

  it('reports clear and remove bridge failures', async () => {
    vi.mocked(window.electronAPI.historyClear).mockRejectedValue('clear failed');
    vi.mocked(window.electronAPI.historyRemove).mockRejectedValue(new Error('remove failed'));
    useHistoryStore.setState({ entries: [makeEntry('a')], loadState: 'ready' });

    await useHistoryStore.getState().clear();
    expect(useHistoryStore.getState().error).toBe('clear failed');

    useHistoryStore.setState({ entries: [makeEntry('a')], error: null, loadState: 'ready' });
    await useHistoryStore.getState().remove('a');
    expect(useHistoryStore.getState().entries).toEqual([makeEntry('a')]);
    expect(useHistoryStore.getState().error).toBe('remove failed');
  });

  it('skips thumbnail loading when the value is cached or absent', async () => {
    const cached = 'data:image/png;base64,YWJj';
    useHistoryStore.setState({ thumbnails: { a: cached } });
    vi.mocked(window.electronAPI.historyGetThumbnail).mockClear();

    await useHistoryStore.getState().loadThumbnail(makeEntry('a', { thumbnail: { path: '/tmp/a.png', mimeType: 'image/png' } }));
    await useHistoryStore.getState().loadThumbnail(makeEntry('b', { thumbnail: null }));

    expect(window.electronAPI.historyGetThumbnail).not.toHaveBeenCalled();
    expect(useHistoryStore.getState().thumbnails.b).toBeNull();
  });

  it('falls back to null when the thumbnail bridge is missing or rejects', async () => {
    const api = window.electronAPI as unknown as { historyGetThumbnail?: (id: string) => Promise<string | null> };
    const original = api.historyGetThumbnail;
    const entry = makeEntry('a', { thumbnail: { path: '/tmp/a.png', mimeType: 'image/png' } });

    api.historyGetThumbnail = undefined;
    await useHistoryStore.getState().loadThumbnail(entry);
    expect(useHistoryStore.getState().thumbnails.a).toBeNull();

    api.historyGetThumbnail = original;
    vi.mocked(window.electronAPI.historyGetThumbnail).mockRejectedValue('thumbnail failed');
    await useHistoryStore.getState().loadThumbnail(entry);
    expect(useHistoryStore.getState().thumbnails.a).toBeNull();
  });

  it('falls back to null when the thumbnail bridge throws synchronously', async () => {
    const api = window.electronAPI as unknown as { historyGetThumbnail?: (id: string) => Promise<string | null> };
    const original = api.historyGetThumbnail;
    const entry = makeEntry('a', { thumbnail: { path: '/tmp/a.png', mimeType: 'image/png' } });

    try {
      api.historyGetThumbnail = () => {
        throw new Error('sync thumbnail failure');
      };
      await useHistoryStore.getState().loadThumbnail(entry);
      expect(useHistoryStore.getState().thumbnails.a).toBeNull();
    } finally {
      api.historyGetThumbnail = original;
    }
  });
});
