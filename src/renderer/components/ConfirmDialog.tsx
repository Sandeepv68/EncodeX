/**
 * @fileoverview Reusable confirmation dialog.
 *
 * Renders a modal dialog used for destructive or consequential actions that
 * require explicit user confirmation (e.g. clearing a queue, discarding unsaved
 * changes). The dialog is fully controlled: the parent decides visibility via
 * `open` and handles both outcomes via `onClose` (cancel / backdrop) and
 * `onConfirm` (confirm button).
 */

import { useId } from 'react';
import { Button, DialogContentText } from '@mui/material';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AppDialog from './AppDialog';
import type { ConfirmDialogProps } from './types';

/**
 * Renders the confirmation dialog.
 *
 * Clicking the confirm button calls `onConfirm`; any other dismissal path
 * (cancel button, backdrop click, Escape, close button) calls `onClose`.
 *
 * @param {ConfirmDialogProps} props - Component props.
 * @returns {JSX.Element} The rendered dialog.
 */
export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onClose, onConfirm }: ConfirmDialogProps) {
  const descriptionId = `${useId()}-description`;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={title}
      icon={<FontAwesomeIcon icon={faCircleQuestion} />}
      showCloseButton
      ariaDescribedBy={descriptionId}
      paperTestId="confirm-dialog"
      actions={
        <>
          <Button onClick={onClose} color="inherit" data-testid="confirm-cancel">
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} color="error" variant="contained" data-testid="confirm-confirm">
            {confirmLabel}
          </Button>
        </>
      }
    >
      <DialogContentText id={descriptionId}>{message}</DialogContentText>
    </AppDialog>
  );
}
