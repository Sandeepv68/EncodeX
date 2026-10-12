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
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
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

/** Transparent spacer row keeping the windowed list's scrollbar proportional. */
export const LogsSpacer = styled(Box, { shouldForwardProp: (prop) => prop !== '$height' })<{ $height: number }>(({ $height }) => ({
  height: $height,
}));

export const TimestampSpan = styled('span')({ color: COLORS.log.muted });

export const LevelSpan = styled('span', {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color: string }>(({ $color }) => ({ color: $color }));

export const SourceSpan = styled('span')({ color: COLORS.log.muted });

export const LogActionIcon = styled(FontAwesomeIcon)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(20),
}));

/** Fixed-height panel showing the mutating-operation audit trail above the log body. */
export const AuditPanel = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  marginBottom: theme.spacing(1),
  flexShrink: 0,
  maxHeight: theme.typography.pxToRem(180),
  overflow: 'auto',
  padding: theme.spacing(1.5),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

/** One audit-trail row. */
export const AuditRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  gap: theme.spacing(1),
  fontFamily: 'monospace',
  fontSize: theme.typography.pxToRem(12),
  overflow: 'hidden',
}));

/** The tool name in an audit row, emphasized and truncated. */
export const AuditTool = styled('span')({ fontWeight: 600, whiteSpace: 'nowrap' });

/** A tinted status chip in an audit row. */
export const AuditStatus = styled('span', {
  shouldForwardProp: (prop) => prop !== '$ok',
})<{ $ok: boolean }>(({ theme, $ok }) => ({
  color: $ok ? theme.palette.success.main : theme.palette.error.main,
  whiteSpace: 'nowrap',
}));

/** Muted detail text in an audit row (digest, timestamp, error). */
export const AuditMuted = styled('span')({ color: COLORS.log.muted, whiteSpace: 'nowrap' });
