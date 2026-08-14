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
  };

  /**
   * Scrolls the bottom sentinel into view (smoothly) whenever the underlying
   * log entries change, keeping the newest entry on screen.
   * @returns {void}
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  /**
   * The log entries to display, recomputed when either the store entries or the
   * active filter change. Returns all entries for the 'ALL' filter, otherwise
   * only entries whose level matches.
   * @type {Array<import('../../shared/types').LogEntry>}
   */
  const filtered = useMemo(() => (filter === 'ALL' ? entries : entries.filter((e) => e.level === filter)), [entries, filter]);

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
          onChange={(e) => setFilter(e.target.value as string)}
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
          <IconButton size="small" onClick={clear} aria-label={t('logs.clear')} data-testid="logs-clear">
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
      <LogsBody>
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
