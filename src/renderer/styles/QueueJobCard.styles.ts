import { styled, alpha } from '@mui/material/styles';
import { Box, Chip, IconButton, Paper, Stack, Typography } from '@mui/material';
import { QUEUE_STATUS } from '../../shared/media-options';
import { SHADOWS } from '../colors';

export const JobCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== '$status' && prop !== '$dragOverlay',
})<{ $status: string; $dragOverlay?: boolean }>(({ theme, $status, $dragOverlay }) => ({
  padding: 0,
  overflow: 'hidden',
  borderColor:
    $status === QUEUE_STATUS.ERROR
      ? theme.palette.error.main
      : $status === QUEUE_STATUS.DONE
        ? theme.palette.success.main
        : theme.palette.divider,
  boxShadow: $dragOverlay ? theme.shadows[8] : theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
  transform: $dragOverlay ? 'rotate(1.5deg)' : undefined,
}));

export const CardBody = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'stretch',
});

export const CardContent = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  padding: theme.spacing(1.5),
}));

export const ThumbImg = styled('img')(({ theme }) => ({
  width: theme.typography.pxToRem(112),
  alignSelf: 'stretch',
  objectFit: 'cover',
  flexShrink: 0,
}));

export const CardHeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(0.5),
}));

export const JobNameText = styled(Typography)({
  fontWeight: 600,
  flex: '1 1 0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
});

export const StatusChip = styled(Chip)(({ theme }) => ({
  borderRadius: theme.spacing(0.75),
  height: theme.typography.pxToRem(28),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
  '& .MuiChip-label': {
    textTransform: 'uppercase',
    fontWeight: theme.typography.fontWeightBold,
    fontSize: theme.typography.pxToRem(11),
  },
  '&.MuiChip-colorPrimary': {
    backgroundColor: alpha(theme.palette.primary.main, 0.18),
  },
  '&.MuiChip-colorSuccess': {
    backgroundColor: alpha(theme.palette.success.main, 0.18),
  },
  '&.MuiChip-colorWarning': {
    backgroundColor: alpha(theme.palette.warning.main, 0.18),
  },
  '&.MuiChip-colorError': {
    backgroundColor: alpha(theme.palette.error.main, 0.18),
  },
  '&.MuiChip-colorDefault': {
    backgroundColor: theme.palette.action.hover,
  },
}));

export const CardActionsStack = styled(Stack)({ flexWrap: 'nowrap', alignItems: 'center', flexShrink: 0 });

export const DragHandleButton = styled(IconButton)(({ theme }) => ({
  cursor: 'grab',
  color: theme.palette.text.secondary,
  '&:hover': {
    color: theme.palette.text.primary,
  },
  '&:active': {
    cursor: 'grabbing',
  },
}));

export const DetailsBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
  boxShadow: theme.palette.mode === 'dark' ? 'inset 0 6px 4px -2px rgba(0, 0, 0, 0.35)' : 'inset 0 6px 4px -2px rgba(0, 0, 0, 0.1)',
}));

export const DetailsLabel = styled(Typography)(({ theme }) => ({
  display: 'block',
  fontWeight: 600,
  marginBottom: theme.spacing(0.5),
}));

export const OptionsGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '2px 16px',
  marginBottom: 4,
});

export const OptionRow = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'center',
  columnGap: 4,
});
