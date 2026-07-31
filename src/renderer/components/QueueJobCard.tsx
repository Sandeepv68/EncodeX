import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from './ErrorBoundary';
import ProgressBar from './ProgressBar';
import { QUEUE_STATUS } from '../../shared/media-options';
import type { QueueJob } from '../../shared/types';

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  [QUEUE_STATUS.QUEUED]: 'warning',
  [QUEUE_STATUS.RUNNING]: 'primary',
  [QUEUE_STATUS.DONE]: 'success',
  [QUEUE_STATUS.ERROR]: 'error',
};

export interface QueueJobCardProps {
  job: QueueJob;
  onRemove: (id: string) => void;
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export default function QueueJobCard({ job, onRemove }: QueueJobCardProps) {
  const { t } = useTranslation();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderColor: job.status === QUEUE_STATUS.ERROR ? 'error.main' : job.status === QUEUE_STATUS.DONE ? 'success.main' : 'divider',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {basename(job.input)}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label={job.status} size="small" color={statusColors[job.status] || 'default'} />
          <Button size="small" color="error" onClick={() => onRemove(job.id)}>
            {t('batchQueue.remove')}
          </Button>
        </Stack>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {job.output}
      </Typography>
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
    </Paper>
  );
}
