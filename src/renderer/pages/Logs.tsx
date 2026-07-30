import { useRef, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, IconButton, Tooltip, Typography, Select, MenuItem, type SelectChangeEvent } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { useLogStore } from '../stores/logStore';

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
          <MenuItem value="ALL">ALL</MenuItem>
          <MenuItem value="DEBUG">DEBUG</MenuItem>
          <MenuItem value="INFO">INFO</MenuItem>
          <MenuItem value="WARN">WARN</MenuItem>
          <MenuItem value="ERROR">ERROR</MenuItem>
        </Select>
        <Tooltip title={t('logs.clear')}>
          <IconButton size="small" onClick={clear}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" color="text.secondary">
          {entries.length} entries
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
            No log entries yet.
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
