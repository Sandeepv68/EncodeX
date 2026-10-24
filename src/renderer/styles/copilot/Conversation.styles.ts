import { keyframes, styled } from '@mui/material/styles';
import { Box } from '@mui/material';

const typingPulse = keyframes`
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-0.2em);
  }
`;

/**
 * Scrollable viewport for the conversation transcript.
 *
 * While the transcript is empty it stops claiming the remaining height so the
 * welcome copy and the composer can be centered together as the page's initial
 * state. Once messages arrive it expands again and owns the scrolling.
 */
export const ConversationScroll = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$empty',
})<{ $empty?: boolean }>(({ theme, $empty }) => ({
  flex: $empty ? '0 0 auto' : 1,
  minHeight: 0,
  overflowY: $empty ? 'visible' : 'auto',
  paddingInline: theme.spacing(1),
  [theme.breakpoints.up('sm')]: { paddingInline: theme.spacing(2) },
  [theme.breakpoints.up('md')]: { paddingInline: theme.spacing(3) },
}));

/** Inner column that stacks the message rows. */
export const ConversationStream = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
});

/** Positioning context for the measured virtual rows. */
export const VirtualConversationStream = styled(ConversationStream)({
  position: 'relative',
});

/** Absolutely positioned window of conversation rows. */
export const VirtualRow = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
});

/** Animated three-dot typing indicator shown while the assistant is thinking. */
export const TypingDots = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  marginInlineStart: theme.spacing(0.75),
  '& > span': {
    width: theme.spacing(0.75),
    height: theme.spacing(0.75),
    borderRadius: '50%',
    backgroundColor: theme.palette.text.secondary,
    animation: `${typingPulse} 1.2s infinite ease-in-out`,
  },
  '& > span:nth-of-type(2)': {
    animationDelay: '0.15s',
  },
  '& > span:nth-of-type(3)': {
    animationDelay: '0.3s',
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& > span': {
      animation: 'none',
      opacity: 0.8,
    },
  },
}));
