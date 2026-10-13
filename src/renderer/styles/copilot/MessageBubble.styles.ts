import { styled } from '@mui/material/styles';
import { Box, Paper } from '@mui/material';

/**
 * One conversation row. User bubbles align to the end (right in LTR), assistant
 * and thought bubbles to the start.
 */
export const BubbleRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$isUser',
})<{ $isUser: boolean }>(({ theme, $isUser }) => ({
  display: 'flex',
  justifyContent: $isUser ? 'flex-end' : 'flex-start',
  width: '100%',
  marginBottom: theme.spacing(2),
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
  backgroundColor: $isUser
    ? theme.palette.primary.main
    : theme.palette.mode === 'dark'
      ? theme.palette.background.paper
      : theme.palette.grey[100],
  color: $isUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
  border: $isUser ? undefined : `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  wordBreak: 'break-word',
}));
