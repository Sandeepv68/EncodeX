import { alpha, styled } from '@mui/material/styles';
import { Box, Button, ButtonBase, IconButton, Paper, Select, TextField, Typography } from '@mui/material';

export const HistoryRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  height: '100%',
  minHeight: 0,
});

export const HistoryToolbar = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
  padding: theme.spacing(1.25),
  flexShrink: 0,
}));

export const HistorySearchField = styled(TextField)(({ theme }) => ({
  flex: '1 1 auto',
  minWidth: theme.typography.pxToRem(180),
  maxWidth: theme.typography.pxToRem(360),
  '& .MuiInputBase-root': {
    height: theme.typography.pxToRem(34),
    fontSize: theme.typography.pxToRem(13),
  },
  '& .MuiOutlinedInput-input': {
    padding: `0 ${theme.spacing(1)}`,
  },
}));

export const HistorySelect = styled(Select)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(120),
  height: theme.typography.pxToRem(34),
  fontSize: theme.typography.pxToRem(13),
}));

export const HistoryCountText = styled(Typography)(({ theme }) => ({
  marginInlineStart: 'auto',
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(12),
  whiteSpace: 'nowrap',
}));

export const HistoryActionButton = styled(Button)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(72),
  height: theme.typography.pxToRem(34),
  fontSize: theme.typography.pxToRem(12),
}));

export const HistoryList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: theme.spacing(0.5),
}));

export const HistoryRowCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected?: boolean }>(({ theme, $selected }) => ({
  display: 'flex',
  alignItems: 'stretch',
  borderRadius: theme.shape.borderRadius,
  border: `${theme.typography.pxToRem(1)} solid ${$selected ? theme.palette.primary.main : theme.palette.divider}`,
  backgroundColor: $selected ? alpha(theme.palette.primary.main, 0.08) : theme.palette.background.paper,
  transition: 'background-color 150ms ease',
  '&:hover': {
    backgroundColor: alpha($selected ? theme.palette.primary.main : theme.palette.text.primary, 0.06),
  },
}));

export const HistoryRowButton = styled(ButtonBase)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  flex: 1,
  minWidth: 0,
  padding: theme.spacing(1),
  textAlign: 'start',
}));

export const HistoryRowRemove = styled(IconButton)(({ theme }) => ({
  alignSelf: 'center',
  marginInlineEnd: theme.spacing(1),
  color: theme.palette.text.secondary,
}));

export const HistoryThumbnailFrame = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: theme.typography.pxToRem(52),
  height: theme.typography.pxToRem(52),
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.secondary,
}));

export const HistoryThumbnailImage = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const HistoryRowBody = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  minWidth: 0,
  flex: 1,
}));

export const HistoryRowTop = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: 0,
}));

export const HistoryRowTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: theme.typography.pxToRem(13),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

export const HistoryRowMeta = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(12),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

export const HistoryStatusChip = styled('span', {
  shouldForwardProp: (prop) => prop !== '$status',
})<{ $status: 'succeeded' | 'failed' | 'cancelled' }>(({ theme, $status }) => {
  const color =
    $status === 'succeeded' ? theme.palette.success.main : $status === 'failed' ? theme.palette.error.main : theme.palette.warning.main;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    borderRadius: theme.shape.borderRadius,
    padding: `0 ${theme.spacing(0.75)}`,
    color,
    backgroundColor: alpha(color, 0.12),
    fontSize: theme.typography.pxToRem(11),
    fontWeight: 700,
  };
});

export const HistoryEmptyText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  padding: theme.spacing(3),
  textAlign: 'center',
}));

export const HistoryErrorText = styled(Typography)(({ theme }) => ({
  color: theme.palette.error.main,
  padding: theme.spacing(2),
  wordBreak: 'break-word',
}));

export const HistoryDetailGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `minmax(${theme.typography.pxToRem(110)}, auto) 1fr`,
  gap: theme.spacing(1),
  alignItems: 'start',
}));

export const HistoryDetailLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(12),
  fontWeight: 600,
}));

export const HistoryDetailValue = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
  overflowWrap: 'anywhere',
}));

export const HistoryPathList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.25),
}));

export const HistoryPathItem = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(12),
  fontFamily: 'monospace',
  overflowWrap: 'anywhere',
}));

export const HistoryMetadataGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${theme.typography.pxToRem(180)}, 1fr))`,
  gap: theme.spacing(1),
}));

export const HistoryMetadataItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.25),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.action.hover,
}));
