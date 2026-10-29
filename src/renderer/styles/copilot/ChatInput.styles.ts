import { alpha, styled } from '@mui/material/styles';
import { Box, IconButton } from '@mui/material';
import { SHADOWS } from '../../../shared/theme/colors';

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
 * The single-line editor row. It holds the optional reset button and the
 * Lexical editable field side by side, so it is a horizontal flex row. The
 * Lexical contenteditable is styled through a
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
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'nowrap',
  gap: theme.spacing(0.5),
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

/**
 * Wrapper around the "reset conversation" icon button. Rendered as an inline
 * span so it can sit inside the tooltip trigger without breaking the row.
 * @const ResetButtonWrap
 */
export const ResetButtonWrap = styled('span')({
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  lineHeight: 0,
});

/**
 * "Reset conversation" icon button, muted until hovered.
 * @const ResetIconButton
 */
export const ResetIconButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.secondary,
  flexShrink: 0,
  padding: theme.spacing(0.25),
  '&:hover': {
    color: theme.palette.primary.main,
  },
}));

/**
 * Glyph inside the reset icon button, sized to match the composer's icons.
 * @const ResetIconGlyph
 */
export const ResetIconGlyph = styled('span')(({ theme }) => ({
  display: 'block',
  fontSize: theme.typography.pxToRem(14),
}));

/**
 * Box that holds the Lexical plugin tree (editable field + placeholder).
 * @const EditorField
 */
export const EditorField = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  position: 'relative',
  height: theme.typography.pxToRem(28),
}));
