import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, CircularProgress } from '@mui/material';
import FileDropZone from '../components/FileDropZone';
import FileSummary from '../components/FileSummary';
import StreamDetails from '../components/StreamDetails';
import ExifSection from '../components/ExifSection';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { useToastStore } from '../stores/toastStore';
import { MediaInfo as MediaInfoType, ImageExifData } from '../../shared/types';
import { isImageFile } from '../../shared/file-extensions';
import { PageTitle, ContentBox, LoadingBox, InfoPaper, InfoTitle } from '../styles/MediaInfo.styles';
import { TitleIcon } from '../styles/PageContainer.styles';
import { pageIcons } from '../pageIcons';
import {
  LOG_FAILED_TO_GET_MEDIA_INFO,
  LOG_GETTING_MEDIA_INFO_FOR,
  LOG_HISTOGRAM,
  LOG_IMAGE_INFO_RETRIEVED,
  LOG_MEDIA_INFO_RETRIEVED,
} from '../../shared/log-constants';

const log = new Logger('renderer/pages/MediaInfo');

export default function MediaInfo() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<MediaInfoType | null>(null);
  const [exif, setExif] = useState<ImageExifData | null>(null);
  const [loading, setLoading] = useState(false);
  const showError = useErrorStore((s) => s.showError);

  const handleFile = async (path: string) => {
    log.info(LOG_GETTING_MEDIA_INFO_FOR, path);
    setLoading(true);
    setExif(null);
    try {
      const data = await window.electronAPI.getMediaInfo(path, 'FFMPEG');
      log.info(LOG_MEDIA_INFO_RETRIEVED, data.format, data.duration.toFixed(2) + 's,', data.streams.length, 'streams');
      setInfo(data);
      useToastStore.getState().success(t('toast.mediaInfoLoaded'));
      if (isImageFile(path)) {
        const imageData = await window.electronAPI.getImageInfo(path);
        log.info(
          LOG_IMAGE_INFO_RETRIEVED,
          imageData?.exif ? Object.keys(imageData.exif).length + ' exif tags' : 'no exif',
          LOG_HISTOGRAM,
          imageData?.histogram ? 'yes' : 'no',
        );
        setExif(imageData);
      }
    } catch (err: unknown) {
      log.error(LOG_FAILED_TO_GET_MEDIA_INFO, err);
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
              {exif && <ExifSection data={exif} />}
            </InfoPaper>
          </ErrorBoundary>
        )}
      </ContentBox>
    </Box>
  );
}
