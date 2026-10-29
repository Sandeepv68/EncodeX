/**
 * @fileoverview Styles for the Copilot page.
 *
 * The page is a single flex row: the decorative glow layer (a stack of slowly
 * drifting radial-gradient orbs) sits behind the conversation column. The
 * orbs share one keyframe animation, staggered per orb through its duration
 * and delay.
 */

import { keyframes, styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Alert, Box } from '@mui/material';
import { SHADOWS } from '../../shared/theme/colors';

/**
 * Slow drifting animation shared by the decorative glow orbs.
 *
 * Only `transform` is animated. Animating `filter` or `border-radius` would
 * force the orb to be re-rasterised on every frame, and the orbs are large
 * enough (up to ~40vw) that the repaint cost alone drops the Copilot page to
 * single-digit frames per second on software rendering. The hue and the
 * irregular silhouette are baked into the static styles below instead, so the
 * drift still reads as a living glow at compositor cost.
 *
 * @const {Keyframes} copilotPageTravel
 */
const copilotPageTravel = keyframes`
  0% {
    transform: translate(0vw, 0vh) scale(0.82) rotate(0deg);
  }
  25% {
    transform: translate(9vw, -6vh) scale(1.16) rotate(12deg);
  }
  50% {
    transform: translate(-6vw, 7vh) scale(0.94) rotate(-16deg);
  }
  75% {
    transform: translate(11vw, 4vh) scale(1.24) rotate(9deg);
  }
  100% {
    transform: translate(0vw, 0vh) scale(0.82) rotate(0deg);
  }
`;

/**
 * Radial-gradient presets for the decorative glow orbs, keyed by variant.
 *
 * The gradients fade to transparent on their own, so the orbs need no blur
 * filter to look soft. A `filter: blur()` on the layer was the single
 * most expensive part of the effect: it forced the whole (very large)
 * blurred surface to be re-rasterised on every animated frame.
 *
 * @const {Record<number, (theme: Theme) => string>} ORB_GRADIENTS
 */
const ORB_GRADIENTS: Record<number, (theme: Theme) => string> = {
  1: (theme) =>
    `radial-gradient(circle closest-side, ${theme.palette.primary.main}dd 0%, ${theme.palette.secondary.main}aa 22%, ${theme.palette.secondary.main}44 50%, ${theme.palette.secondary.main}11 75%, transparent 100%)`,
  2: (theme) =>
    `radial-gradient(circle closest-side, ${theme.palette.error.main}dd 0%, ${theme.palette.warning.main}aa 22%, ${theme.palette.warning.main}44 50%, ${theme.palette.warning.main}11 75%, transparent 100%)`,
  3: (theme) =>
    `radial-gradient(circle closest-side, ${theme.palette.success.main}dd 0%, ${theme.palette.info.main}aa 22%, ${theme.palette.info.main}44 50%, ${theme.palette.info.main}11 75%, transparent 100%)`,
  4: (theme) =>
    `radial-gradient(circle closest-side, ${theme.palette.secondary.main}dd 0%, ${theme.palette.primary.light}aa 22%, ${theme.palette.primary.light}44 50%, ${theme.palette.primary.light}11 75%, transparent 100%)`,
  5: (theme) =>
    `radial-gradient(circle closest-side, ${theme.palette.info.main}dd 0%, ${theme.palette.warning.light}aa 22%, ${theme.palette.warning.light}44 50%, ${theme.palette.warning.light}11 75%, transparent 100%)`,
  6: (theme) =>
    `radial-gradient(circle closest-side, ${theme.palette.warning.main}dd 0%, ${theme.palette.error.light}aa 22%, ${theme.palette.error.light}44 50%, ${theme.palette.error.light}11 75%, transparent 100%)`,
};

/**
 * Page root: a full-height flex row that cancels the route padding so the
 * saved-chats panel can sit flush to the edges. It is also the positioning
 * context for the glow layer, which overlays the conversation column.
 * @const CopilotPage
 */
export const CopilotPage = styled(Box)(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'row',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  marginInline: theme.spacing(-2),
  marginTop: theme.spacing(-2),
  [theme.breakpoints.up('sm')]: {
    marginInline: theme.spacing(-3),
    marginTop: theme.spacing(-3),
  },
}));

/**
 * Full-bleed layer holding the drifting glow orbs. It is never interactive
 * and sits behind the conversation column.
 *
 * No `filter` is applied here on purpose: blurring the layer would re-rasterise
 * the entire surface on every animated frame. The orbs' own gradients fade out
 * on their own, so they read as soft glows without it.
 *
 * @const CopilotGlowLayer
 */
export const CopilotGlowLayer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  opacity: theme.palette.mode === 'dark' ? 0.65 : 0.42,
  pointerEvents: 'none',
  overflow: 'hidden',
  mixBlendMode: 'normal',
}));

/**
 * One decorative glow orb: an absolutely positioned circle filled with a
 * radial gradient that drifts across the page. The gradient preset is picked
 * by `$variant`, the geometry by the transient sizing and placement props.
 *
 * Only `transform` is animated, so the orb is promoted to its own compositor
 * layer and the drift costs no repaint.
 *
 * @const CopilotGlowOrb
 */
export const CopilotGlowOrb = styled(Box, {
  shouldForwardProp: (prop) => typeof prop === 'string' && !prop.startsWith('$'),
})<{
  $variant: number;
  $duration: number;
  $delay: string;
  $size: string;
  $max: number;
  $min: number;
  $left?: string;
  $top?: string;
  $right?: string;
  $bottom?: string;
}>(({ theme, $variant, $duration, $delay, $size, $max, $min, $left, $top, $right, $bottom }) => ({
  position: 'absolute',
  borderRadius: '50%',
  mixBlendMode: theme.palette.mode === 'dark' ? 'screen' : 'soft-light',
  width: $size,
  height: $size,
  maxWidth: theme.typography.pxToRem($max),
  maxHeight: theme.typography.pxToRem($max),
  minWidth: theme.typography.pxToRem($min),
  minHeight: theme.typography.pxToRem($min),
  background: ORB_GRADIENTS[$variant](theme),
  left: $left,
  top: $top,
  right: $right,
  bottom: $bottom,
  willChange: 'transform',
  animation: `${copilotPageTravel} ${$duration}s infinite ease-in-out`,
  animationDelay: $delay,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));

/**
 * Conversation column: the scrollable transcript plus the pinned composer.
 * The content is centred while the transcript is empty and starts at the top
 * once a conversation exists (`$hasChat`).
 * @const CopilotConversationColumn
 */
export const CopilotConversationColumn = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$hasChat',
})<{ $hasChat?: boolean }>(({ theme, $hasChat }) => ({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  justifyContent: $hasChat ? 'flex-start' : 'center',
  paddingInline: theme.spacing(2),
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    paddingInline: theme.spacing(3),
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(3),
  },
}));

/**
 * Wrapper that insets the inline error / notice alerts from the conversation
 * column edges.
 * @const CopilotAlertWrapper
 */
export const CopilotAlertWrapper = styled(Box)(({ theme }) => ({
  paddingInline: theme.spacing(2),
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),
}));

/**
 * Inline error / notice alert with a soft elevation and a full-width message.
 * @const CopilotAlert
 */
export const CopilotAlert = styled(Alert)(({ theme }) => ({
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  '& .MuiAlert-message': { width: '100%', fontWeight: 600 },
}));
