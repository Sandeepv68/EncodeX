import { alpha, styled } from '@mui/material/styles';
import { Box, Button, Paper } from '@mui/material';
import { SHADOWS } from '../../../shared/theme/colors';

/**
 * Rounded composer surface that holds the Lexical editor and the inline plan
 * button.
 * The focus ring is applied to the shell rather than the bare contenteditable so
 * keyboard focus is visible around the whole control.
 */
export const ComposerShell = styled(Box)(({ theme }) => ({
  position: 'relative',
  // The input sheet sits above the floating attachment cards so the cards read
  // as a layer tucked behind it.
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'nowrap',
  gap: theme.spacing(0.5),
  paddingBlock: theme.spacing(1),
  paddingInline: theme.spacing(1),
  marginInline: 'auto',
  width: '100%',
  maxWidth: theme.typography.pxToRem(750),
  minWidth: 0,
  borderRadius: theme.typography.pxToRem(24),
  [theme.breakpoints.up('sm')]: {
    borderRadius: theme.typography.pxToRem(999),
  },
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
  height: theme.typography.pxToRem(56),
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'nowrap',
  gap: theme.spacing(0.5),
  [theme.breakpoints.up('sm')]: {
    height: theme.typography.pxToRem(64),
  },
  '& [contenteditable="true"]': {
    outline: 'none',
    border: 'none',
    width: '100%',
    height: theme.typography.pxToRem(56),
    lineHeight: theme.typography.pxToRem(56),
    paddingInline: theme.typography.pxToRem(4),
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    color: theme.palette.text.primary,
    whiteSpace: 'pre !important',
    overflow: 'hidden',
    [theme.breakpoints.up('sm')]: {
      height: theme.typography.pxToRem(64),
      lineHeight: theme.typography.pxToRem(64),
    },
  },
  '& p': { margin: 0, lineHeight: 'inherit' },
}));

/** Lexical placeholder text, shown while the editor is empty. */
export const EditorPlaceholder = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  insetInlineStart: 0,
  insetInlineEnd: 0,
  height: theme.typography.pxToRem(56),
  lineHeight: theme.typography.pxToRem(56),
  paddingInline: theme.typography.pxToRem(4),
  pointerEvents: 'none',
  color: alpha(theme.palette.text.primary, 0.72),
  fontSize: theme.typography.body1.fontSize,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  [theme.breakpoints.up('sm')]: {
    height: theme.typography.pxToRem(64),
    lineHeight: theme.typography.pxToRem(64),
  },
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
export const ResetIconButton = styled(Button)(({ theme }) => ({
  color: theme.palette.text.secondary,
  flexShrink: 0,
  minWidth: 0,
  width: theme.typography.pxToRem(40),
  height: theme.typography.pxToRem(40),
  borderRadius: theme.typography.pxToRem(999),
  padding: 0,
  '&:hover': {
    color: theme.palette.primary.main,
  },
  [theme.breakpoints.up('sm')]: {
    width: theme.typography.pxToRem(64),
    height: theme.typography.pxToRem(64),
  },
}));

/**
 * Glyph inside the reset icon button, sized to match the composer's icons.
 * @const ResetIconGlyph
 */
export const ResetIconGlyph = styled('span')(({ theme }) => ({
  display: 'block',
  fontSize: theme.typography.pxToRem(18),
}));

/**
 * Button that shows the connected AI provider logo inside the composer field.
 * It mirrors the reset button's shape so the two read as a matched pair.
 * @const ProviderLogoButton
 */
export const ProviderLogoButton = styled(Button)(({ theme }) => ({
  color: theme.palette.text.secondary,
  flexShrink: 0,
  minWidth: 0,
  width: theme.typography.pxToRem(40),
  height: theme.typography.pxToRem(40),
  borderRadius: theme.typography.pxToRem(999),
  padding: 0,
  '&:hover': {
    color: theme.palette.primary.main,
  },
  [theme.breakpoints.up('sm')]: {
    width: theme.typography.pxToRem(64),
    height: theme.typography.pxToRem(64),
  },
}));

/**
 * Thin vertical rule that separates the plan button from the provider logo.
 * @const ComposerDivider
 */
export const ComposerDivider = styled('span')(({ theme }) => ({
  alignSelf: 'center',
  width: theme.typography.pxToRem(1),
  height: theme.typography.pxToRem(24),
  flexShrink: 0,
  backgroundColor: theme.palette.divider,
}));

/**
 * The provider logo image inside the provider button.
 * @const ProviderLogoImage
 */
export const ProviderLogoImage = styled('img')(({ theme }) => ({
  width: theme.typography.pxToRem(28),
  height: theme.typography.pxToRem(28),
  objectFit: 'contain',
}));

/**
 * Fallback glyph shown when the provider has no logo asset.
 * @const ProviderLogoFallback
 */
export const ProviderLogoFallback = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  fontSize: theme.typography.pxToRem(24),
}));

/**
 * The popover that holds the AI connection status. It is shaped like the
 * connection status chip: a fully rounded pill with the same surface and
 * border, so the two read as the same object in two states.
 * @const ProviderStatusPopover
 */
export const ProviderStatusPopover = styled(Paper)(({ theme }) => ({
  // The popover replaces MUI's own paper slot, so it has to bring the
  // positioning the popover relies on: the inline `top`/`left` it writes are
  // only honoured by an absolutely positioned element.
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  paddingInline: theme.spacing(1.25),
  paddingBlock: theme.spacing(0.75),
  minWidth: 0,
  maxWidth: theme.typography.pxToRem(420),
  boxSizing: 'border-box',
  borderRadius: theme.typography.pxToRem(999),
  // The chip sits on top of the page, so it can use the translucent hover
  // tint. The popover floats above everything and needs an opaque surface.
  backgroundColor: theme.palette.background.paper,
  border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
  overflow: 'visible',
  // The anchor arrow. MUI's Popover has no arrow slot, so the tail is drawn
  // as a rotated square: two of its edges carry the divider colour and the
  // other two are covered by the paper surface.
  '&::before': {
    content: '""',
    position: 'absolute',
    top: theme.typography.pxToRem(-7),
    right: theme.typography.pxToRem(14),
    width: theme.typography.pxToRem(12),
    height: theme.typography.pxToRem(12),
    backgroundColor: theme.palette.background.paper,
    borderLeft: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
    borderTop: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
    transform: 'rotate(45deg)',
    pointerEvents: 'none',
    [theme.breakpoints.up('sm')]: {
      right: theme.typography.pxToRem(26),
    },
  },
  // The status pill inside keeps the chip's own chrome out of the popover.
  // The doubled `&&` lifts these rules above the chip's own single-class
  // selectors, which are injected after the popover's styles.
  '&& > *': {
    backgroundColor: 'transparent',
    border: 0,
    borderRadius: 0,
    paddingInline: 0,
    paddingBlock: 0,
    marginInlineStart: 0,
    boxShadow: 'none',
  },
  // The caption is collapsed until hover in the chip; inside the popover it is
  // always shown and wraps instead of being clipped.
  '&& .copilot-ai-status-text': {
    display: 'inline-flex',
    maxWidth: 'none',
    opacity: 1,
    marginInlineStart: theme.spacing(0.75),
    whiteSpace: 'normal',
    overflow: 'visible',
    overflowWrap: 'anywhere',
  },
}));

/**
 * Box that holds the Lexical plugin tree (editable field + placeholder).
 * @const EditorField
 */
export const EditorField = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  position: 'relative',
  height: theme.typography.pxToRem(56),
  [theme.breakpoints.up('sm')]: {
    height: theme.typography.pxToRem(64),
  },
}));

/**
 * Primary "Plan" action. Sized to the editor row so it reads as part of the
 * composer field rather than a small inline control.
 * @const ComposerPlanButton
 */
export const ComposerPlanButton = styled(Button)(({ theme }) => ({
  flexShrink: 0,
  minWidth: theme.typography.pxToRem(44),
  height: theme.typography.pxToRem(56),
  paddingInline: theme.spacing(1.5),
  borderRadius: theme.typography.pxToRem(999),
  fontSize: theme.typography.body1.fontSize,
  color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark,
  '& .MuiButton-startIcon': {
    marginInlineEnd: 0,
  },
  [theme.breakpoints.down('sm')]: {
    fontSize: 0,
    '& .MuiButton-startIcon': {
      fontSize: theme.typography.body1.fontSize,
      marginInlineEnd: 0,
      marginInlineStart: 0,
    },
  },
  [theme.breakpoints.up('sm')]: {
    height: theme.typography.pxToRem(64),
    paddingInline: theme.spacing(2.5),
    '& .MuiButton-startIcon': {
      marginInlineEnd: theme.spacing(0.75),
    },
  },
}));
