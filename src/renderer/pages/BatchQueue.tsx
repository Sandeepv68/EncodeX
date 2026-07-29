import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, TextField, MenuItem, Button, Paper, Stack, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ProgressBar from '../components/ProgressBar';
import { useQueueStore } from '../stores/queueStore';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX, QUEUE_STATUS } from '../../shared/ui-constants';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  [QUEUE_STATUS.QUEUED]: 'warning',
  [QUEUE_STATUS.RUNNING]: 'primary',
  [QUEUE_STATUS.DONE]: 'success',
  [QUEUE_STATUS.ERROR]: 'error',
};

export default function BatchQueue() {
  const { t } = useTranslation();
  const { jobs, addJob, removeJob, updateJob, clearJobs } = useQueueStore();
  let videoCodec = 'libx264';
  let audioCodec = 'aac';
  let transcoder = TRANSCODER_TYPES[0];
  let operation = BATCH_OPERATIONS[0].value;
  let suffix = DEFAULT_SUFFIX;

  useEffect(() => {
    window.electronAPI?.queueList().then((jobs: any[]) => useQueueStore.getState().setJobs(jobs));
  }, []);

  useEffect(() => { return window.electronAPI?.onQueueAdded(addJob); }, []);
  useEffect(() => { return window.electronAPI?.onQueueRemoved((id: string) => removeJob(id)); }, []);
  useEffect(() => { return window.electronAPI?.onQueueStatusChange(updateJob); }, []);

  const handleAddFiles = async () => {
    const files = await window.electronAPI.selectFiles();
    if (!files) return;
    for (const file of files) {
      const ext = file.split('.').pop();
      const outFile = `${file.substring(0, file.lastIndexOf('.'))}${suffix}.${ext}`;
      window.electronAPI.queueAdd(file, outFile, {
        videoCodec: operation === 'extract_audio' ? undefined : videoCodec,
        audioCodec: operation === 'transcode' ? audioCodec : operation === 'extract_audio' ? audioCodec : undefined,
      }, transcoder);
    }
  };

  const handleCancelAll = async () => {
    await window.electronAPI.queueCancelAll();
    clearJobs();
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>{t('batchQueue.title')}</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TextField select size="small" sx={{ minWidth: 140 }} defaultValue={operation} onChange={(e: any) => { operation = e.target.value; }}>
            {BATCH_OPERATIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" sx={{ minWidth: 110 }} defaultValue={transcoder} onChange={(e: any) => { transcoder = e.target.value; }}>
            {TRANSCODER_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField size="small" sx={{ minWidth: 120 }} defaultValue={suffix} onChange={(e: any) => { suffix = e.target.value; }} placeholder={t('batchQueue.suffix')} />
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddFiles}>{t('batchQueue.addFiles')}</Button>
          <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />} onClick={handleCancelAll}>{t('batchQueue.cancelAll')}</Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        {jobs.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>{t('batchQueue.empty')}</Typography>
        ) : (
          <Stack spacing={1}>
            {jobs.map((job) => (
              <Paper key={job.id} variant="outlined" sx={{ p: 1.5, borderColor: job.status === QUEUE_STATUS.ERROR ? 'error.main' : job.status === QUEUE_STATUS.DONE ? 'success.main' : 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {job.input.split('\\').pop() || job.input.split('/').pop()}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label={job.status} size="small" color={statusColors[job.status] || 'default'} />
                    <Button size="small" color="error" onClick={() => window.electronAPI.queueRemove(job.id)}>{t('batchQueue.remove')}</Button>
                  </Stack>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{job.output}</Typography>
                {job.status === QUEUE_STATUS.RUNNING && <ProgressBar percent={job.progress} />}
                {job.error && <Typography variant="caption" color="error">{job.error}</Typography>}
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
