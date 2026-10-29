/**
 * @fileoverview Styles for the navigation blip job popover card.
 */

import { styled, keyframes } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { alpha, Box, Popover, Typography } from '@mui/material';
import { SHADOWS } from '../../shared/theme/colors';

/**
 * Fixed width of the popover card in theme px units; must match the paper
 * width below. The pending-job pile is sized against the resulting content
 * width so it fills the available space on the card.
 * @const {number} POPOVER_PAPER_WIDTH
 */
export const POPOVER_PAPER_WIDTH = 260;

/**
 * Horizontal padding of the popover card in theme spacing units; must match
 * the paper padding below.
 * @const {number} POPOVER_PAPER_PADDING
 */
export const POPOVER_PAPER_PADDING = 2;

/**
 * Popover shell for the nav activity blip.
 *
 * The full-screen Modal overlay MUI mounts around the popover would sit above
 * the nav rows and steal their hover and click events (flickering the popover
 * and blocking navigation), so the overlay root and its backdrop stay
 * click-through. The paper re-enables pointer events for itself.
 * @const NavJobPopoverRoot
 */
export const NavJobPopoverRoot = styled(Popover)(({ theme }) => ({
  pointerEvents: 'none',
  '& .MuiBackdrop-root': {
    pointerEvents: 'none',
  },
  '& .MuiPopover-paper': {
    width: theme.typography.pxToRem(POPOVER_PAPER_WIDTH),
    maxWidth: `calc(100vw - ${theme.typography.pxToRem(32)})`,
    padding: theme.spacing(POPOVER_PAPER_PADDING),
    marginLeft: theme.spacing(1),
    // 2 x theme.shape.borderRadius (8px), matching the previous `borderRadius: 2`.
    borderRadius: theme.typography.pxToRem(16),
    pointerEvents: 'auto',
    overflow: 'visible',
    boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  },
}));

/**
 * Small non-animated badge shown in the popover when the batch queue is
 * configured to run more than one job in parallel, making the concurrency
 * setting visible at a glance.
 * @const PopoverParallelBadge
 */
export const PopoverParallelBadge = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: theme.spacing(2.5),
  height: theme.spacing(2.5),
  paddingInline: theme.spacing(0.75),
  borderRadius: theme.spacing(1.25),
  backgroundColor: alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.12 : 0.08),
  color: theme.palette.warning.main,
  fontSize: theme.typography.pxToRem(11),
  fontWeight: 700,
  lineHeight: 1,
  flexShrink: 0,
}));

/**
 * Entrance animation for the popover's main thumbnail. Replays whenever the
 * running job changes (the thumbnail is keyed by input path), so the finished
 * job's thumbnail is visually replaced by the next job's with a soft fade/zoom.
 * @const {Keyframes} thumbnailSwapIn
 */
const thumbnailSwapIn = keyframes`
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
`;

/**
 * Small rounded thumbnail of the in-progress job's source file, rendered beside
 * the popover text. Crops via `objectFit: cover` so the preview always fills the
 * frame regardless of the source aspect ratio.
 * @const PopoverThumb
 */
export const PopoverThumb = styled('img')(({ theme }) => ({
  width: theme.typography.pxToRem(72),
  height: theme.typography.pxToRem(44),
  flexShrink: 0,
  objectFit: 'cover',
  display: 'block',
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  animation: `${thumbnailSwapIn} 0.3s ease-out backwards`,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));

/**
 * Left-pointing arrow pinned to the left edge of the popover card, aimed at the
 * activity blip it is anchored to (the card is vertically centered on the
 * blip). Rendered as a rotated square whose fill and border match the card so
 * the tip reads as part of it.
 * @const PopoverArrow
 */
export const PopoverArrow = styled(Box)(({ theme }) => ({
  position: 'absolute',
  left: `-${theme.typography.pxToRem(7)}`,
  top: '50%',
  width: theme.typography.pxToRem(12),
  height: theme.typography.pxToRem(12),
  backgroundColor: theme.palette.background.paper,
  borderLeft: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  transform: 'translateY(-50%) rotate(45deg)',
  zIndex: 1,
}));

/**
 * Entrance animation for a pile slot. Newly mounted slots (a queued job sliding
 * into view as the batch advances) fade in from the right with a slight settle.
 * @const {Keyframes} pileSlotIn
 */
const pileSlotIn = (theme: Theme) => keyframes`
  from { opacity: 0; transform: translateX(${theme.typography.pxToRem(10)}); }
  to { opacity: 1; transform: translateX(0); }
`;

/**
 * One slot in the overlapping pending-job thumbnail pile: a fixed-size rounded
 * box holding the resolved preview (`$src`) or a neutral placeholder while
 * loading / when the file has no usable preview, overlapping the previous slot.
 * The entrance animation is staggered per slot via `$delay`, so as the running
 * job finishes and the pile advances, the next queued thumbnails slide in one
 * after the other. Slots are keyed by input path, so already-visible slots are
 * preserved and do not replay their animation.
 * @const PopoverPileThumb
 */
export const PopoverPileThumb = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$src' && prop !== '$delay',
})<{ $src?: string | null; $delay?: number }>(({ theme, $src, $delay }) => ({
  width: theme.typography.pxToRem(32),
  height: theme.typography.pxToRem(32),
  flexShrink: 0,
  borderRadius: theme.shape.borderRadius,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  backgroundColor: $src ? undefined : theme.palette.action.hover,
  backgroundImage: $src ? `url(${$src})` : undefined,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  marginLeft: `-${theme.typography.pxToRem(10)}`,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  animation: `${pileSlotIn(theme)} 0.25s ease-out backwards`,
  animationDelay: `${$delay ?? 0}ms`,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
  '&:first-of-type': { marginLeft: 0 },
}));

/** Job title at the top of the popover card. @const PopoverTitle */
export const PopoverTitle = styled(Typography)<{ component?: React.ElementType }>(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

/** Row holding the thumbnail and the text column of the popover card. @const PopoverBody */
export const PopoverBody = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1.5),
  alignItems: 'flex-start',
}));

/** Text column of the popover card (status, badges and file name). @const PopoverTextColumn */
export const PopoverTextColumn = styled(Box)(() => ({
  minWidth: 0,
  flex: 1,
}));

/** Row holding the status caption and the trailing badges. @const PopoverStatusRow */
export const PopoverStatusRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
}));

/** Cluster of trailing badges (parallel count, paused tag). @const PopoverBadges */
export const PopoverBadges = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  flexShrink: 0,
}));

/** Italic "paused" tag shown next to the status caption. @const PopoverPausedText */
export const PopoverPausedText = styled(Typography)(() => ({
  fontStyle: 'italic',
}));

/** File name shown under the status caption. @const PopoverFileName */
export const PopoverFileName = styled(Typography)(({ theme }) => ({
  display: 'block',
  marginTop: theme.spacing(0.25),
}));

/** Wrapper around the progress bar (or the "starting" caption). @const PopoverProgress */
export const PopoverProgress = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

/** Row holding the overlapping pile of pending-job thumbnails. @const PopoverPile */
export const PopoverPile = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginTop: theme.spacing(1),
}));

/** "+N" caption shown when more pending jobs than fit on the pile row. @const PopoverPileCount */
export const PopoverPileCount = styled(Typography)(({ theme }) => ({
  marginLeft: theme.spacing(1),
}));
