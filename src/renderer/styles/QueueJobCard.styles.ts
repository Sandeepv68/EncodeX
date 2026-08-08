import { styled, alpha } from '@mui/material/styles';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { QUEUE_STATUS } from '../../shared/media-options';
import { SHADOWS } from '../colors';

export const JobCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== '$status',
})<{ $status: string }>(({ theme, $status }) => ({
  padding: theme.spacing(1.5),
  borderColor:
    $status === QUEUE_STATUS.ERROR
      ? theme.palette.error.main
      : $status === QUEUE_STATUS.DONE
        ? theme.palette.success.main
        : theme.palette.divider,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
}));

export const CardHeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(0.5),
}));

export const TitleBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: 0,
  flex: 1,
}));

export const ThumbImg = styled('img')(({ theme }) => ({
  width: theme.typography.pxToRem(40),
  height: theme.typography.pxToRem(40),
  borderRadius: theme.shape.borderRadius,
  objectFit: 'cover',
  flexShrink: 0,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
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

export const DetailsBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
  padding: theme.spacing(1),
  borderTop: `1px solid ${theme.palette.divider}`,
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
