import { alpha, styled } from '@mui/material/styles';
import { Box } from '@mui/material';

/**
 * Rounded composer surface that holds the Lexical editor and the send button.
 * The focus ring is applied to the shell rather than the bare contenteditable so
 * keyboard focus is visible around the whole control.
 */
export const ComposerShell = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-end',
  gap: theme.spacing(1),
  paddingInline: theme.spacing(1.5),
  paddingBlock: theme.spacing(1),
  borderRadius: theme.typography.pxToRem(24),
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 ${theme.typography.pxToRem(2)} ${alpha(theme.palette.primary.main, 0.2)}`,
  },
}));

/**
 * The scrollable editor area. The Lexical contenteditable is styled through a
 * descendant selector (rather than a `styled(ContentEditable)`) so Lexical keeps
 * full control of the element's own attributes.
 */
export const EditorArea = styled(Box)(({ theme }) => ({
  position: 'relative',
  flex: 1,
  minWidth: 0,
  minHeight: theme.typography.pxToRem(24),
  maxHeight: theme.typography.pxToRem(200),
  overflowY: 'auto',
  paddingBlock: theme.typography.pxToRem(6),
  paddingInline: theme.typography.pxToRem(4),
  '& [contenteditable="true"]': {
    outline: 'none',
    border: 'none',
    minHeight: theme.typography.pxToRem(24),
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    lineHeight: 1.5,
    color: theme.palette.text.primary,
    wordBreak: 'break-word',
  },
}));

/** Lexical placeholder text, shown while the editor is empty. */
export const EditorPlaceholder = styled(Box)(({ theme }) => ({
  position: 'absolute',
  pointerEvents: 'none',
  color: theme.palette.text.disabled,
  fontSize: theme.typography.body1.fontSize,
}));
