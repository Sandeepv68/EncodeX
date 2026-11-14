import { styled } from '@mui/material/styles';
import { Box, TextField } from '@mui/material';
import { FieldLabel } from './form.styles';

/**
 * Inline cluster holding the queue-wide options. It is rendered inside the
 * queue header actions, to the right of the tab list, so the setting stays
 * visible and unambiguous for both the general and the mux queue.
 *
 * The caption is absolutely positioned in a reserved strip above the control
 * so it takes no horizontal space and only paints while the select is visible,
 * and the control row reserves the select's input height. The group therefore
 * keeps a constant size in both states and the collapsed button stays as wide
 * as the button itself, keeping the header actions evenly spaced.
 * @const GlobalOptionsGroup
 */
export const GlobalOptionsGroup = styled(Box)(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-end',
  paddingTop: theme.spacing(2.25),
}));

/**
 * Caption of the when-done control. It is always in the DOM so the reserved
 * caption strip never changes between the collapsed button and the expanded
 * select, but it is only painted while the select is visible.
 * @const GlobalOptionsLabel
 */
export const GlobalOptionsLabel = styled(FieldLabel, {
  shouldForwardProp: (prop) => prop !== '$visible',
})<{ $visible: boolean }>(({ $visible }) => ({
  position: 'absolute',
  top: 0,
  insetInlineStart: 0,
  marginBottom: 0,
  whiteSpace: 'nowrap',
  visibility: $visible ? 'visible' : 'hidden',
}));

/** Control row reserving the small select's input height in both states. @const GlobalOptionsInputRow */
export const GlobalOptionsInputRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-end',
  minHeight: theme.typography.pxToRem(40),
}));

/** "When done" select kept at its content width inside the header row. @const GlobalOptionsSelect */
export const GlobalOptionsSelect = styled(TextField)(({ theme }) => ({
  minWidth: theme.typography.pxToRem(190),
}));

/** Icon shown in front of each when-done dropdown option. @const WhenDoneOptionIcon */
export const WhenDoneOptionIcon = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.typography.pxToRem(18),
  marginInlineEnd: theme.spacing(1),
  opacity: 0.8,
}));
