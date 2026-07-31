import { useRef, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, Tooltip, Typography, MenuItem } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import { useLogStore } from '../stores/logStore';
import { useToastStore } from '../stores/toastStore';
import {
  LogsRoot,
  LogsHeader,
  LogsTitle,
  FilterSelect,
  LogsBody,
  NoEntriesText,
  LogEntryRow,
  TimestampSpan,
  LevelSpan,
  SourceSpan,
} from '../styles/Logs.styles';

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '#9e9e9e',
  INFO: '#4fc3f7',
  WARN: '#ffa726',
  ERROR: '#ef5350',
};

export default function Logs() {
  const { t } = useTranslation();
  const entries = useLogStore((s) => s.entries);
  const clear = useLogStore((s) => s.clear);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('ALL');

  const downloadLogs = () => {
    const text = filtered.map((e) => `${e.timestamp} [${e.level}] [${e.source}] ${e.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encodex-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    useToastStore.getState().success(t('toast.logsDownloaded'));
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const filtered = useMemo(() => (filter === 'ALL' ? entries : entries.filter((e) => e.level === filter)), [entries, filter]);

  return (
    <LogsRoot>
      <LogsHeader>
        <LogsTitle variant="h5">{t('nav.logs')}</LogsTitle>
        <FilterSelect size="small" value={filter} onChange={(e) => setFilter(e.target.value as string)}>
          <MenuItem value="ALL">{t('logs.levelAll')}</MenuItem>
          <MenuItem value="DEBUG">{t('logs.levelDebug')}</MenuItem>
          <MenuItem value="INFO">{t('logs.levelInfo')}</MenuItem>
          <MenuItem value="WARN">{t('logs.levelWarn')}</MenuItem>
          <MenuItem value="ERROR">{t('logs.levelError')}</MenuItem>
        </FilterSelect>
        <Tooltip title={t('logs.clear')}>
          <IconButton size="small" onClick={clear}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('logs.download')}>
          <IconButton size="small" onClick={downloadLogs}>
            <DownloadIcon fontSize="small" />
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
            <LevelSpan $color={LEVEL_COLORS[entry.level] || '#d4d4d4'}>[{entry.level}]</LevelSpan> <SourceSpan>[{entry.source}]</SourceSpan>{' '}
            <span>{entry.text}</span>
          </LogEntryRow>
        ))}
        <div ref={bottomRef} />
      </LogsBody>
    </LogsRoot>
  );
}
