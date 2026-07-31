import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import FileDropZone from '../components/FileDropZone';
import ErrorBanner from '../components/ErrorBanner';
import FileSummary from '../components/FileSummary';
import StreamDetails from '../components/StreamDetails';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { useToastStore } from '../stores/toastStore';
import { MediaInfo as MediaInfoType } from '../../shared/types';

const log = new Logger('renderer/pages/MediaInfo');

export default function MediaInfo() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<MediaInfoType | null>(null);
  const [loading, setLoading] = useState(false);
  const { currentError, showError, clearError } = useErrorStore();

  const handleFile = async (path: string) => {
    log.info('Getting media info for:', path);
    setLoading(true);
    try {
      const data = await window.electronAPI.getMediaInfo(path, 'FFMPEG');
      log.info('Media info retrieved:', data.format, data.duration.toFixed(2) + 's,', data.streams.length, 'streams');
      setInfo(data);
      useToastStore.getState().success(t('toast.mediaInfoLoaded'));
    } catch (err: unknown) {
      log.error('Failed to get media info:', err);
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        {t('mediaInfo.title')}
      </Typography>
      <Box sx={{ width: '100%' }}>
        {currentError && (
          <Box sx={{ mb: 2 }}>
            <ErrorBoundary fallback={null}>
              <ErrorBanner error={currentError} onClose={clearError} />
            </ErrorBoundary>
          </Box>
        )}
        <ErrorBoundary fallback={null}>
          <FileDropZone onFileSelect={handleFile} label={t('mediaInfo.dropLabel')} />
        </ErrorBoundary>
        {loading && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {info && (
          <ErrorBoundary fallback={null}>
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {t('mediaInfo.fileInfo')}
              </Typography>
              <FileSummary info={info} />
              <StreamDetails streams={info.streams} />
            </Paper>
          </ErrorBoundary>
        )}
      </Box>
    </Box>
  );
}
