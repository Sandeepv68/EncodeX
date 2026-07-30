import { useRef, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, IconButton, Tooltip, Typography, Select, MenuItem, type SelectChangeEvent } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import { useLogStore } from '../stores/logStore';
import { useToastStore } from '../stores/toastStore';

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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexShrink: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {t('nav.logs')}
        </Typography>
        <Select size="small" value={filter} onChange={(e: SelectChangeEvent) => setFilter(e.target.value as string)} sx={{ minWidth: 100 }}>
          <MenuItem value="ALL">{t('logs.levelAll')}</MenuItem>
          <MenuItem value="DEBUG">{t('logs.levelDebug')}</MenuItem>
          <MenuItem value="INFO">{t('logs.levelInfo')}</MenuItem>
          <MenuItem value="WARN">{t('logs.levelWarn')}</MenuItem>
          <MenuItem value="ERROR">{t('logs.levelError')}</MenuItem>
        </Select>
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
      </Box>
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: 'monospace',
          fontSize: 12,
          p: 1,
          borderRadius: 1,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {filtered.length === 0 && (
          <Typography variant="body2" sx={{ color: '#888', p: 1 }}>
            {t('logs.noEntries')}
          </Typography>
        )}
        {filtered.map((entry, i) => (
          <Box key={i} sx={{ lineHeight: 1.5 }}>
            <span style={{ color: '#888' }}>{entry.timestamp.slice(11, 23)}</span>{' '}
            <span style={{ color: LEVEL_COLORS[entry.level] || '#d4d4d4' }}>[{entry.level}]</span>{' '}
            <span style={{ color: '#888' }}>[{entry.source}]</span> <span>{entry.text}</span>
          </Box>
        ))}
        <div ref={bottomRef} />
      </Box>
    </Box>
  );
}
