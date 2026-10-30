import type { ElementType } from 'react';
import { styled } from '@mui/material/styles';
import { Box, ButtonBase, Chip, IconButton, Typography } from '@mui/material';
import { SHADOWS } from '../../../shared/theme/colors';

/** Width of the panel when open, in pixels. */
const PANEL_WIDTH_PX = 320;

/**
 * Outer shell of the drawer. It collapses to zero width while closed so the
 * conversation content is never resized, re-wrapped or re-laid out.
 */
export const DrawerShell = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$open',
})<{ $open: boolean }>(({ theme, $open }) => ({
  width: $open ? theme.typography.pxToRem(PANEL_WIDTH_PX) : 0,
  flexShrink: 0,
  height: '100%',
  overflow: 'hidden',
  transition: 'width 225ms ease',
  isolation: 'isolate',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
}));

/** The sliding panel itself. */
export const DrawerPanel = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$open',
})<{ $open: boolean; component?: ElementType }>(({ theme, $open }) => ({
  width: theme.typography.pxToRem(PANEL_WIDTH_PX),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  borderRight: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  backgroundImage: 'none',
  boxShadow: $open ? theme.shadows[6] : 'none',
  transition: 'box-shadow 225ms ease',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
}));

/** Header row with the panel title and the close button. */
export const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
}));

/** Title of the drawer panel. */
export const DrawerTitle = styled(Typography)<{ component?: ElementType }>({
  fontWeight: 700,
});

/** Scrollable list of saved conversations. */
export const DrawerList = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(1),
}));

/** Message shown when no conversation has been saved yet. */
export const EmptyChatsText = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(1),
}));

/** Card holding a single saved conversation. */
export const SavedChatItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  borderRadius: theme.shape.borderRadius,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  backgroundImage: 'none',
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  transition: 'background-color 150ms ease, box-shadow 150ms ease',
  '&:hover': {
    backgroundColor: theme.palette.action.selected,
    boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_HOVER_DARK : SHADOWS(theme).SOFT_HOVER_LIGHT,
  },
  '&:focus-within': { backgroundColor: theme.palette.action.selected },
}));

/** Clickable region that opens a saved conversation. */
export const SavedChatOpen = styled(ButtonBase)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  textAlign: 'start',
}));

/** Column holding the title and the metadata of a saved conversation. */
export const SavedChatBody = styled(Box)({
  flex: 1,
  minWidth: 0,
});

/** Title of a saved conversation, truncated to a single line. */
export const SavedChatTitle = styled(Typography)<{ component?: ElementType }>({
  display: 'block',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

/** Row with the message count and the relative save time. */
export const SavedChatMeta = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginTop: theme.spacing(0.5),
  minWidth: 0,
}));

/** Chip showing how many messages a saved conversation holds. */
export const SavedChatCountChip = styled(Chip)<{ component?: ElementType }>(({ theme }) => ({
  height: theme.typography.pxToRem(24),
  flexShrink: 0,
  paddingInline: theme.spacing(0.5),
  fontWeight: 600,
  '& .MuiChip-icon': {
    fontSize: theme.typography.pxToRem(11),
    marginLeft: theme.spacing(0.75),
    marginRight: theme.spacing(-0.25),
  },
  '& .MuiChip-label': { paddingInline: theme.spacing(0.75), lineHeight: 1 },
}));

/** Wrapper around the provider logo shown on a saved conversation. */
export const SavedChatProvider = styled(Box)<{ component?: ElementType }>({
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'center',
  flexShrink: 0,
});

/** Button that deletes a saved conversation. */
export const DeleteChatButton = styled(IconButton)(({ theme }) => ({
  marginRight: theme.spacing(0.5),
  flexShrink: 0,
}));
