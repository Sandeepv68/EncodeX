/**
 * @fileoverview Styles for the navigation blip job popover card.
 */

import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

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
 * One slot in the overlapping pending-job thumbnail pile: a fixed-size rounded
 * box holding the resolved preview (`$src`) or a neutral placeholder while
 * loading / when the file has no usable preview, overlapping the previous slot.
 * @const PopoverPileThumb
 */
export const PopoverPileThumb = styled(Box, { shouldForwardProp: (prop) => prop !== '$src' })<{ $src?: string | null }>(
  ({ theme, $src }) => ({
    width: theme.typography.pxToRem(32),
    height: theme.typography.pxToRem(32),
    flexShrink: 0,
    borderRadius: 1,
    border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
    backgroundColor: $src ? undefined : theme.palette.action.hover,
    backgroundImage: $src ? `url(${$src})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    marginLeft: `-${theme.typography.pxToRem(10)}`,
    '&:first-of-type': { marginLeft: 0 },
  }),
);
