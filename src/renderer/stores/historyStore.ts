import { create } from 'zustand';
import { parseHistoryEntry } from '../../shared/history/schema';
import type { HistoryEntry } from '../../shared/history/types';
import { bridgePromise, withBridgeTimeout } from '../utils/bridge-call';
import { isHistoryDataUrl } from '../utils/history';
import type { HistoryQuery, HistoryState } from './types';

const HISTORY_BRIDGE_TIMEOUT_MS = 5000;

const initialQuery: HistoryQuery = {
  search: '',
  status: 'all',
  family: 'all',
  source: 'all',
  sort: 'newest',
};

let requestSequence = 0;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function dedupeEntries(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  loadState: 'idle',
  error: null,
  query: { ...initialQuery },
  selectedId: null,
  thumbnails: {},

  load: async () => {
    const request = ++requestSequence;
    set({ loadState: 'loading', error: null });
    const api = window.electronAPI;
    if (!api?.historyList) {
      set({ entries: [], loadState: 'ready', selectedId: null, thumbnails: {} });
      return;
    }
    try {
      const raw = await withBridgeTimeout(
        bridgePromise(() => api.historyList!()),
        HISTORY_BRIDGE_TIMEOUT_MS,
        [],
      );
      if (request !== requestSequence) return;
      const entries = dedupeEntries(
        (Array.isArray(raw) ? raw : []).map(parseHistoryEntry).filter((entry): entry is HistoryEntry => !!entry),
      );
      const selectedId = get().selectedId;
      set({
        entries,
        loadState: 'ready',
        selectedId: selectedId && entries.some((entry) => entry.id === selectedId) ? selectedId : null,
        thumbnails: {},
      });
    } catch (error) {
      if (request !== requestSequence) return;
      set({ entries: [], loadState: 'error', error: describeError(error), selectedId: null, thumbnails: {} });
    }
  },

  refresh: async () => {
    await get().load();
  },

  clear: async () => {
    requestSequence += 1;
    set({ entries: [], selectedId: null, thumbnails: {}, loadState: 'ready', error: null });
    const api = window.electronAPI;
    if (!api?.historyClear) return;
    try {
      await withBridgeTimeout(
        bridgePromise(() => api.historyClear!()),
        HISTORY_BRIDGE_TIMEOUT_MS,
        undefined,
      );
    } catch (error) {
      set({ error: describeError(error) });
    }
  },

  remove: async (id: string) => {
    const previous = get().entries;
    const remaining = previous.filter((entry) => entry.id !== id);
    const thumbnails = { ...get().thumbnails };
    delete thumbnails[id];
    requestSequence += 1;
    set({
      entries: remaining,
      thumbnails,
      selectedId: get().selectedId === id ? null : get().selectedId,
      loadState: 'ready',
      error: null,
    });
    const api = window.electronAPI;
    if (!api?.historyRemove) return;
    try {
      await withBridgeTimeout(
        bridgePromise(() => api.historyRemove!(id)),
        HISTORY_BRIDGE_TIMEOUT_MS,
        false,
      );
    } catch (error) {
      set({ entries: previous, error: describeError(error) });
    }
  },

  loadThumbnail: async (entry: HistoryEntry) => {
    const cached = get().thumbnails[entry.id];
    if (cached !== undefined || !entry.thumbnail) {
      if (entry.thumbnail === null || !entry.thumbnail) {
        set((state) => ({ thumbnails: { ...state.thumbnails, [entry.id]: null } }));
      }
      return;
    }
    const api = window.electronAPI;
    if (!api?.historyGetThumbnail) {
      set((state) => ({ thumbnails: { ...state.thumbnails, [entry.id]: null } }));
      return;
    }
    try {
      const data = await withBridgeTimeout(
        bridgePromise(() => api.historyGetThumbnail!(entry.id)),
        HISTORY_BRIDGE_TIMEOUT_MS,
        null,
      );
      set((state) => ({
        thumbnails: { ...state.thumbnails, [entry.id]: typeof data === 'string' && isHistoryDataUrl(data) ? data : null },
      }));
    } catch {
      set((state) => ({ thumbnails: { ...state.thumbnails, [entry.id]: null } }));
    }
  },

  setQuery: (patch) => set((state) => ({ query: { ...state.query, ...patch } })),

  select: (id) => set({ selectedId: id }),

  reset: () => {
    requestSequence += 1;
    set({
      entries: [],
      loadState: 'idle',
      error: null,
      query: { ...initialQuery },
      selectedId: null,
      thumbnails: {},
    });
  },
}));
