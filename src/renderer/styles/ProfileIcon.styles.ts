import { styled } from '@mui/material/styles';
import type { ElementType } from 'react';
import { Box } from '@mui/material';
import { OptionIcon, FormatBadge } from './ProfileSelector.styles';

/**
 * Tile that frames a profile logo in the dropdown options: a faint grey plate
 * with a hairline border, holding the brand mark centred inside.
 * The tile grows sideways for wide marks (format badges, wordmark logos)
 * instead of clipping them.
 * An optional `$color` tints the mark itself (used by the FontAwesome glyphs).
 * @const LogoTile
 */
export const LogoTile = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color?: string }>(({ theme, $color }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  // The tile keeps a square footprint so the mark sits in an evenly padded
  // box, and it centres itself in the option row. `width: fit-content` with a
  // matching minimum lets wide marks (format badges, wordmark logos) widen
  // the tile instead of being clipped.
  alignSelf: 'center',
  width: 'fit-content',
  minWidth: theme.typography.pxToRem(36),
  height: theme.typography.pxToRem(36),
  // The brand glyph is sized in `em`, so the tile's font size sets its size.
  fontSize: theme.typography.pxToRem(22),
  paddingInline: theme.typography.pxToRem(6),
  borderRadius: theme.typography.pxToRem(7),
  // A faint plate: the background barely lifts off the dropdown surface and
  // the border is a hairline, so the brand mark stays the focus.
  backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.mode === 'dark' ? theme.palette.grey[700] : theme.palette.grey[300]}`,
  ...($color ? { color: $color } : {}),
  // The format badge brings its own trailing margin, which would push the
  // mark off centre inside the tile.
  '& > *': { marginRight: 0 },
}));

/**
 * Compact format badge used inside the logo tile: the full-size badge would
 * not fit the tile, so the badge drops to a smaller variant.
 * @const TileFormatBadge
 */
export const TileFormatBadge = styled(FormatBadge)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(26),
  height: theme.typography.pxToRem(20),
  // The badge is centred in the logo tile, so the trailing margin it uses
  // outside the tile would leave a gap on its right.
  marginRight: 0,
  paddingInline: theme.typography.pxToRem(3),
  fontSize: theme.typography.pxToRem(10),
  // Tracking would add a trailing gap after the last character, which reads
  // as extra space to the right of the badge.
  letterSpacing: 0,
  borderRadius: theme.typography.pxToRem(5),
}));

/** Option icon tinted with the resolved brand color. */
export const ColoredOptionIcon = styled(OptionIcon, {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color: string }>(({ $color }) => ({
  color: $color,
}));

/** Wrapper for the profile icon shown inside the active-profile chip. */
export const ChipIconBox = styled(Box)<{ component?: ElementType }>(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'stretch',
  fontSize: theme.typography.pxToRem(30),
  lineHeight: 1,
}));

/** Chip icon wrapper tinted with the resolved brand color. */
export const ColoredChipIconBox = styled(ChipIconBox, {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color: string; component?: ElementType }>(({ $color }) => ({
  color: $color,
}));
