/**
 * @fileoverview Application log viewer page. Displays the in-memory log entries
 * collected by the main process. Corresponds to the `/logs` route and is
 * reached from the navigation bar.
 *
 * Log entries are read from the `useLogStore` zustand store, which is populated
 * by the renderer-side IPC subscription registered in App. The page offers a
 * level filter (ALL/DEBUG/INFO/WARN/ERROR), a clear button, and a download
 * button that exports the filtered entries to a timestamped `.txt` file. The
 * visible list is memoized from the store entries and the active filter.
 *
 * No direct IPC calls are made from this page; clearing and exporting operate on
 * the store and the browser Blob/download APIs respectively.
 */

import { useRef, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, Tooltip, Typography, MenuItem } from '@mui/material';
import { faEraser, faDownload } from '@fortawesome/free-solid-svg-icons';
import { useLogStore } from '../stores/logStore';
import { useToastStore } from '../stores/toastStore';
import { useHotkeys } from '../hooks/useHotkeys';
import { COLORS } from '../colors';
import {
  LogsRoot,
  LogsHeader,
  FilterSelect,
  LogsBody,
  NoEntriesText,
  LogEntryRow,
  TimestampSpan,
  LevelSpan,
  SourceSpan,
  LogActionIcon,
} from '../styles/Logs.styles';
import { PageTitle } from '../styles/BatchQueue.styles';
import { LOG_EXPORT_FILENAME_PREFIX } from '../../shared/constants';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import { TitleIcon } from '../styles/PageContainer.styles';
import { pageIcons } from '../pageIcons';

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
 * Renders the log viewer page (`/logs`).
 *
 * Shows a header with the level `FilterSelect`, a clear button, a download
 * button, and an entry counter, followed by a scrollable `LogsBody`. Each entry
 * row shows the time portion of the timestamp, the colored level, the source,
 * and the log text. A bottom sentinel element is kept in view so the list
 * auto-scrolls to the newest entry whenever `entries` change.
 *
 * State managed: the active `filter` level (local `useState`, default 'ALL'),
 * and `bottomRef` for the auto-scroll sentinel. The visible entries are derived
 * with `useMemo` by filtering the store's `entries` against the filter.
 *
 * @returns {JSX.Element} The page content.
 */
export default function Logs() {
  const { t } = useTranslation();
  const entries = useLogStore((s) => s.entries);
  const clear = useLogStore((s) => s.clear);

  /**
   * Ref to the sentinel `<div>` at the bottom of the log list. Scrolled into
   * view on every entries change to keep the newest logs visible.
   * @type {React.RefObject<HTMLDivElement>}
   */
  const bottomRef = useRef<HTMLDivElement>(null);
  /** The scrolling container, used to detect whether the user is already pinned to the bottom. */
  const bodyRef = useRef<HTMLDivElement>(null);

  /**
   * Clears all buffered log entries and records the action for analytics.
   * @returns {void}
   */
  const handleClear = () => {
    clear();
    recordAnalyticsEvent(createAnalyticsEvent('logs_cleared', {}));
  };

  /**
   * Active log level filter; 'ALL' shows every level.
   * @type {string}
   */
  const [filter, setFilter] = useState('ALL');

  /**
   * Exports the currently filtered entries as a plain-text file. Each line is
   * formatted as `<timestamp> [<level>] [<source>] <text>`. The file is
   * downloaded via a temporary Blob object URL whose name is prefixed with
   * `LOG_EXPORT_FILENAME_PREFIX` and stamped with the current UTC time. A
   * success toast is shown afterwards and the object URL is revoked.
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
   * The log entries to display, recomputed when either the store entries or the
   * active filter change. Returns all entries for the 'ALL' filter, otherwise
   * only entries whose level matches.
   * @type {Array<import('../../shared/types').LogEntry>}
   */
  const filtered = useMemo(() => (filter === 'ALL' ? entries : entries.filter((e) => e.level === filter)), [entries, filter]);

  /**
   * Registers the page keyboard shortcuts (Ctrl+L clear, Ctrl+Shift+D download).
   * Bindings mirror the enabled state of the equivalent on-page buttons.
   * @returns {void}
   */
  useHotkeys([
    { id: 'logs.clear', handler: () => handleClear(), enabled: entries.length > 0 },
    { id: 'logs.download', handler: () => downloadLogs(), enabled: filtered.length > 0 },
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
        <Typography variant="caption" color="text.secondary">
          {t('logs.entryCount', { count: entries.length })}
        </Typography>
      </LogsHeader>
      <LogsBody ref={bodyRef} data-testid="logs-body">
        {filtered.length === 0 && <NoEntriesText variant="body2">{t('logs.noEntries')}</NoEntriesText>}
        {filtered.map((entry, i) => (
          <LogEntryRow key={i}>
            <TimestampSpan>{entry.timestamp.slice(11, 23)}</TimestampSpan>{' '}
            <LevelSpan $color={LEVEL_COLORS[entry.level] || COLORS.log.text}>[{entry.level}]</LevelSpan>{' '}
            <SourceSpan>[{entry.source}]</SourceSpan> <span>{entry.text}</span>
          </LogEntryRow>
        ))}
        <div ref={bottomRef} />
      </LogsBody>
    </LogsRoot>
  );
}
