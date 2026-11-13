import { alpha, styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Typography, Stack, Box, Chip, TextField, Alert, ButtonGroup, IconButton, Tabs } from '@mui/material';
import type { ElementType } from 'react';
import { OVERLAY_COLORS, SHADOWS } from '../../shared/theme/colors';

export const PageTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  fontWeight: 600,
  marginBottom: theme.spacing(2),
}));

export const AccelAlert = styled(Alert)(({ theme }) => ({
  fontWeight: 500,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

export const LockedAlert = styled(Alert)(({ theme }) => ({
  fontWeight: 500,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

/**
 * Shared look of the queue empty-state captions: centered, bold and in the
 * secondary text colour.
 * @param {Theme} theme - The MUI theme (provides typography/colour tokens).
 * @returns {object} The shared caption styles.
 */
const emptyCaption = (theme: Theme) => ({
  textAlign: 'center' as const,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.secondary,
});

/** Standalone empty-state heading with generous vertical padding. @const EmptyText */
export const EmptyText = styled(Typography)(({ theme }) => ({
  ...emptyCaption(theme),
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
}));

/** Empty-state heading used inside a padded empty-state card. @const EmptyHeadingText */
export const EmptyHeadingText = styled(Typography)(({ theme }) => ({
  ...emptyCaption(theme),
}));

/** Secondary caption shown under an empty-state heading. @const EmptyHintText */
export const EmptyHintText = styled(Typography)(({ theme }) => ({
  ...emptyCaption(theme),
  fontSize: theme.typography.pxToRem(13),
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
export const AnimatedSection = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$hidden' && prop !== '$gone',
})<{ $hidden?: boolean; $gone?: boolean }>(({ theme, $hidden, $gone }) => ({
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
export const CondenseIcon = styled('span', {
  shouldForwardProp: (prop) => prop !== '$rotated',
})<{ $rotated?: boolean }>(({ $rotated }) => ({
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

/** Condense/expand toggle button, pushed to the far right of the page title. @const CondenseButton */
export const CondenseButton = styled(IconButton)({
  marginInlineStart: 'auto',
});

/** Wrapper of the "clear all" button, pushed to the far right of the filter row. @const ClearAllBox */
export const ClearAllBox = styled(Box)({
  marginInlineStart: 'auto',
});

/**
 * Vertical stack used by the mux queue's empty state: its contents are
 * centered on the page, without any card chrome.
 * @const EmptyStack
 */
export const EmptyStack = styled(Stack)({
  alignItems: 'center',
  textAlign: 'center',
});

/** Split button holding the empty state's two page links. @const EmptyActionGroup */
export const EmptyActionGroup = styled(ButtonGroup)(({ theme }) => ({
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

/**
 * Tab bar that switches between the general queue and the mux queue.
 *
 * The selected tab is drawn in the theme's primary text colour rather than
 * MUI's default primary tint: the theme's `primary.main` on the page background
 * sits just under the 4.5:1 contrast ratio axe requires, so the default
 * selected-tab colour fails the accessibility gate. The selection stays obvious
 * through MUI's primary indicator bar and the bold weight.
 * @const QueueTabs
 */
export const QueueTabs = styled(Tabs)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  // The tabs use MUI's `inherit` text colour so the theme's own colours apply
  // instead of the primary tint (which sits just under the 4.5:1 contrast
  // ratio axe requires). MUI's inherit variant dims unselected tabs with
  // `opacity: 0.6`, so the opacity is restored here too; `&&&` outranks the
  // library's own `.MuiTab-textColorInherit` rules whatever the injection order.
  '&&& .MuiTab-root': {
    minWidth: theme.typography.pxToRem(140),
    whiteSpace: 'nowrap',
    opacity: 1,
    color: theme.palette.text.secondary,
    textTransform: 'none',
  },
  '&&& .MuiTab-root.Mui-selected': {
    color: theme.palette.text.primary,
    fontWeight: theme.typography.fontWeightBold,
  },
}));

/** Row wrapper keeping a tab's label text and count chip on one line. @const TabLabelRow */
export const TabLabelRow = styled('span')({
  display: 'inline-flex',
  alignItems: 'center',
});

/** Count badge shown next to a queue tab's label. @const TabCountChip */
export const TabCountChip = styled(Chip)(({ theme }) => ({
  borderRadius: theme.typography.pxToRem(8),
  fontWeight: 600,
  height: theme.spacing(2.5),
  marginInlineStart: theme.spacing(0.75),
  color: theme.palette.text.secondary,
  backgroundColor: alpha(theme.palette.text.secondary, 0.12),
  '& .MuiChip-label': { paddingInline: theme.spacing(1) },
}));
