import { Button, Chip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ErrorBoundary } from './ErrorBoundary';
import ProgressBar from './ProgressBar';
import type { QueueJobCardProps } from './types';
import { QUEUE_STATUS } from '../../shared/media-options';
import { JobCard, CardHeaderRow, JobNameText, CardActionsStack, OutputText } from '../styles/QueueJobCard.styles';

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  [QUEUE_STATUS.QUEUED]: 'warning',
  [QUEUE_STATUS.RUNNING]: 'primary',
  [QUEUE_STATUS.DONE]: 'success',
  [QUEUE_STATUS.ERROR]: 'error',
};

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

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
