import { styled } from '@mui/material/styles';
import { Typography, Stack, Box, Chip, TextField, Alert } from '@mui/material';
import type { ElementType } from 'react';
import { COLORS, OVERLAY_COLORS, SHADOWS } from '../colors';

export const PageTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
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

export const LockedAlert = styled(Alert)(({ theme }) => ({
  fontWeight: 500,
  color: COLORS.alert.warning,
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

/** ETA caption pushed to the far right of the filter row. @const FilterEta */
export const FilterEta = styled(Typography)({
  marginInlineStart: 'auto',
});

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

/**
 * Wraps a collapsible section of the batch queue page (the batch controls and
 * the encoding options panel). While the page is condensed, the section fades
 * out in step with the height collapse driven by the MUI `Collapse` it wraps.
 * Once the collapse animation has fully completed it is removed from the
 * layout (`$gone`) so the condensed page leaves no empty space behind.
 * @param {boolean} [$hidden] - True while the page is condensed (opacity 0).
 * @param {boolean} [$gone] - True once collapse finished (display none).
 */
export const AnimatedSection = styled(Box)<{ $hidden?: boolean; $gone?: boolean }>(({ theme, $hidden, $gone }) => ({
  display: $gone ? 'none' : undefined,
  opacity: $hidden ? 0 : 1,
  transition: `opacity ${theme.transitions.duration.standard}ms ease-in-out`,
}));

/**
 * The condense/expand toggle icon. Rotates 180 degrees when the page switches
 * between the condensed and full layouts so the button reads as an animated
 * physical control.
 * @param {boolean} [$rotated] - True while the page is condensed.
 */
export const CondenseIcon = styled('span')<{ $rotated?: boolean }>(({ $rotated }) => ({
  display: 'inline-flex',
  transition: 'transform 250ms ease-in-out',
  transform: $rotated ? 'rotate(180deg)' : 'rotate(0deg)',
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
