import { styled } from '@mui/material/styles';
import { Typography, Stack, Box, Chip, TextField, Alert } from '@mui/material';
import { COLORS, OVERLAY_COLORS, SHADOWS } from '../colors';

export const PageTitle = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  fontWeight: 600,
  marginBottom: theme.spacing(2),
}));

export const AccelAlert = styled(Alert)(({ theme }) => ({
  fontWeight: 500,
  color: COLORS.alert.info,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

export const EmptyText = styled(Typography)(({ theme }) => ({
  textAlign: 'center',
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.secondary,
}));

export const FilterRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));

export const FilterChip = styled(Chip)(({ theme }) => ({
  borderRadius: theme.spacing(0.75),
  height: theme.typography.pxToRem(28),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  border: `${theme.typography.pxToRem(1)} solid transparent`,
  '&.MuiChip-colorPrimary': {
    borderColor: theme.palette.primary.main,
    '& .MuiChip-label': {
      color: theme.palette.primary.main,
    },
    '&:hover': {
      borderColor: theme.palette.primary.main,
      '& .MuiChip-label': {
        color: theme.palette.primary.main,
      },
    },
  },
}));

export const SearchField = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-root': {
    height: theme.typography.pxToRem(28),
    fontSize: theme.typography.pxToRem(13),
    boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  },
  '& .MuiOutlinedInput-input': {
    padding: `0 ${theme.spacing(1)}`,
  },
}));

export const DropOverlay = styled(Box)(({ theme }) => ({
  position: 'fixed',
  inset: 0,
  zIndex: theme.zIndex.modal,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: theme.palette.mode === 'dark' ? OVERLAY_COLORS.black70 : OVERLAY_COLORS.white70,
  pointerEvents: 'none',
}));
