/**
 * @fileoverview Media information page. Lets the user drop any media file and
 * displays technical details about it. Corresponds to the `/media-info` route
 * and is the destination of the Dashboard "Media Info" feature card.
 *
 * The page is a drop zone backed by a spinner while probing. FFmpeg media info
 * (`getMediaInfo`) is fetched for any file; for image files, EXIF and histogram
 * data is additionally fetched via `getImageInfo`. Results are rendered by
 * `FileSummary`, `StreamDetails`, and `ExifSection` inside an `InfoPaper`.
 *
 * IPC interactions:
 *  - `getMediaInfo(path, 'FFMPEG')` - container format, duration, and streams.
 *  - `getImageInfo(path)` - EXIF tags and histogram for image files.
 */

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

/**
 * Logger instance scoped to this page. Reports media-info retrieval attempts,
 * successes, and failures.
 * @const {Logger} log
 */
const log = new Logger('renderer/pages/MediaInfo');

/**
 * Renders the media information page (`/media-info`).
 *
 * Shows a `FileDropZone` (replaced by a spinner while `loading`) and, once
 * info is available, an `InfoPaper` with the container summary, stream details,
 * and - for image files - the EXIF/histogram section.
 *
 * State managed: `info` (the FFmpeg media info), `exif` (image EXIF/histogram
 * data, only set for image inputs), and `loading`. Errors are surfaced through
 * `useErrorStore` and success through `useToastStore`.
 *
 * IPC interactions:
 *  - `getMediaInfo(path, 'FFMPEG')` - probed container/stream data.
 *  - `getImageInfo(path)` - image EXIF tags and histogram.
 *
 * @returns {JSX.Element} The page content.
 */
export default function MediaInfo() {
  const { t } = useTranslation();

  /**
   * Probed media info for the selected file, or null before any selection.
   * @type {MediaInfoType | null}
   */
  const [info, setInfo] = useState<MediaInfoType | null>(null);

  /**
   * EXIF/histogram data for image inputs, or null otherwise.
   * @type {ImageExifData | null}
   */
  const [exif, setExif] = useState<ImageExifData | null>(null);

  /**
   * Whether a probe request is currently in flight.
   * @type {boolean}
   */
  const [loading, setLoading] = useState(false);
  const showError = useErrorStore((s) => s.showError);

  /**
   * Handles a newly selected file. Probes it with FFmpeg via
   * `window.electronAPI.getMediaInfo` and stores the result, showing a success
   * toast. When the file is an image, `getImageInfo` is also called and its
   * EXIF/histogram payload stored. Failures are logged and surfaced through
   * `useErrorStore.showError`. `loading` wraps the whole sequence and is always
   * cleared in a `finally` block.
   * @param {string} path - Absolute path of the selected file.
   * @returns {Promise<void>} Resolves once probing (and image info, if
   *   applicable) settles.
   */
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
