/**
 * @fileoverview Batch add review dialog.
 *
 * Renders a modal MUI Dialog shown after files are selected on the Batch Queue
 * page. Each selected file is listed in its own row with a per-file operation
 * dropdown (transcode / extract audio / compress image), pre-filled with the
 * page's current toolbar operation. Confirming enqueues every row with its
 * chosen operation; cancelling dismisses the dialog without adding anything.
 *
 * The dialog is fully controlled: the parent decides visibility via `open`,
 * supplies the `files` to review and the `defaultOperation` for every row, and
 * receives the per-file `onConfirm` selections or `onCancel`. Row operations
 * are held in local state and reset whenever the dialog (re)opens or its inputs
 * change.
 *
 * Props (see {@link QueueAddReviewDialogProps}):
 *  - open: whether the dialog is shown.
 *  - files: absolute paths of the files to review.
 *  - defaultOperation: operation value pre-filled on every row.
 *  - onConfirm: fired with `{file, operation}[]` when confirmed.
 *  - onCancel: fired when dismissed without confirming.
 */

import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem } from '@mui/material';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import { BATCH_OPERATIONS } from '../../shared/media-options';
import type { QueueAddReviewDialogProps, QueueAddReviewSelection } from './types';
import { ReviewFileName, ReviewList, ReviewOperationSelect, ReviewRow } from '../styles/QueueAddReviewDialog.styles';

/**
 * Extracts the basename of a file path, handling both Windows backslashes and
 * POSIX forward slashes.
 * @param {string} path - The file path to process.
 * @returns {string} The trailing path segment, or the original path when it has
 *   no separators.
 */
function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * Renders the batch add review dialog.
 * @param {QueueAddReviewDialogProps} props - Component props.
 * @param {boolean} props.open - Controls dialog visibility.
 * @param {string[]} props.files - Files to review; one row each.
 * @param {string} props.defaultOperation - Operation pre-filled on every row.
 * @param {(selections: QueueAddReviewSelection[]) => void} props.onConfirm -
 *   Fired with one selection per file on confirm.
 * @param {() => void} props.onCancel - Fired when the dialog is dismissed
 *   without confirming.
 * @returns {JSX.Element} The rendered dialog.
 */
export default function QueueAddReviewDialog({ open, files, defaultOperation, onConfirm, onCancel }: QueueAddReviewDialogProps) {
  const { t } = useTranslation();

  /**
   * Localized display labels keyed by batch operation value.
   * @const {Record<string, string>} operationLabels
   */
  const operationLabels: Record<string, string> = {
    transcode: t('batchQueue.operationTranscode'),
    extract_audio: t('batchQueue.operationExtractAudio'),
    compress_image: t('batchQueue.operationCompressImage'),
  };

  /**
   * Per-file operation selections keyed by file path.
   * @type {[Record<string, string>, React.Dispatch<React.SetStateAction<Record<string, string>>>]}
   */
  const [selections, setSelections] = useState<Record<string, string>>({});

  /**
   * (Re)initializes every row to the default operation whenever the dialog
   * opens or its inputs change, so stale selections never leak between opens.
   * @returns {void}
   */
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      for (const file of files) initial[file] = defaultOperation;
      setSelections(initial);
    }
  }, [open, files, defaultOperation]);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t('batchQueue.reviewTitle')}</DialogTitle>
      <DialogContent dividers>
        <ReviewList spacing={1}>
          {files.map((file) => (
            <ReviewRow key={file} direction="row" spacing={1}>
              <ReviewFileName noWrap>{basename(file)}</ReviewFileName>
              <ReviewOperationSelect
                select
                size="small"
                value={selections[file] ?? defaultOperation}
                onChange={(e) => {
                  setSelections((prev) => ({ ...prev, [file]: e.target.value }));
                }}
              >
                {BATCH_OPERATIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {operationLabels[o.value]}
                  </MenuItem>
                ))}
              </ReviewOperationSelect>
            </ReviewRow>
          ))}
        </ReviewList>
      </DialogContent>
      <DialogActions>
        <Button startIcon={<FontAwesomeIcon icon={faXmark} />} onClick={onCancel}>
          {t('batchQueue.reviewCancel')}
        </Button>
        <Button
          startIcon={<FontAwesomeIcon icon={faCheck} />}
          onClick={() => {
            onConfirm(files.map((file) => ({ file, operation: selections[file] ?? defaultOperation })));
          }}
          color="primary"
          variant="contained"
        >
          {t('batchQueue.reviewAdd', { count: files.length })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
