import { HISTORY_FAMILIES, HISTORY_SOURCES, HISTORY_STATUSES } from '../../shared/history/types';
import type { HistoryEntry, HistoryFamily, HistorySource, HistoryStatus } from '../../shared/history/types';
import type { HistoryQuery, HistorySortKey } from '../stores/types';

const SORT_KEYS: HistorySortKey[] = ['newest', 'oldest', 'longest', 'shortest', 'name'];

export function isHistoryFamily(value: string): value is HistoryFamily {
  return (HISTORY_FAMILIES as readonly string[]).includes(value);
}

export function isHistorySource(value: string): value is HistorySource {
  return (HISTORY_SOURCES as readonly string[]).includes(value);
}

export function isHistoryStatus(value: string): value is HistoryStatus {
  return (HISTORY_STATUSES as readonly string[]).includes(value);
}

export function isHistorySortKey(value: string): value is HistorySortKey {
  return (SORT_KEYS as readonly string[]).includes(value);
}

export function historySortKeys(): HistorySortKey[] {
  return SORT_KEYS;
}

export function historyFamilyLabelKey(family: HistoryFamily): string {
  return `history.familyLabels.${family.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`;
}

export function historySourceLabelKey(source: HistorySource): string {
  return `history.sourceLabels.${source}`;
}

export function historyStatusLabelKey(status: HistoryStatus): string {
  return `history.statusLabels.${status}`;
}

export function historySortLabelKey(sort: HistorySortKey): string {
  return `history.sort${sort.replace(/^./, (letter) => letter.toUpperCase())}`;
}

export function historyBaseName(value: string): string {
  const parts = value.split(/[\\/]/);
  return parts[parts.length - 1] || value;
}

export function historySearchText(entry: HistoryEntry): string {
  const metadata = Object.entries(entry.metadata)
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(' ');
  return [
    entry.id,
    entry.family,
    entry.source,
    entry.status,
    entry.jobId ?? '',
    entry.runId ?? '',
    entry.transcoder ?? '',
    entry.error?.code ?? '',
    entry.error?.message ?? '',
    entry.error?.detail ?? '',
    ...entry.inputs,
    ...entry.outputs,
    metadata,
  ]
    .join(' ')
    .toLowerCase();
}

export function filterHistoryEntries(entries: HistoryEntry[], query: HistoryQuery): HistoryEntry[] {
  const search = query.search.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    if (query.status !== 'all' && entry.status !== query.status) return false;
    if (query.family !== 'all' && entry.family !== query.family) return false;
    if (query.source !== 'all' && entry.source !== query.source) return false;
    return !search || historySearchText(entry).includes(search);
  });

  const sorted = [...filtered];
  switch (query.sort) {
    case 'oldest':
      sorted.sort((a, b) => a.startedAt - b.startedAt);
      break;
    case 'longest':
      sorted.sort((a, b) => b.durationMs - a.durationMs);
      break;
    case 'shortest':
      sorted.sort((a, b) => a.durationMs - b.durationMs);
      break;
    case 'name':
      sorted.sort((a, b) => {
        const left = historyBaseName(a.inputs[0] ?? a.outputs[0] ?? a.id).toLowerCase();
        const right = historyBaseName(b.inputs[0] ?? b.outputs[0] ?? b.id).toLowerCase();
        return left.localeCompare(right);
      });
      break;
    default:
      sorted.sort((a, b) => b.startedAt - a.startedAt);
      break;
  }
  return sorted;
}

export function formatHistoryDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs} ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)} s`;
  return `${Math.floor(durationMs / 60000)} m ${Math.round((durationMs % 60000) / 1000)} s`;
}

export function isHistoryDataUrl(value: string): boolean {
  return /^data:image\/(?:png|jpeg);base64,[a-z0-9+/=]+$/i.test(value);
}
