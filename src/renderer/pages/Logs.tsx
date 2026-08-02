import { useRef, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, Tooltip, Typography, MenuItem } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
} from '../styles/Logs.styles';
import { PageTitle } from '../styles/BatchQueue.styles';
import { TitleIcon } from '../styles/PageContainer.styles';
import { pageIcons } from '../pageIcons';

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: COLORS.log.debug,
  INFO: COLORS.log.info,
  WARN: COLORS.log.warn,
  ERROR: COLORS.log.error,
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
      <PageTitle variant="h5">
        <TitleIcon>{pageIcons['/logs']}</TitleIcon>
        {t('nav.logs')}
      </PageTitle>
      <LogsHeader>
        <FilterSelect size="small" value={filter} onChange={(e) => setFilter(e.target.value as string)}>
          <MenuItem value="ALL">{t('logs.levelAll')}</MenuItem>
          <MenuItem value="DEBUG">{t('logs.levelDebug')}</MenuItem>
          <MenuItem value="INFO">{t('logs.levelInfo')}</MenuItem>
          <MenuItem value="WARN">{t('logs.levelWarn')}</MenuItem>
          <MenuItem value="ERROR">{t('logs.levelError')}</MenuItem>
        </FilterSelect>
        <Tooltip title={t('logs.clear')}>
          <IconButton size="small" onClick={clear}>
            <FontAwesomeIcon icon={faEraser} style={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('logs.download')}>
          <IconButton size="small" onClick={downloadLogs}>
            <FontAwesomeIcon icon={faDownload} style={{ fontSize: 20 }} />
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
