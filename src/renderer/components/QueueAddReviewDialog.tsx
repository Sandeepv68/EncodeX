/**
 * @fileoverview Batch add review dialog.
 *
 * Renders a modal dialog shown after files are selected on the Batch Queue
 * page. Each selected file is listed in its own row with a per-file operation
 * dropdown, pre-filled with the page's current toolbar operation.
 */

import { useEffect, useState } from 'react';
import { Button, MenuItem } from '@mui/material';
import { faCheck, faClipboardList, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import { BATCH_OPERATIONS } from '../../shared/media-options';
import type { QueueAddReviewDialogProps } from './types';
import { basename } from '../utils/path-utils';
import { ReviewFileName, ReviewList, ReviewOperationSelect, ReviewRow } from '../styles/QueueAddReviewDialog.styles';
import AppDialog from './AppDialog';

/**
 * Renders the batch add review dialog.
 * @param {QueueAddReviewDialogProps} props - Component props.
 * @returns {JSX.Element} The rendered dialog.
 */
export default function QueueAddReviewDialog({ open, files, defaultOperation, onConfirm, onCancel }: QueueAddReviewDialogProps) {
  const { t } = useTranslation();

  const operationLabels: Record<string, string> = {
    transcode: t('batchQueue.operationTranscode'),
    extract_audio: t('batchQueue.operationExtractAudio'),
    compress_image: t('batchQueue.operationCompressImage'),
  };

  const [selections, setSelections] = useState<Record<string, string>>({});
  const filesKey = files.join('\n');

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      for (const file of files) initial[file] = defaultOperation;
      setSelections(initial);
    }
  }, [open, filesKey, defaultOperation]);

  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      title={t('batchQueue.reviewTitle')}
      icon={<FontAwesomeIcon icon={faClipboardList} />}
      showCloseButton
      closeButtonAriaLabel={t('shortcuts.close')}
      maxWidth="sm"
      fullWidth
      actions={
        <>
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
        </>
      }
    >
      <ReviewList spacing={1}>
        {files.map((file) => (
          <ReviewRow key={file} direction="row" spacing={1}>
            <ReviewFileName noWrap>{basename(file)}</ReviewFileName>
            <ReviewOperationSelect
              select
              size="small"
              value={selections[file] ?? defaultOperation}
              slotProps={{ input: { 'aria-label': `${basename(file)} ${t('batchQueue.operation')}` } }}
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
    </AppDialog>
  );
}
