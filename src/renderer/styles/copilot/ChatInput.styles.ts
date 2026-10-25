import { alpha, styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { SHADOWS } from '../../colors';

/**
 * Rounded composer surface that holds the Lexical editor and the inline send
 * and plan buttons.
 * The focus ring is applied to the shell rather than the bare contenteditable so
 * keyboard focus is visible around the whole control.
 */
export const ComposerShell = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'nowrap',
  gap: theme.spacing(0.5),
  paddingBlock: theme.spacing(0.375),
  paddingInline: theme.spacing(0.75),
  borderRadius: theme.typography.pxToRem(999),
  backgroundColor: theme.palette.background.paper,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  transition: theme.transitions.create(['box-shadow', 'border-color']),
  cursor: 'text',
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 ${theme.typography.pxToRem(2)} ${alpha(theme.palette.primary.main, 0.2)}, ${
      theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_HOVER_DARK : SHADOWS(theme).SOFT_HOVER_LIGHT
    }`,
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
  color: theme.palette.text.secondary,
  fontSize: theme.typography.body1.fontSize,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));
