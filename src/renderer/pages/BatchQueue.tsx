import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Stack } from '@mui/material';
import BatchControls from '../components/BatchControls';
import QueueJobCard from '../components/QueueJobCard';
import { useQueueStore } from '../stores/queueStore';
import { useToastStore } from '../stores/toastStore';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX } from '../../shared/media-options';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { QueueJob } from '../../shared/types';
import { useSettingsStore } from '../stores/settingsStore';
import { PageTitle, QueuePaper, EmptyText } from '../styles/BatchQueue.styles';

export default function BatchQueue() {
  const { t } = useTranslation();
  const { jobs, addJob, removeJob, updateJob, clearJobs } = useQueueStore();
  const videoCodecRef = useRef('libx264');
  const audioCodecRef = useRef('aac');
  const transcoderRef = useRef(TRANSCODER_TYPES[0]);
  const operationRef = useRef<string>(BATCH_OPERATIONS[0].value);
  const suffixRef = useRef<string>(DEFAULT_SUFFIX);

  useEffect(() => {
    window.electronAPI?.queueList().then((jobs: QueueJob[]) => useQueueStore.getState().setJobs(jobs));
  }, []);

  useEffect(() => {
    return window.electronAPI?.onQueueAdded(addJob);
  }, []);
  useEffect(() => {
    return window.electronAPI?.onQueueRemoved((id: string) => removeJob(id));
  }, []);
  useEffect(() => {
    return window.electronAPI?.onQueueStatusChange(updateJob);
  }, []);

  const handleAddFiles = async () => {
    const files = await window.electronAPI.selectFiles();
    if (!files) return;
    const { hardwareAcceleration, hwaccelMode } = useSettingsStore.getState();
    for (const file of files) {
      const ext = file.split('.').pop();
      const outFile = `${file.substring(0, file.lastIndexOf('.'))}${suffixRef.current}.${ext}`;
      window.electronAPI.queueAdd(
        file,
        outFile,
        {
          videoCodec: operationRef.current === 'extract_audio' ? undefined : videoCodecRef.current,
          audioCodec:
            operationRef.current === 'transcode'
              ? audioCodecRef.current
              : operationRef.current === 'extract_audio'
                ? audioCodecRef.current
                : undefined,
          hardwareAcceleration,
          hwaccelMode,
        },
        transcoderRef.current,
      );
      useToastStore.getState().success(t('toast.jobAdded'));
    }
  };

  const handleCancelAll = async () => {
    await window.electronAPI.queueCancelAll();
    clearJobs();
    useToastStore.getState().info(t('toast.allCancelled'));
  };

  return (
    <Box>
      <PageTitle variant="h5">{t('batchQueue.title')}</PageTitle>
      <BatchControls
        operationRef={operationRef}
        transcoderRef={transcoderRef}
        suffixRef={suffixRef}
        onAddFiles={handleAddFiles}
        onCancelAll={handleCancelAll}
      />

      <QueuePaper>
        {jobs.length === 0 ? (
          <EmptyText color="text.secondary">{t('batchQueue.empty')}</EmptyText>
        ) : (
          <Stack spacing={1}>
            {jobs.map((job: QueueJob) => (
              <QueueJobCard key={job.id} job={job} onRemove={(id) => window.electronAPI.queueRemove(id)} />
            ))}
          </Stack>
        )}
      </QueuePaper>
    </Box>
  );
}
