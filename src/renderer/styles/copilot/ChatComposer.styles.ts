import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

/**
 * Bottom-pinned composer bar. Sits below the conversation scroller and owns the
 * attachment chips, the Lexical input, and the action row.
 */
export const ComposerBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  gap: theme.spacing(1),
  paddingInline: theme.spacing(1),
  paddingBottom: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  [theme.breakpoints.up('sm')]: { paddingInline: theme.spacing(2) },
  [theme.breakpoints.up('md')]: { paddingInline: theme.spacing(3) },
  // The primary accent sits below the WCAG AA 4.5:1 minimum on the default background
  // (about 4.4:1 in light mode, 4.1:1 in dark). Use the darker shade on light surfaces
  // and the lighter shade on dark surfaces so the text buttons clear the threshold.
  '& .MuiButton-text': {
    color: theme.palette.mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.light,
  },
}));

/** Wraps the removable attachment chips above the input. */
export const AttachmentRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(0.5),
  paddingTop: theme.spacing(1),
}));

/** Row holding the attachment/settings actions below the input. */
export const ActionsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: theme.spacing(1),
  paddingInline: theme.spacing(0.5),
  flexWrap: 'wrap',
}));

/** Left-hand cluster of secondary actions (files, folder, advanced, AI settings). */
export const LeftActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  flexWrap: 'wrap',
}));

/** Right-hand cluster of the action row: the AI connection status. */
export const RightActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  marginInlineStart: 'auto',
  paddingInline: theme.spacing(0.75),
  paddingBlock: theme.spacing(0.5),
  borderRadius: theme.typography.pxToRem(999),
  backgroundColor: theme.palette.action.hover,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  transition: theme.transitions.create(['padding-inline']),
  '&:hover .copilot-ai-status-text': {
    maxWidth: theme.typography.pxToRem(420),
    opacity: 1,
    marginInlineStart: theme.spacing(0.75),
  },
  '&:hover': {
    paddingInline: theme.spacing(1),
  },
}));

/** Caption naming the connected AI provider (or the disconnected state). */
export const ConnectionStatus = styled('span', {
  shouldForwardProp: (prop) => prop !== '$connected',
})<{ $connected?: boolean }>(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: theme.typography.pxToRem(13),
  fontWeight: 500,
  color: theme.palette.text.primary,
}));

/** Status dot: green when a provider is connected, muted otherwise. */
export const ConnectionDot = styled('span', {
  shouldForwardProp: (prop) => prop !== '$connected',
})<{ $connected?: boolean }>(({ theme, $connected }) => ({
  width: theme.spacing(0.75),
  height: theme.spacing(0.75),
  borderRadius: '50%',
  flexShrink: 0,
  backgroundColor: $connected ? theme.palette.success.light : theme.palette.text.disabled,
  boxShadow: $connected ? `0 0 0 ${theme.typography.pxToRem(4)} ${theme.palette.success.main}14` : 'none',
}));

/** Popover panel for the advanced controls (operation, query, target language). */
export const AdvancedPanel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  minWidth: theme.typography.pxToRem(280),
}));
