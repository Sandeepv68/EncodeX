/**
 * @fileoverview Application log viewer page. Displays the in-memory log entries
 * collected by the main process. Corresponds to the `/logs` route and is
 * reached from the navigation bar.
 *
 * Log entries are read from the `useLogStore` zustand store, which is populated
 * by the renderer-side IPC subscription registered in App. The page offers a
 * level filter (ALL/DEBUG/INFO/WARN/ERROR), a free-text search over the
 * entries, a clear button, and a download button that exports the visible
 * entries to a timestamped `.txt` file. The visible list is memoized from the
 * store entries, the active filter and the active search query.
 *
 * No direct IPC calls are made from this page; clearing and exporting operate on
 * the store and the browser Blob/download APIs respectively.
 */

import { useRef, useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, InputAdornment, Tooltip, Typography, MenuItem } from '@mui/material';
import { faEraser, faDownload, faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useLogStore } from '../stores/logStore';
import { useAuditStore } from '../stores/auditStore';
import { useToastStore } from '../stores/toastStore';
import { useHotkeys } from '../hooks/useHotkeys';
import { COLORS } from '../../shared/theme/colors';
import {
  LogsRoot,
  LogsHeader,
  FilterSelect,
  SearchField,
  SearchIcon,
  EntryCount,
  LogsBody,
  NoEntriesText,
  LogEntryRow,
  LogsSpacer,
  TimestampSpan,
  LevelSpan,
  SourceSpan,
  LogActionIcon,
  AuditPanel,
  AuditRow,
  AuditTool,
  AuditStatus,
  AuditMuted,
  AuditHeader,
  AuditTitle,
} from '../styles/Logs.styles';
import { PageTitle } from '../styles/BatchQueue.styles';
import { LOG_EXPORT_FILENAME_PREFIX } from '../../shared/constants';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import { TitleIcon } from '../styles/PageContainer.styles';
import { pageIcons } from '../pageIcons';
import type { LogEntry } from '../../shared/types';

/**
 * Maps each log level to the display color used by `LevelSpan`. Unknown levels
 * fall back to the generic `COLORS.log.text`.
 * @const {Record<string, string>}
 */
const LEVEL_COLORS: Record<string, string> = {
  DEBUG: COLORS.log.debug,
  INFO: COLORS.log.info,
  WARN: COLORS.log.warn,
  ERROR: COLORS.log.error,
};

/**
 * Estimated pixel height of one log line: the body font is 12 px
 * (`LogsBody` sets `fontSize: pxToRem(12)`) and `LogEntryRow` sets
 * `lineHeight: 1.5`, so 12 * 1.5 = 18 px.
 *
 * The list is windowed with this estimate (see {@link Logs}), keeping only the
 * ~visible slice of rows mounted. Rows that wrap (very long entries) drift by
 * their extra lines; the overscan absorbs that drift, and the estimate is used
 * only for scroll placement, never for truncating content.
 *
 * @const {number}
 */
export const LOG_ROW_HEIGHT = 18;

/** Extra rows kept mounted above and below the visible viewport. */
const LOG_WINDOW_OVERSCAN = 20;

/** Maximum number of audit rows shown in the audit panel (newest first). */
const AUDIT_DISPLAY_LIMIT = 50;

/**
 * Builds the haystack a search query is matched against: everything the entry
 * renders (timestamp, level, source and text) joined into one lower-cased
 * string, so a query matches the row the user sees.
 * @param {LogEntry} entry - The log entry to index.
 * @returns {string} The lower-cased searchable text of the entry.
 */
function searchHaystack(entry: LogEntry): string {
  return `${entry.timestamp} ${entry.level} ${entry.source} ${entry.text}`.toLowerCase();
}

/**
 * Renders the log viewer page (`/logs`).
 *
 * Shows a header with the level `FilterSelect`, a free-text `SearchField`, a
 * clear button, a download button, and an entry counter, followed by a
 * scrollable `LogsBody`. Each entry row shows the time portion of the
 * timestamp, the colored level, the source, and the log text. A bottom sentinel
 * element is kept in view so the list auto-scrolls to the newest entry whenever
 * `entries` change.
 *
 * State managed: the active `filter` level (local `useState`, default 'ALL'),
 * the `search` text, and `bottomRef` for the auto-scroll sentinel. The visible
 * entries are derived with `useMemo` by filtering the store's `entries` against
 * the filter and the search query.
 *
 * @returns {JSX.Element} The page content.
 */
export default function Logs() {
  const { t } = useTranslation();
  const entries = useLogStore((s) => s.entries);
  const clear = useLogStore((s) => s.clear);
  const auditEntries = useAuditStore((s) => s.entries);
  const clearAudit = useAuditStore((s) => s.clear);

  /**
   * The most recent audit records, newest first, capped at
   * {@link AUDIT_DISPLAY_LIMIT} so the panel stays bounded.
   * @type {Array<import('../../shared/audit').AuditEntry>}
   */
  const recentAudit = useMemo(() => auditEntries.slice(-AUDIT_DISPLAY_LIMIT).reverse(), [auditEntries]);

  /**
   * Active log level filter; 'ALL' shows every level.
   * @type {string}
   */
  const [filter, setFilter] = useState('ALL');

  /**
   * The raw text typed in the search box. Kept verbatim so the input can echo
   * what the user typed (including surrounding spaces); the filtering itself
   * uses the trimmed, lower-cased {@link query}.
   * @type {string}
   */
  const [search, setSearch] = useState('');

  /**
   * The normalized search query: trimmed and lower-cased so matching is
   * case-insensitive and whitespace-only input does not narrow the list.
   * @type {string}
   */
  const query = search.trim().toLowerCase();

  /**
   * The log entries to display, recomputed when the store entries, the active
   * filter or the search query change. The level filter and the search are
   * combined: an entry has to satisfy both to stay visible.
   * @type {Array<LogEntry>}
   */
  const filtered = useMemo(() => {
    const byLevel = filter === 'ALL' ? entries : entries.filter((e) => e.level === filter);
    if (!query) return byLevel;
    return byLevel.filter((e) => searchHaystack(e).includes(query));
  }, [entries, filter, query]);

  /**
   * Ref to the sentinel `<div>` at the bottom of the log list. Scrolled into
   * view on every entries change to keep the newest logs visible.
   * @type {React.RefObject<HTMLDivElement>}
   */
  const bottomRef = useRef<HTMLDivElement>(null);
  /** The scrolling container, used to detect whether the user is already pinned to the bottom. */
  const bodyRef = useRef<HTMLDivElement>(null);
  /** The search input, focused by the `F` shortcut. */
  const searchRef = useRef<HTMLInputElement>(null);

  /**
   * The current window into the filtered list: `start` is the first mounted
   * row index and `count` the number mounted. Only this slice is in the DOM;
   * the area before/after it is held open by transparent spacer divs, so the
   * scrollbar still spans the whole list while only ~viewport rows are real.
   * @type {{start: number, count: number}}
   */
  const [window, setWindow] = useState({ start: 0, count: 0 });

  /**
   * Recomputed the window from the body's current geometry. Clamped so a
   * filter/clear that shrinks the list behind the scroll position never
   * renders past the end, and bailed out when nothing changed so a scroll
   * storm cannot re-render for identical values.
   * @param {number} total - The number of filtered rows backing the list.
   * @returns {void}
   */
  const recompute = useCallback((total: number) => {
    const body = bodyRef.current;
    if (!body) return;
    const clientHeight = body.clientHeight || 0;
    const scrollTop = body.scrollTop || 0;
    const count = Math.max(Math.ceil(clientHeight / LOG_ROW_HEIGHT) + LOG_WINDOW_OVERSCAN, LOG_WINDOW_OVERSCAN * 2 + 1);
    const start = Math.min(Math.max(0, Math.floor(scrollTop / LOG_ROW_HEIGHT) - LOG_WINDOW_OVERSCAN), Math.max(0, total - count));
    setWindow((prev) => (prev.start === start && prev.count === count ? prev : { start, count }));
  }, []);

  /**
   * Keeps the window in sync with the body geometry whenever the backing list
   * changes (appends, filter changes, clear). Runs after layout so the
   * measurements reflect the previous render's DOM.
   * @returns {void}
   */
  useLayoutEffect(() => {
    recompute(filtered.length);
  }, [filtered.length, recompute]);

  /**
   * Rewinds the list to the top whenever the search query changes. The result
   * set is a different one, so keeping the previous scroll offset would land
   * the user in the middle of an unrelated part of the log.
   * @returns {void}
   */
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = 0;
    recompute(filtered.length);
  }, [query, recompute]);

  /**
   * Recomputes the window while the user scrolls. No rAF throttle is needed:
   * the math is two arithmetic steps and `setWindow` bails out when the
   * numbers did not move, so a high-frequency scroll costs an event handler
   * and a no-op state compare.
   * @returns {void}
   */
  const handleScroll = () => recompute(filtered.length);

  /**
   * Clears all buffered log entries and records the action for analytics.
   * @returns {void}
   */
  const handleClear = () => {
    clear();
    recordAnalyticsEvent(createAnalyticsEvent('logs_cleared', {}));
  };

  /**
   * Clears the mutating-operation audit trail.
   * @returns {void}
   */
  const handleClearAudit = () => {
    clearAudit();
  };

  /**
   * Exports the currently visible entries as a plain-text file. Each line is
   * formatted as `<timestamp> [<level>] [<source>] <text>`. The file is
   * downloaded via a temporary Blob object URL whose name is prefixed with
   * `LOG_EXPORT_FILENAME_PREFIX` and stamped with the current UTC time. A
   * success toast is shown afterwards and the object URL is revoked.
   *
   * The export covers what the list shows, so an active level filter or search
   * narrows the downloaded file as well.
   * @returns {void}
   */
  const downloadLogs = () => {
    const text = filtered.map((e) => `${e.timestamp} [${e.level}] [${e.source}] ${e.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${LOG_EXPORT_FILENAME_PREFIX}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    useToastStore.getState().success(t('toast.logsDownloaded'));
    recordAnalyticsEvent(createAnalyticsEvent('logs_exported', { entryCount: filtered.length }));
  };

  /**
   * Keeps the newest entry in view, but only while the user is already at the bottom.
   *
   * Two changes from the obvious `scrollIntoView({ behavior: 'smooth' })` on every append, both
   * forced by Phase 3.3's event sweep:
   *
   * 1. `smooth` starts a fresh scroll animation on *every* entry. The store is capped at
   *    `LOG_MAX_ENTRIES` (2000), so a busy session appends entries faster than the animation can
   *    finish and the animations queue behind each other.
   * 2. It scrolled unconditionally, so scrolling back to read an older entry was yanked away by the
   *    next append. Following only when already pinned to the bottom is what a log tailer should do.
   *
   * `auto` is deliberate rather than cosmetic: an instant jump costs one layout, where a smooth
   * animation keeps the compositor busy across many frames per entry.
   * @returns {void}
   */
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    // A small tolerance: fractional layout heights mean an exact comparison flips near the bottom.
    const pinnedToBottom = body.scrollHeight - body.scrollTop - body.clientHeight <= 8;
    if (pinnedToBottom) bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [entries]);

  /**
   * Registers the page keyboard shortcuts (Ctrl+L clear, Ctrl+Shift+D download,
   * F focus search). Bindings mirror the enabled state of the equivalent
   * on-page buttons.
   * @returns {void}
   */
  useHotkeys([
    { id: 'logs.clear', handler: () => handleClear(), enabled: entries.length > 0 },
    { id: 'logs.download', handler: () => downloadLogs(), enabled: filtered.length > 0 },
    { id: 'logs.focusSearch', handler: () => searchRef.current?.focus() },
  ]);

  return (
    <LogsRoot>
      <PageTitle variant="h5" component="h1">
        <TitleIcon>{pageIcons['/logs']}</TitleIcon>
        {t('nav.logs')}
      </PageTitle>
      <LogsHeader>
        <FilterSelect
          size="small"
          value={filter}
          onChange={(e) => {
            const next = e.target.value as string;
            setFilter(next);
            recordAnalyticsEvent(createAnalyticsEvent('logs_filter_changed', { level: next }));
          }}
          data-testid="logs-filter"
          slotProps={{ input: { 'aria-label': t('logs.filter') } }}
        >
          <MenuItem value="ALL">{t('logs.levelAll')}</MenuItem>
          <MenuItem value="DEBUG">{t('logs.levelDebug')}</MenuItem>
          <MenuItem value="INFO">{t('logs.levelInfo')}</MenuItem>
          <MenuItem value="WARN">{t('logs.levelWarn')}</MenuItem>
          <MenuItem value="ERROR">{t('logs.levelError')}</MenuItem>
        </FilterSelect>
        <SearchField
          size="small"
          value={search}
          onChange={(e) => {
            const next = e.target.value;
            setSearch(next);
            recordAnalyticsEvent(createAnalyticsEvent('logs_search_changed', { queryLength: next.trim().length }));
          }}
          placeholder={t('logs.searchPlaceholder')}
          data-testid="logs-search"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon icon={faMagnifyingGlass} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <Tooltip title={t('logs.clearSearch')}>
                    <IconButton
                      size="small"
                      onClick={() => setSearch('')}
                      aria-label={t('logs.clearSearch')}
                      data-testid="logs-search-clear"
                    >
                      <LogActionIcon icon={faXmark} />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : null,
            },
            htmlInput: { 'aria-label': t('logs.search'), ref: searchRef },
          }}
        />
        <Tooltip title={t('logs.clear')}>
          <IconButton size="small" onClick={handleClear} aria-label={t('logs.clear')} data-testid="logs-clear">
            <LogActionIcon icon={faEraser} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('logs.download')}>
          <IconButton size="small" onClick={downloadLogs} aria-label={t('logs.download')} data-testid="logs-download">
            <LogActionIcon icon={faDownload} />
          </IconButton>
        </Tooltip>
        <EntryCount variant="caption" color="text.secondary">
          {filter === 'ALL' && !query
            ? t('logs.entryCount', { count: entries.length })
            : t('logs.filteredCount', { count: filtered.length, total: entries.length })}
        </EntryCount>
      </LogsHeader>
      {auditEntries.length > 0 && (
        <AuditPanel data-testid="audit-panel">
          <AuditHeader>
            <AuditTitle variant="subtitle2" component="h2">
              {t('logs.auditTitle')}
            </AuditTitle>
            <Typography variant="caption" color="text.secondary">
              {t('logs.auditCount', { count: auditEntries.length })}
            </Typography>
            <Tooltip title={t('logs.auditClear')}>
              <IconButton size="small" onClick={handleClearAudit} aria-label={t('logs.auditClear')} data-testid="audit-clear">
                <LogActionIcon icon={faEraser} />
              </IconButton>
            </Tooltip>
          </AuditHeader>
          {recentAudit.map((entry) => (
            <AuditRow key={entry.id} data-testid="audit-row">
              <TimestampSpan>{entry.timestamp.slice(11, 19)}</TimestampSpan>
              <AuditTool>{entry.tool}</AuditTool>
              <AuditMuted>{t('logs.auditTier', { tier: entry.tier })}</AuditMuted>
              <AuditStatus $ok={entry.result === 'ok'}>
                {t(entry.result === 'ok' ? 'logs.auditStatusOk' : 'logs.auditStatusFailed')}
              </AuditStatus>
              <AuditMuted>#{entry.argsDigest}</AuditMuted>
              {entry.detail ? <span>{entry.detail}</span> : null}
            </AuditRow>
          ))}
        </AuditPanel>
      )}
      <LogsBody ref={bodyRef} onScroll={handleScroll} data-testid="logs-body" tabIndex={0}>
        {filtered.length === 0 && <NoEntriesText variant="body2">{query ? t('logs.noMatches') : t('logs.noEntries')}</NoEntriesText>}
        {window.start > 0 && <LogsSpacer aria-hidden="true" $height={window.start * LOG_ROW_HEIGHT} />}
        {filtered.slice(window.start, window.start + window.count).map((entry, localIndex) => {
          const i = window.start + localIndex;
          return (
            <LogEntryRow key={i} data-testid="log-entry-row">
              <TimestampSpan>{entry.timestamp.slice(11, 23)}</TimestampSpan>{' '}
              <LevelSpan $color={LEVEL_COLORS[entry.level] || COLORS.log.text}>[{entry.level}]</LevelSpan>{' '}
              <SourceSpan>[{entry.source}]</SourceSpan> <span>{entry.text}</span>
            </LogEntryRow>
          );
        })}
        {window.start + window.count < filtered.length && (
          <LogsSpacer aria-hidden="true" $height={(filtered.length - window.start - window.count) * LOG_ROW_HEIGHT} />
        )}
        <div ref={bottomRef} />
      </LogsBody>
    </LogsRoot>
  );
}
