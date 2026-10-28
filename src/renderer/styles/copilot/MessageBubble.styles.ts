import { keyframes, styled } from '@mui/material/styles';
import { Box, Paper } from '@mui/material';
import { SHADOWS } from '../../../shared/theme/colors';

const bubbleSlideIn = (isUser: boolean) => keyframes`
  0% {
    opacity: 0;
    transform: scale(0.7) translateY(${(12 / 16).toFixed(4)}rem);
  }

  70% {
    opacity: 1;
    transform: scale(1.03) translateY(-${(1 / 16).toFixed(4)}rem);
  }

  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
`;

/**
 * One conversation row. User bubbles align to the end (right in LTR), assistant
 * and thought bubbles to the start.
 */
export const BubbleRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$isUser',
})<{ $isUser: boolean }>(({ $isUser }) => ({
  display: 'flex',
  justifyContent: $isUser ? 'flex-end' : 'flex-start',
  width: '100%',
}));

/** The bubble surface itself. */
export const Bubble = styled(Paper, {
  shouldForwardProp: (prop) => prop !== '$isUser',
})<{ $isUser: boolean }>(({ theme, $isUser }) => ({
  maxWidth: '85%',
  paddingInline: theme.spacing(2),
  paddingBlock: theme.spacing(1.5),
  borderRadius: $isUser
    ? `${theme.typography.pxToRem(18)} ${theme.typography.pxToRem(18)} ${theme.typography.pxToRem(4)} ${theme.typography.pxToRem(18)}`
    : `${theme.typography.pxToRem(18)} ${theme.typography.pxToRem(18)} ${theme.typography.pxToRem(18)} ${theme.typography.pxToRem(4)}`,
  backgroundColor: $isUser ? theme.palette.primary.main : theme.palette.background.paper,
  color: $isUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
  border: $isUser ? undefined : `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  transformOrigin: $isUser ? 'bottom right' : 'bottom left',
  animation: `${bubbleSlideIn($isUser)} 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
  willChange: 'transform, opacity',
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));
