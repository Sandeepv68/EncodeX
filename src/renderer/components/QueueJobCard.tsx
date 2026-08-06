/**
 * @fileoverview Single job card in the batch queue list.
 *
 * Renders one conversion job as an outlined card showing the input filename,
 * its queue status as a colored chip, the output path, an in-card progress
 * bar while running, and any error text. A remove button lets the user drop
 * the job from the queue.
 *
 * Status colors map QUEUE_STATUS values to MUI chip colors (queued = warning,
 * running = primary, done = success, error = error). The progress bar is
 * wrapped in an ErrorBoundary so a renderer failure in one card never breaks
 * the queue list.
 *
 * Props (see {@link QueueJobCardProps}):
 *  - job: the QueueJob to display.
 *  - onRemove: callback invoked with the job id when the user removes it.
 */

import { Button, Chip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ErrorBoundary } from './ErrorBoundary';
import ProgressBar from './ProgressBar';
import type { QueueJobCardProps } from './types';
import { QUEUE_STATUS } from '../../shared/media-options';
import { JobCard, CardHeaderRow, JobNameText, CardActionsStack, OutputText } from '../styles/QueueJobCard.styles';

/**
 * Maps QUEUE_STATUS values to MUI Chip color props used for the status chip.
 * @type {Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'>}
 */
const statusColors: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  [QUEUE_STATUS.QUEUED]: 'warning',
  [QUEUE_STATUS.RUNNING]: 'primary',
  [QUEUE_STATUS.DONE]: 'success',
  [QUEUE_STATUS.ERROR]: 'error',
};

/**
 * Extracts the basename of a file path, handling both Windows backslashes and
 * POSIX forward slashes.
 * @param {string} path - The file path to process.
 * @returns {string} The trailing path segment, or the original path when it
 *   has no separators.
 */
function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * Renders a single batch queue job card.
 *
 * Shows the input file's basename (see {@link basename}) and a status chip in
 * the header row, the output path below, a {@link ProgressBar} while the job
 * is running, and the error message when the job failed.
 * @param {QueueJobCardProps} props - Component props.
 * @param {QueueJob} props.job - The conversion job to display.
 * @param {(id: string) => void} props.onRemove - Callback fired with the job's
 *   id when the remove button is clicked.
 * @returns {JSX.Element} The job card.
 */
export default function QueueJobCard({ job, onRemove }: QueueJobCardProps) {
  const { t } = useTranslation();

  return (
    <JobCard $status={job.status} variant="outlined">
      <CardHeaderRow>
        <JobNameText variant="body2">{basename(job.input)}</JobNameText>
        <CardActionsStack direction="row" spacing={1}>
          <Chip label={job.status} size="small" color={statusColors[job.status] || 'default'} />
          <Button size="small" color="error" startIcon={<FontAwesomeIcon icon={faTrashCan} />} onClick={() => onRemove(job.id)}>
            {t('batchQueue.remove')}
          </Button>
        </CardActionsStack>
      </CardHeaderRow>
      <OutputText variant="caption" color="text.secondary">
        {job.output}
      </OutputText>
      {job.status === QUEUE_STATUS.RUNNING && (
        <ErrorBoundary fallback={null}>
          <ProgressBar percent={job.progress} />
        </ErrorBoundary>
      )}
      {job.error && (
        <Typography variant="caption" color="error">
          {job.error}
        </Typography>
      )}
    </JobCard>
  );
}
