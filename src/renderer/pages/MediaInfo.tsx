import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, CircularProgress } from '@mui/material';
import FileDropZone from '../components/FileDropZone';
import ErrorBanner from '../components/ErrorBanner';
import FileSummary from '../components/FileSummary';
import StreamDetails from '../components/StreamDetails';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { useToastStore } from '../stores/toastStore';
import { MediaInfo as MediaInfoType } from '../../shared/types';
import { PageTitle, ContentBox, ErrorBox, LoadingBox, InfoPaper, InfoTitle } from '../styles/MediaInfo.styles';
import { TitleIcon } from '../styles/PageContainer.styles';
import { pageIcons } from '../pageIcons';

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
      <PageTitle variant="h5">
        <TitleIcon>{pageIcons['/media-info']}</TitleIcon>
        {t('mediaInfo.title')}
      </PageTitle>
      <ContentBox>
        {currentError && (
          <ErrorBox>
            <ErrorBoundary fallback={null}>
              <ErrorBanner error={currentError} onClose={clearError} />
            </ErrorBoundary>
          </ErrorBox>
        )}
        <ErrorBoundary fallback={null}>
          <FileDropZone onFileSelect={handleFile} label={t('mediaInfo.dropLabel')} />
        </ErrorBoundary>
        {loading && (
          <LoadingBox>
            <CircularProgress size={24} />
          </LoadingBox>
        )}
        {info && (
          <ErrorBoundary fallback={null}>
            <InfoPaper>
              <InfoTitle variant="h6">{t('mediaInfo.fileInfo')}</InfoTitle>
              <FileSummary info={info} />
              <StreamDetails streams={info.streams} />
            </InfoPaper>
          </ErrorBoundary>
        )}
      </ContentBox>
    </Box>
  );
}
