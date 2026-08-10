/**
 * @fileoverview Reusable confirmation dialog.
 *
 * Renders a modal MUI Dialog used for destructive or consequential
 * confirmations (e.g. clearing the queue, resetting settings). It shows a
 * title, a message body, and two actions: a cancel button (X icon) and a
 * confirm button (check icon) styled as an error-colored contained button to
 * signal the destructive nature of the confirm action.
 *
 * The dialog is fully controlled: the parent decides visibility via `open`,
 * supplies all strings through props, and receives the `onClose` / `onConfirm`
 * callbacks. Clicking the backdrop or pressing Escape also routes through
 * `onClose` because the underlying MUI Dialog wires `onClose` to those events.
 *
 * Props (see {@link ConfirmDialogProps}):
 *  - open: whether the dialog is shown.
 *  - title / message / confirmLabel / cancelLabel: localized display strings.
 *  - onClose: fired when the dialog is dismissed without confirming.
 *  - onConfirm: fired when the confirm button is clicked.
 */

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ConfirmDialogProps } from './types';

/**
 * Renders the confirmation dialog.
 * @param {ConfirmDialogProps} props - Component props.
 * @param {boolean} props.open - Controls dialog visibility.
 * @param {string} props.title - Dialog title text.
 * @param {string} props.message - Body message text.
 * @param {string} props.confirmLabel - Text of the confirm action button.
 * @param {string} props.cancelLabel - Text of the cancel action button.
 * @param {() => void} props.onClose - Fired on backdrop click, Escape, or the
 *   cancel button.
 * @param {() => void} props.onConfirm - Fired by the confirm button.
 * @returns {JSX.Element} The rendered dialog.
 */
export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onClose, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} slotProps={{ paper: { 'data-testid': 'confirm-dialog' } }}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button startIcon={<FontAwesomeIcon icon={faXmark} />} onClick={onClose} data-testid="confirm-cancel">
          {cancelLabel}
        </Button>
        <Button startIcon={<FontAwesomeIcon icon={faCheck} />} onClick={onConfirm} color="error" variant="contained" data-testid="confirm-confirm">
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
