import { styled } from '@mui/material/styles';
import { Box, IconButton, Typography } from '@mui/material';

export const FieldBox = styled(Box)({ flex: 1 });

export const FieldLabel = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(0.5),
  display: 'block',
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.secondary,
}));

export const PreviewBox = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1.5),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

export const PreviewImageBox = styled(Box)({
  position: 'relative',
  flexShrink: 0,
});

export const PreviewInfo = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  minWidth: 0,
}));

export const PreviewImage = styled('img')(({ theme }) => ({
  width: theme.typography.pxToRem(160),
  height: theme.typography.pxToRem(90),
  objectFit: 'cover',
  borderRadius: theme.shape.borderRadius,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  display: 'block',
}));

export const PreviewCloseButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.typography.pxToRem(-8),
  right: theme.typography.pxToRem(-8),
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
