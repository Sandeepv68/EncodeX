import { alpha, styled } from '@mui/material/styles';
import { Box } from '@mui/material';

/**
 * Rounded composer surface that holds the Lexical editor and the inline send
 * and plan buttons.
 * The focus ring is applied to the shell rather than the bare contenteditable so
 * keyboard focus is visible around the whole control.
 */
export const ComposerShell = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  paddingInline: theme.spacing(1.5),
  paddingBlock: theme.spacing(1),
  borderRadius: theme.typography.pxToRem(24),
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
  cursor: 'text',
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 ${theme.typography.pxToRem(2)} ${alpha(theme.palette.primary.main, 0.2)}`,
  },
}));

/**
 * The single-line editor area. The Lexical contenteditable is styled through a
 * descendant selector (rather than a `styled(ContentEditable)`) so Lexical keeps
 * full control of the element's own attributes. The area is tall enough to be a
 * comfortable click target while the editable line stays vertically centred; the
 * text itself never wraps (`pre`, overriding Lexical's inline `pre-wrap`) so the
 * composer remains a one-line field.
 */
export const EditorArea = styled(Box)(({ theme }) => ({
  position: 'relative',
  flex: 1,
  minWidth: 0,
  height: theme.typography.pxToRem(32),
  '& [contenteditable="true"]': {
    outline: 'none',
    border: 'none',
    width: '100%',
    height: theme.typography.pxToRem(32),
    lineHeight: theme.typography.pxToRem(32),
    paddingInline: theme.typography.pxToRem(4),
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    color: theme.palette.text.primary,
    whiteSpace: 'pre !important',
    overflow: 'hidden',
  },
  '& p': { margin: 0, lineHeight: 'inherit' },
}));

/** Lexical placeholder text, shown while the editor is empty. */
export const EditorPlaceholder = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  insetInlineStart: 0,
  insetInlineEnd: 0,
  height: theme.typography.pxToRem(32),
  lineHeight: theme.typography.pxToRem(32),
  paddingInline: theme.typography.pxToRem(4),
  pointerEvents: 'none',
  color: theme.palette.text.disabled,
  fontSize: theme.typography.body1.fontSize,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));
