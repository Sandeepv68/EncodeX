import { styled } from '@mui/material/styles';
import type { ElementType } from 'react';
import { Box, DialogTitle, Stack } from '@mui/material';

/** Dialog title bar with the close button pushed to the end. */
export const EditorDialogTitle = styled(DialogTitle)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

/** Vertical stack holding the dialog's form fields. */
export const EditorFieldStack = styled(Stack)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

/** Chevron of the "advanced options" button; rotates when the section is open. */
export const ExpandChevron = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$expanded',
})<{ $expanded: boolean; component?: ElementType }>(({ theme, $expanded }) => ({
  display: 'inline-flex',
  transform: $expanded ? 'rotate(180deg)' : 'rotate(0deg)',
  transition: theme.transitions.create('transform', { duration: theme.transitions.duration.short }),
}));
