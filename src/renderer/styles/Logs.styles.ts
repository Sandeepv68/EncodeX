import { styled } from '@mui/material/styles';
import { Box, Typography, Select, Paper } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { COLORS, SHADOWS } from '../colors';

export const LogsRoot = styled(Box)({ display: 'flex', flexDirection: 'column', height: '100%' });

export const LogsHeader = styled(Paper)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(1),
  flexShrink: 0,
  padding: theme.spacing(1.5),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
}));

export const FilterSelect = styled(Select)(({ theme }) => ({ minWidth: theme.typography.pxToRem(100) }));

export const LogsBody = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  backgroundColor: COLORS.log.background,
  color: COLORS.log.text,
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(12),
  padding: theme.spacing(1),
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}));

export const NoEntriesText = styled(Typography)(({ theme }) => ({
  color: COLORS.log.muted,
  padding: theme.spacing(1),
}));

export const LogEntryRow = styled(Box)({ lineHeight: 1.5 });

export const TimestampSpan = styled('span')({ color: COLORS.log.muted });

export const LevelSpan = styled('span', {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color: string }>(({ $color }) => ({ color: $color }));

export const SourceSpan = styled('span')({ color: COLORS.log.muted });

export const LogActionIcon = styled(FontAwesomeIcon)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(20),
}));
