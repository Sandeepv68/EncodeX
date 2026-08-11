import { styled } from '@mui/material/styles';
import { Box, IconButton } from '@mui/material';

/** Wrapper for the shared media preview thumbnail + info row. @const PreviewBox */
export const PreviewBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1.5),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

/** Positioned container that holds the preview image and its remove button. @const PreviewImageBox */
export const PreviewImageBox = styled(Box)({
  position: 'relative',
  flexShrink: 0,
});

/** Column that stacks the file name, dimensions/size, and stream details. @const PreviewInfo */
export const PreviewInfo = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  minWidth: 0,
}));

/** Preview thumbnail; square (images) or wide (videos) via the `variant` prop. @const PreviewImage */
export const PreviewImage = styled('img')<{ variant?: 'square' | 'wide' }>(({ theme, variant }) => ({
  width: theme.typography.pxToRem(variant === 'wide' ? 160 : 96),
  height: theme.typography.pxToRem(variant === 'wide' ? 90 : 96),
  objectFit: 'cover',
  borderRadius: theme.shape.borderRadius,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  display: 'block',
}));

/** Round remove button floating on the preview thumbnail corner. @const PreviewCloseButton */
export const PreviewCloseButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.typography.pxToRem(-8),
  insetInlineEnd: theme.typography.pxToRem(-8),
  zIndex: 1,
  width: theme.typography.pxToRem(24),
  height: theme.typography.pxToRem(24),
  minWidth: theme.typography.pxToRem(24),
  minHeight: theme.typography.pxToRem(24),
  padding: 0,
  fontSize: theme.typography.pxToRem(14),
  color: theme.palette.error.main,
  backgroundColor: theme.palette.background.paper,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  '&:hover': {
    color: theme.palette.error.main,
    backgroundColor: theme.palette.error.main,
    borderColor: theme.palette.error.main,
    '& svg': {
      color: theme.palette.common.white,
    },
  },
}));
