import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ConfirmDialogProps } from './types';

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onClose, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button startIcon={<FontAwesomeIcon icon={faXmark} />} onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button startIcon={<FontAwesomeIcon icon={faCheck} />} onClick={onConfirm} color="error" variant="contained">
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
