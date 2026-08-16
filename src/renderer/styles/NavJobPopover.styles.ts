/**
 * @fileoverview Styles for the navigation blip job popover card.
 */

import { styled, keyframes } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Box } from '@mui/material';
import { SHADOWS } from '../colors';

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
 * nav row it is anchored to. Rendered as a rotated square whose fill and border
 * match the card so the tip reads as part of it.
 * @const PopoverArrow
 */
export const PopoverArrow = styled(Box)(({ theme }) => ({
  position: 'absolute',
  left: `-${theme.typography.pxToRem(7)}`,
  top: theme.typography.pxToRem(20),
  width: theme.typography.pxToRem(12),
  height: theme.typography.pxToRem(12),
  backgroundColor: theme.palette.background.paper,
  borderLeft: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  transform: 'rotate(45deg)',
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
