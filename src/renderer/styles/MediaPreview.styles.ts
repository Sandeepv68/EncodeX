import { alpha, styled } from '@mui/material/styles';
import { Box, IconButton } from '@mui/material';
import { SHADOWS } from '../colors';

/**
 * Preview frame dimensions in px, keyed by aspect variant. Kept here so the
 * frame can reserve the thumbnail's footprint before an image exists, which is
 * what gives the remove button a real corner to sit on while it loads.
 * @const {Object} PREVIEW_SIZE_PX
 */
const PREVIEW_SIZE_PX: Record<'square' | 'wide', { width: number; height: number }> = {
  square: { width: 96, height: 96 },
  wide: { width: 160, height: 90 },
};

/**
 * Resolves the frame size for a preview variant, defaulting to square.
 * @param {('square'|'wide')} [variant] - Thumbnail aspect variant.
 * @returns {{width: number, height: number}} The frame size in px.
 */
const previewSize = (variant?: 'square' | 'wide'): { width: number; height: number } =>
  PREVIEW_SIZE_PX[variant === 'wide' ? 'wide' : 'square'];

/** Wrapper for the shared media preview thumbnail + info row. @const PreviewBox */
export const PreviewBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1.5),
  display: 'flex',
  alignItems: 'center',
  // Extra clearance for the remove badge, which overhangs the thumbnail's
  // top-end corner by half its width on the side facing this column.
  gap: theme.spacing(3),
}));

/**
 * Positioned frame that holds the preview image and its remove button. The
 * frame is always sized to the thumbnail (square for images, wide for videos)
 * and paints a placeholder fill while `imageSrc` is null, so the remove button
 * is anchored to the frame's top-end corner instead of floating loose.
 * @const PreviewImageBox
 */ export const PreviewImageBox = styled(Box)<{ variant?: 'square' | 'wide' }>(({ theme, variant }) => {
  const size = previewSize(variant);
  return {
    position: 'relative',
    flexShrink: 0,
    width: theme.typography.pxToRem(size.width),
    height: theme.typography.pxToRem(size.height),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(theme.palette.primary.main, 0.06),
  };
});

/** Column that stacks the file name, dimensions/size, and stream details. @const PreviewInfo */
export const PreviewInfo = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  minWidth: 0,
}));

/**
 * Preview thumbnail, stretched to fill {@link PreviewImageBox} (which already
 * reserves the square/wide footprint) and framed with the divider border.
 * @const PreviewImage
 */
export const PreviewImage = styled('img')(({ theme }) => ({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: 'inherit',
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  display: 'block',
}));

/**
 * Round remove button straddling the preview thumbnail's top-end corner: it is
 * anchored to the corner (top / inline-end) and translated outwards by half its
 * size, so half of the badge sits over the thumbnail and half over the page.
 * The inline offset is flipped in RTL, where the corner is on the other side.
 * @const PreviewCloseButton
 */
export const PreviewCloseButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.typography.pxToRem(0),
  insetInlineEnd: theme.typography.pxToRem(0),
  transform: theme.direction === 'rtl' ? 'translate(-50%, -50%)' : 'translate(50%, -50%)',
  zIndex: 1,
  width: theme.typography.pxToRem(36),
  height: theme.typography.pxToRem(36),
  minWidth: theme.typography.pxToRem(36),
  minHeight: theme.typography.pxToRem(36),
  padding: 0,
  fontSize: theme.typography.pxToRem(16),
  color: theme.palette.error.main,
  backgroundColor: theme.palette.background.paper,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  '&:hover': {
    color: theme.palette.error.main,
    backgroundColor: theme.palette.error.main,
    borderColor: theme.palette.error.main,
    '& svg': {
      color: theme.palette.common.white,
    },
  },
}));
