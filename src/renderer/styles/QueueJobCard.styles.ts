import { styled, alpha } from '@mui/material/styles';
import { Box, Chip, IconButton, Paper, Stack, Typography } from '@mui/material';
import { QUEUE_STATUS } from '../../shared/media-options';
import { SHADOWS, OVERLAY_COLORS } from '../colors';

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
  boxShadow: $dragOverlay ? theme.shadows[8] : theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
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

/**
 * Fixed-width thumbnail column. Its own height never influences the card's
 * height (it has no in-flow content), so it is stretched by the flex row to
 * match the card content column instead of the other way around. This keeps a
 * tall/vertical video preview from inflating the card.
 * @const ThumbWrap
 */
export const ThumbWrap = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: theme.typography.pxToRem(112),
  flexShrink: 0,
  alignSelf: 'stretch',
  overflow: 'hidden',
}));

/**
 * Fills the {@link ThumbWrap} column exactly, cropping via `objectFit: cover`
 * so the preview always matches the card height regardless of aspect ratio.
 * @const ThumbImg
 */
export const ThumbImg = styled('img')({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

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

/** Wrapper letting the job name shrink inside the header row. @const JobTitleWrapper */
export const JobTitleWrapper = styled(Box)({
  flex: '1 1 0',
  minWidth: 0,
});

/** Non-interactive "customized" indicator icon. @const CustomizedIconButton */
export const CustomizedIconButton = styled(IconButton)({
  pointerEvents: 'none',
});

export const StatusChip = styled(Chip)(({ theme }) => ({
  borderRadius: theme.spacing(0.75),
  height: theme.typography.pxToRem(28),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  '& .MuiChip-label': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    lineHeight: 1,
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
  '&.MuiChip-colorInfo': {
    backgroundColor: alpha(theme.palette.info.main, 0.18),
  },
  '&.MuiChip-colorDefault': {
    backgroundColor: theme.palette.action.hover,
  },
}));

export const CardActionsStack = styled(Stack)({ flexWrap: 'nowrap', alignItems: 'center', flexShrink: 0 });

export const DragHandleButton = styled(IconButton)(({ theme }) => ({
  cursor: 'grab',
  color: theme.palette.text.secondary,
  borderRadius: theme.typography.pxToRem(4),
  padding: theme.spacing(0.5),
  '&:hover': {
    color: theme.palette.text.primary,
  },
  '&:active': {
    cursor: 'grabbing',
  },
  '& .MuiTouchRipple-child': {
    borderRadius: theme.typography.pxToRem(4),
  },
}));

export const DetailsBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderTop: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.mode === 'dark' ? OVERLAY_COLORS.white02 : OVERLAY_COLORS.black02,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).INSET_DARK : SHADOWS(theme).INSET_LIGHT,
}));

export const DetailsLabel = styled(Typography)(({ theme }) => ({
  display: 'block',
  fontWeight: 600,
  marginBottom: theme.spacing(0.5),
}));

export const OptionsGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(${theme.typography.pxToRem(220)}, 1fr))`,
  gap: `${theme.typography.pxToRem(2)} ${theme.typography.pxToRem(16)}`,
  marginBottom: theme.typography.pxToRem(4),
}));

export const OptionRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  columnGap: theme.typography.pxToRem(4),
}));
