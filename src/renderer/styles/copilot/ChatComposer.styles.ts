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

/** Row holding the attachment/settings actions on the left and Plan on the right. */
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

/** Popover panel for the advanced controls (operation, query, target language). */
export const AdvancedPanel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  minWidth: theme.typography.pxToRem(280),
}));
