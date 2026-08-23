import { alpha, keyframes, styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Box, Button, Typography } from '@mui/material';
import { THEMES, OVERLAY_COLORS } from '../colors';

/** Centered application logo rendered at the top of the About page. @const AboutLogo */
export const AboutLogo = styled('img')(({ theme }) => ({
  display: 'block',
  maxWidth: '100%',
  maxHeight: theme.spacing(14),
  margin: '0 auto',
  objectFit: 'contain',
  userSelect: 'none',
}));

/** Bulleted list of the app's feature highlights. @const AboutFeatureList */
export const AboutFeatureList = styled('ul')(({ theme }) => ({
  margin: 0,
  paddingInlineStart: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
}));

/** Single bullet in the feature highlight list. @const AboutFeatureItem */
export const AboutFeatureItem = styled('li')(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  lineHeight: theme.typography.body2.lineHeight,
  color: theme.palette.text.secondary,
}));

/** Label + value row for the version / built-with meta entries. @const AboutMetaRow */
export const AboutMetaRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

/** Fixed-width label shown beside each meta value. @const AboutMetaLabel */
export const AboutMetaLabel = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  width: theme.spacing(12),
  color: theme.palette.text.primary,
}));

/**
 * Every accent color from the built-in theme registry (see colors.ts), so the
 * glow cycles through all available palettes regardless of the active theme.
 * The 'dark' theme reuses the 'light' accents, so duplicates are dropped.
 * @const GLOW_COLORS
 */
const GLOW_COLORS: readonly string[] = Array.from(new Set(THEMES.flatMap((theme) => [theme.primary, theme.secondary])));

/**
 * Spins the registered `--encodex-glow-angle` custom property (declared via a
 * @property rule in About.tsx) from 0deg to 360deg, which rotates the
 * conic-gradient ring around the button.
 * @const glowAngleSpin
 */
const glowAngleSpin = keyframes`
  from {
    --encodex-glow-angle: 0deg;
  }
  to {
    --encodex-glow-angle: 360deg;
  }
`;

/**
 * Conic-gradient string built from every theme accent, with the first color
 * repeated at the end so the rotation loops seamlessly.
 * @function glowGradient
 */
const glowGradient = (): string => `conic-gradient(from var(--encodex-glow-angle), ${[...GLOW_COLORS, GLOW_COLORS[0]].join(', ')})`;

/**
 * Inline-flex wrapper that hosts the circling halo for the check-for-updates
 * CTA. Keeping the blurred conic-gradient halo (::after) on the wrapper lets
 * the solid-white button sit fully on top of it (zIndex 1), so the glow is
 * only visible around/outside the button and never through its label area.
 * @const CheckUpdatesButtonWrapper
 */
export const CheckUpdatesButtonWrapper = styled(Box)(({ theme }) => ({
  position: 'relative',
  display: 'inline-flex',
  animation: `${glowAngleSpin} 6s linear infinite`,
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: theme.typography.pxToRem(-4),
    borderRadius: theme.typography.pxToRem(12),
    background: glowGradient(),
    filter: `blur(${theme.typography.pxToRem(10)})`,
    opacity: 0.8,
    pointerEvents: 'none',
  },
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    '&::after': {
      display: 'none',
    },
  },
}));

/**
 * Outlined button with a rainbow glow that circles its border: a crisp 1px
 * conic-gradient ring (::before, punched out with an XOR mask so only the
 * frame shows). The native border is kept transparent so the rotating ring is
 * the only visible border, and the background stays solid white in every
 * state — hover/focus/active tints are layered via backgroundImage instead of
 * translucent backgroundColors. Sits above the wrapper's halo (zIndex 1) and
 * reads the --encodex-glow-angle custom property that the wrapper animates.
 * @const CheckUpdatesButton
 */
export const CheckUpdatesButton = styled(Button)(({ theme }) => ({
  position: 'relative',
  zIndex: 1,
  borderRadius: theme.typography.pxToRem(8),
  borderWidth: theme.typography.pxToRem(1),
  borderColor: 'transparent',
  backgroundColor: OVERLAY_COLORS.white,
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    borderRadius: theme.typography.pxToRem(8),
    padding: theme.typography.pxToRem(1),
    background: glowGradient(),
    WebkitMask: `linear-gradient(${OVERLAY_COLORS.white} 0 0) content-box, linear-gradient(${OVERLAY_COLORS.white} 0 0)`,
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
    pointerEvents: 'none',
  },
  '&:hover, &.Mui-focusVisible, &:active': {
    borderColor: 'transparent',
    backgroundColor: OVERLAY_COLORS.white,
    backgroundImage: `linear-gradient(${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.08)})`,
  },
}));
