/**
 * @fileoverview Styles for the Copilot aurora backdrop.
 *
 * The aurora is a stack of four slowly morphing, heavily blurred gradient blobs
 * with a sparkle field painted on a canvas above them. It fills the page while
 * the composer is idle and shrinks to a short band above the composer once a
 * chat is running, where a gradient overlay dissolves its top edge into the
 * page background.
 */

import { alpha, keyframes, styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { AURORA_COLORS } from '../../../shared/theme/colors';

/** Organic drift shared by every aurora blob. @const auroraMorph */
export const auroraMorph = keyframes`
  0% {
    transform: translate(0, 0) scale(1) rotate(0deg);
  }
  33% {
    transform: translate(3vw, -4vh) scale(1.15) rotate(120deg);
  }
  66% {
    transform: translate(-2vw, 3vh) scale(0.9) rotate(240deg);
  }
  100% {
    transform: translate(1vw, -1vh) scale(1.05) rotate(360deg);
  }
`;

/**
 * Root layer holding the aurora. It is anchored to the bottom of the page and
 * animates its height so the backdrop can shrink to the composer.
 * @const GeminiAuroraLayer
 */
export const GeminiAuroraLayer = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$compact',
})<{ $compact: boolean }>(({ theme, $compact }) => ({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: $compact ? '30%' : '100%',
  pointerEvents: 'none',
  zIndex: 0,
  overflow: 'hidden',
  transition: 'height 600ms ease',
}));

/**
 * Blurred container that holds the four gradient blobs.
 * @const GeminiAuroraBlobs
 */
export const GeminiAuroraBlobs = styled(Box)(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  filter: `blur(${theme.typography.pxToRem(90)})`,
  opacity: 0.85,
  '@media (prefers-reduced-motion: reduce)': {
    filter: `blur(${theme.typography.pxToRem(24)})`,
  },
}));

/**
 * A single morphing gradient blob. Its placement, size and duration vary per
 * blob, so they are passed in as transient props.
 * @const GeminiAuroraBlob
 */
export const GeminiAuroraBlob = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$fill' && prop !== '$duration' && prop !== '$delay' && prop !== '$placement',
})<{
  $fill: string;
  $duration: number;
  $delay: string;
  $placement: {
    top?: string;
    left?: string;
    right?: string;
    bottom?: string;
    size: string;
  };
}>(({ theme, $fill, $duration, $delay, $placement }) => ({
  position: 'absolute',
  width: $placement.size,
  height: $placement.size,
  top: $placement.top,
  left: $placement.left,
  right: $placement.right,
  bottom: $placement.bottom,
  borderRadius: '50%',
  background: $fill,
  mixBlendMode: 'screen',
  animation: `${auroraMorph} ${$duration}s ease-in-out infinite alternate`,
  animationDelay: $delay,
  // The drift is decorative, so it is dropped entirely for users who have asked
  // the OS for reduced motion.
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));

/**
 * Sparkle canvas painted above the blobs.
 * @const GeminiAuroraCanvas
 */
export const GeminiAuroraCanvas = styled('canvas')({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
});

/**
 * Gradient overlay that dissolves the aurora's top edge into the page
 * background. It is shown instantly when the aurora shrinks and faded out
 * slowly once the aurora has grown back to its full size.
 * @const GeminiAuroraEdge
 */
export const GeminiAuroraEdge = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$visible' && prop !== '$instant',
})<{ $visible: boolean; $instant: boolean }>(({ theme, $visible, $instant }) => ({
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  height: '100%',
  background: `linear-gradient(to bottom, ${theme.palette.background.default} 0%, ${alpha(
    theme.palette.background.default,
    0.9,
  )} 12%, ${alpha(theme.palette.background.default, 0.75)} 26%, ${alpha(theme.palette.background.default, 0.55)} 42%, ${alpha(
    theme.palette.background.default,
    0.34,
  )} 58%, ${alpha(theme.palette.background.default, 0.16)} 76%, transparent 100%)`,
  opacity: $visible ? 1 : 0,
  transition: $instant ? 'none' : 'opacity 1200ms ease',
  pointerEvents: 'none',
}));

/** The blob fills, indexed by blob order. @const AURORA_BLOB_FILLS */
export const AURORA_BLOB_FILLS: readonly string[] = AURORA_COLORS.blobs;
