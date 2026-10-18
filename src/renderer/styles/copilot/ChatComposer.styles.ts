import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

/**
 * Bottom-pinned composer bar. Sits below the conversation scroller and owns the
 * attachment chips, the Lexical input, and the action row.
 */
export const ComposerBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  paddingInline: theme.spacing(1),
  paddingBottom: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  [theme.breakpoints.up('sm')]: { paddingInline: theme.spacing(2) },
  [theme.breakpoints.up('md')]: { paddingInline: theme.spacing(3) },
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
}));

/** Caption naming the connected AI provider (or the disconnected state). */
export const ConnectionStatus = styled('span', {
  shouldForwardProp: (prop) => prop !== '$connected',
})<{ $connected?: boolean }>(({ theme, $connected }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  fontSize: theme.typography.pxToRem(13),
  fontWeight: $connected ? 600 : 400,
  color: $connected ? theme.palette.success.main : theme.palette.text.secondary,
}));

/** Status dot: green when a provider is connected, muted otherwise. */
export const ConnectionDot = styled('span', {
  shouldForwardProp: (prop) => prop !== '$connected',
})<{ $connected?: boolean }>(({ theme, $connected }) => ({
  width: theme.spacing(0.75),
  height: theme.spacing(0.75),
  borderRadius: '50%',
  flexShrink: 0,
  backgroundColor: $connected ? theme.palette.success.main : theme.palette.text.disabled,
}));

/** Popover panel for the advanced controls (operation, query, target language). */
export const AdvancedPanel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  minWidth: theme.typography.pxToRem(280),
}));
