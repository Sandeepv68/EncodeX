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
 * @const {Keyframes} copilotPageTravel
 */
const copilotPageTravel = keyframes`
  0% {
    transform: translate(0vw, 0vh) scale(0.8) rotate(0deg);
    border-radius: 50%;
    filter: hue-rotate(0deg) saturate(1.15);
  }
  8% {
    transform: translate(12vw, -8vh) scale(1.18) rotate(14deg);
    border-radius: 42% 58% 38% 62%;
    filter: hue-rotate(24deg) saturate(1.35);
  }
  16% {
    transform: translate(-6vw, 14vh) scale(0.94) rotate(-18deg);
    border-radius: 58% 42% 64% 36%;
    filter: hue-rotate(-32deg) saturate(1.28);
  }
  24% {
    transform: translate(18vw, 10vh) scale(1.28) rotate(26deg);
    border-radius: 36% 64% 42% 58%;
    filter: hue-rotate(42deg) saturate(1.42);
  }
  32% {
    transform: translate(-14vw, -6vh) scale(1.08) rotate(-28deg);
    border-radius: 62% 38% 56% 44%;
    filter: hue-rotate(-18deg) saturate(1.32);
  }
  40% {
    transform: translate(8vw, 18vh) scale(0.88) rotate(22deg);
    border-radius: 44% 56% 38% 62%;
    filter: hue-rotate(36deg) saturate(1.26);
  }
  48% {
    transform: translate(-10vw, 8vh) scale(1.22) rotate(-34deg);
    border-radius: 56% 44% 62% 38%;
    filter: hue-rotate(-28deg) saturate(1.38);
  }
  56% {
    transform: translate(16vw, -12vh) scale(0.96) rotate(30deg);
    border-radius: 38% 62% 44% 56%;
    filter: hue-rotate(48deg) saturate(1.32);
  }
  64% {
    transform: translate(-4vw, -16vh) scale(1.14) rotate(-16deg);
    border-radius: 64% 36% 58% 42%;
    filter: hue-rotate(-22deg) saturate(1.28);
  }
  72% {
    transform: translate(10vw, 6vh) scale(0.9) rotate(38deg);
    border-radius: 42% 58% 36% 64%;
    filter: hue-rotate(34deg) saturate(1.24);
  }
  80% {
    transform: translate(-18vw, 12vh) scale(1.26) rotate(-26deg);
    border-radius: 58% 42% 64% 36%;
    filter: hue-rotate(-38deg) saturate(1.36);
  }
  88% {
    transform: translate(6vw, -10vh) scale(1.02) rotate(20deg);
    border-radius: 44% 56% 42% 58%;
    filter: hue-rotate(28deg) saturate(1.3);
  }
  100% {
    transform: translate(-8vw, 4vh) scale(0.84) rotate(-12deg);
    border-radius: 50%;
    filter: hue-rotate(-14deg) saturate(1.18);
  }
`;

/**
 * Radial-gradient presets for the decorative glow orbs, keyed by variant.
 * @const {Record<number, (theme: Theme) => string>} ORB_GRADIENTS
 */
const ORB_GRADIENTS: Record<number, (theme: Theme) => string> = {
  1: (theme) => `radial-gradient(circle, ${theme.palette.primary.main}dd 0%, ${theme.palette.secondary.main}bb 30%, transparent 70%)`,
  2: (theme) => `radial-gradient(circle, ${theme.palette.error.main}dd 0%, ${theme.palette.warning.main}bb 35%, transparent 72%)`,
  3: (theme) => `radial-gradient(circle, ${theme.palette.success.main}dd 0%, ${theme.palette.info.main}bb 38%, transparent 74%)`,
  4: (theme) => `radial-gradient(circle, ${theme.palette.secondary.main}dd 0%, ${theme.palette.primary.light}bb 40%, transparent 76%)`,
  5: (theme) => `radial-gradient(circle, ${theme.palette.info.main}dd 0%, ${theme.palette.warning.light}bb 44%, transparent 78%)`,
  6: (theme) => `radial-gradient(circle, ${theme.palette.warning.main}dd 0%, ${theme.palette.error.light}bb 46%, transparent 80%)`,
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
 * Full-bleed layer holding the drifting glow orbs. It is blurred, never
 * interactive, and sits behind the conversation column.
 * @const CopilotGlowLayer
 */
export const CopilotGlowLayer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  filter: `blur(${theme.typography.pxToRem(140)})`,
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
  animation: `${copilotPageTravel} ${$duration}s infinite ease-in-out`,
  animationDelay: $delay,
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
