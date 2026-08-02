import { styled } from '@mui/material/styles';
import { Box, IconButton, Typography } from '@mui/material';

export const FieldBox = styled(Box)({ flex: 1 });

export const FieldLabel = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(0.5),
  display: 'block',
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.secondary,
}));

export const ToggleRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginTop: theme.spacing(0.5),
  '& .MuiTypography-root.MuiTypography-caption': {
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.secondary,
  },
}));

export const ToggleSpacer = styled(Box)(({ theme }) => ({
  display: 'none',
  [theme.breakpoints.up('sm')]: {
    display: 'block',
    height: theme.spacing(2.5),
  },
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
  width: 96,
  height: 96,
  objectFit: 'cover',
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  display: 'block',
}));

export const PreviewCloseButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: -8,
  right: -8,
  zIndex: 1,
  width: 24,
  height: 24,
  minWidth: 24,
  minHeight: 24,
  padding: 0,
  fontSize: 14,
  color: theme.palette.error.main,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  '&:hover': {
    color: theme.palette.error.main,
    backgroundColor: theme.palette.error.main,
    borderColor: theme.palette.error.main,
    '& svg': {
      color: theme.palette.common.white,
    },
  },
}));
