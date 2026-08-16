import { styled, alpha } from '@mui/material/styles';
import { Box } from '@mui/material';

export const INDICATOR_HEIGHT = 3;

/** Relative-positioned wrapper around the sortable list. @const DropAreaRoot */
export const DropAreaRoot = styled(Box)({
  position: 'relative',
});

/** Primary-tinted frame drawn over the list while a drag is active. @const DragFrame */
export const DragFrame = styled(Box)(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  borderRadius: theme.typography.pxToRem(2),
  border: `${theme.typography.pxToRem(1)} dashed ${alpha(theme.palette.primary.main, 0.5)}`,
  backgroundColor: alpha(theme.palette.primary.main, 0.06),
  pointerEvents: 'none',
}));

/** Content stack layered above the drop frame. @const ContentLayer */
export const ContentLayer = styled(Box)({
  position: 'relative',
  zIndex: 1,
});

/** Solid accent line marking the current insertion gap. @const DropIndicator */
export const DropIndicator = styled(Box)(({ theme }) => ({
  position: 'absolute',
  zIndex: 2,
  insetInline: 0,
  height: INDICATOR_HEIGHT,
  backgroundColor: theme.palette.primary.main,
  borderRadius: INDICATOR_HEIGHT / 2,
  boxShadow: `0 0 ${theme.typography.pxToRem(6)} ${alpha(theme.palette.primary.main, 0.6)}`,
  pointerEvents: 'none',
}));
