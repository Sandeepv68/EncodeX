/**
 * @fileoverview Styles for the Copilot page.
 *
 * The page is a single flex row: the decorative glow layer (a stack of slowly
 * drifting radial-gradient orbs) sits behind the conversation column. The
 * orbs share one keyframe animation, staggered per orb through its duration
 * and delay.
 */

import { styled } from '@mui/material/styles';
import { Alert, Box } from '@mui/material';
import { SHADOWS } from '../../shared/theme/colors';

/** Full-viewport flex row hosting the Copilot page content. @const CopilotPage */
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
