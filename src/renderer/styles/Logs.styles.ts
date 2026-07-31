import { styled } from '@mui/material/styles';
import { Box, Typography, Select } from '@mui/material';

export const LogsRoot = styled(Box)({ display: 'flex', flexDirection: 'column', height: '100%' });

export const LogsHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(1),
  flexShrink: 0,
}));

export const LogsTitle = styled(Typography)({ fontWeight: 600 });

export const FilterSelect = styled(Select)(({ theme }) => ({ minWidth: theme.typography.pxToRem(100) }));

export const LogsBody = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  backgroundColor: '#1e1e1e',
  color: '#d4d4d4',
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(12),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}));

export const NoEntriesText = styled(Typography)(({ theme }) => ({
  color: '#888',
  padding: theme.spacing(1),
}));

export const LogEntryRow = styled(Box)({ lineHeight: 1.5 });

export const TimestampSpan = styled('span')({ color: '#888' });

export const LevelSpan = styled('span', {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color: string }>(({ $color }) => ({ color: $color }));

export const SourceSpan = styled('span')({ color: '#888' });
