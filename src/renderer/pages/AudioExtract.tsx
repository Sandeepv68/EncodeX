/**
 * @fileoverview Audio extraction page. Lets the user pick a video file and
 * extract its audio track into a standalone audio file, choosing the output
 * codec and bitrate. Corresponds to the `/audio-extract` route and is the
 * destination of the Dashboard "Extract Audio" feature card.
 *
 * Workflow: drop or pick a video -> a preview thumbnail is fetched and the file
 * is probed for its audio streams -> choose output path, audio codec, and
 * bitrate -> click Extract. While the extraction runs a ProgressBar is shown
 * together with pause, resume, and cancel controls.
 *
 * State is centralized in the `useAudioExtractStore` zustand store (input,
 * preview, audio streams, output, codec, bitrate, converting/paused flags,
 * progress); form-level validation errors live in `useFormErrors`. All media
 * work is delegated to the main process through `window.electronAPI`
 * (`getVideoPreview`, `getMediaInfo`, `selectOutput`, `convertFile`,
 * `pauseConversion`, `resumeConversion`, `cancelConversion`).
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, TextField, MenuItem, Button, Stack, Typography } from '@mui/material';
import { faMusic, faPause, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import CodecSelect from '../components/CodecSelect';
import FileDropZone from '../components/FileDropZone';
import ProgressBar from '../components/ProgressBar';
import PageContainer from '../components/PageContainer';
import FilePathField from '../components/FilePathField';
import ConfirmDialog from '../components/ConfirmDialog';
import AudioStreamInfo from '../components/AudioStreamInfo';
import InfoTooltip from '../components/InfoTooltip';
import { pageIcons } from '../pageIcons';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useFormErrors } from '../hooks/useFormErrors';
import { BITRATE_OPTIONS } from '../../shared/media-options';
import { VIDEO_DROPZONE_ACCEPT } from '../../shared/file-extensions';
import { replaceExtension, suggestedExtensionForAudioCodec } from '../../shared/codec-containers';
import { useAudioExtractStore } from '../stores/audioExtractStore';
import type { MediaStreamInfo } from '../../shared/types';
import {
  FieldBox,
  FieldLabel,
  PreviewBox,
  PreviewImage,
  PreviewImageBox,
  PreviewInfo,
  PreviewCloseButton,
} from '../styles/AudioExtract.styles';
import {
  LOG_ARROW,
  LOG_CODEC,
  LOG_EXTRACTING_AUDIO,
  LOG_FAILED_TO_LOAD_MEDIA_INFO,
  LOG_VALIDATION_FAILED,
} from '../../shared/log-constants';

/**
 * Logger instance scoped to this page. Used to report media-info load failures,
 * validation failures, and extraction starts.
 * @const {Logger} log
 */
const log = new Logger('renderer/pages/AudioExtract');

/**
 * Extracts the base file name from an absolute path, handling both `/` and `\`
 * separators (POSIX and Windows paths).
 * @param {string} path - The full file path to process.
 * @returns {string} The trailing path segment, or the original `path` when no
 *   separator is present.
 */
function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * Replaces the extension of a file path with the given one, preserving any
 * directory portion. If `path` has no extension (or only directory dots), the
 * new extension is appended. Extension detection stops at the last slash so
 * directory names containing dots are not mangled.
 * @param {string} path - The file path whose extension is replaced.
 * @param {string} ext - The new extension, without a leading dot.
 * @returns {string} The path with its extension replaced or appended.
 */
function withExtension(path: string, ext: string): string {
  const slashIdx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const dotIdx = path.lastIndexOf('.');
  const base = dotIdx > slashIdx ? path.slice(0, dotIdx) : path;
  return `${base}.${ext}`;
}

/**
 * Renders the audio extraction page (`/audio-extract`).
 *
 * Layout: a drop zone / video preview box at the top, an output file field,
 * audio codec and bitrate selectors, and the Extract action buttons. While a
 * conversion runs a ProgressBar is shown together with pause/resume/cancel
 * buttons; a ConfirmDialog guards cancellation.
 *
 * Local state: only `cancelConfirmOpen` (whether the cancel dialog is open).
 * Everything else lives in `useAudioExtractStore`: `input`, `preview`,
 * `audioStreams`, `output`, `audioCodec`, `audioBitrate`, `isConverting`,
 * `isPaused`, and `progress`. Field errors are tracked with `useFormErrors`.
 *
 * IPC interactions:
 *  - `getVideoPreview(path)` - thumbnail of the selected video.
 *  - `getMediaInfo(path, 'FFMPEG')` - lists audio streams for the stream box.
 *  - `selectOutput()` - native save dialog for the output file.
 *  - `convertFile(...)`, `pauseConversion()`, `resumeConversion()`,
 *    `cancelConversion()` - run and control the extraction via the store.
 *
 * @returns {JSX.Element} The page content inside a PageContainer.
 */
export default function AudioExtract() {
  const { t } = useTranslation();
  const store = useAudioExtractStore();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const suggestedExt = suggestedExtensionForAudioCodec(store.audioCodec);

  /**
   * Handles a newly selected or dropped video file. Clears the previous preview
   * and audio stream list, then fetches a video preview thumbnail and probes the
   * file for its audio streams via `window.electronAPI`. A failure to load
   * media info is logged and swallowed; the page simply shows no stream details.
   * @param {string} path - Absolute path of the selected video file.
   * @returns {Promise<void>} Resolves once preview and stream probing settle.
   */
  const handleFileSelect = async (path: string) => {
    store.setInput(path);
    store.setPreview(null);
    store.setAudioStreams([]);
    if (!path) return;
    const dataUrl = await window.electronAPI.getVideoPreview(path);
    store.setPreview(dataUrl);
    try {
      const info = await window.electronAPI.getMediaInfo(path, 'FFMPEG');
      store.setAudioStreams(info.streams.filter((s: MediaStreamInfo) => s.type === 'audio'));
    } catch (err) {
      log.error(LOG_FAILED_TO_LOAD_MEDIA_INFO, err);
    }
  };

  /**
   * Clears the current selection (input file, preview, audio streams, output)
   * via the store and resets all field errors. Used by the preview close button.
   * @returns {void}
   */
  const clearSelection = () => {
    store.clearSelection();
    setErrors({});
  };

  /**
   * Updates the selected audio codec in the store. When an output file is
   * already entered, its extension is rewritten to the extension suggested for
   * the new codec so output path and codec stay consistent.
   * @param {string} value - The newly selected codec name.
   * @returns {void}
   */
  const handleCodecChange = (value: string) => {
    store.setAudioCodec(value);
    if (!store.output.trim()) return;
    const ext = suggestedExtensionForAudioCodec(value);
    if (ext) store.setOutput(replaceExtension(store.output, ext));
  };

  /**
   * Updates the output path in the store. Non-empty values are normalized to
   * carry the extension suggested for the active codec (via `withExtension`);
   * empty values clear the field. The `output` field error is cleared.
   * @param {string} value - The raw output path typed by the user.
   * @returns {void}
   */
  const handleOutputChange = (value: string) => {
    store.setOutput(value.trim() ? withExtension(value, suggestedExt) : '');
    clearFieldError('output');
  };

  /**
   * Validates the extraction form. Currently only requires a non-empty output
   * path; on failure an `output` error is registered and false is returned.
   * @returns {boolean} True when validation passes and extraction may start.
   */
  const validate = (): boolean => {
    if (!store.output.trim()) {
      setErrors({ output: t('validation.outputRequired') });
      return false;
    }
    setErrors({});
    return true;
  };

  /**
   * Validates the form and, when valid, logs the parameters and starts the
   * extraction through the store's `startExtract` (which calls
   * `window.electronAPI.convertFile`). On validation failure a warning is
   * logged and nothing is started.
   * @returns {Promise<void>} Resolves when extraction completes or fails.
   */
  const handleExtract = async () => {
    if (!validate()) {
      log.warn(LOG_VALIDATION_FAILED);
      return;
    }
    log.info(LOG_EXTRACTING_AUDIO, store.input, LOG_ARROW, store.output, LOG_CODEC, store.audioCodec);
    await store.startExtract();
  };

  return (
    <PageContainer title={t('audioExtract.title')} icon={pageIcons['/audio-extract']}>
      <Box>
        <FieldLabel variant="caption" color="text.secondary">
          {t('audioExtract.videoFile')}
          <InfoTooltip title={t('audioExtract.videoFileHint')} />
        </FieldLabel>
        {!store.input && (
          <ErrorBoundary fallback={null}>
            <FileDropZone onFileSelect={handleFileSelect} label={t('audioExtract.dropLabel')} accept={VIDEO_DROPZONE_ACCEPT} />
          </ErrorBoundary>
        )}
        {store.input && (
          <PreviewBox data-testid="video-preview">
            <PreviewImageBox>
              {store.preview && <PreviewImage src={store.preview} alt={fileName(store.input)} />}
              <PreviewCloseButton size="small" aria-label={t('batchQueue.remove')} data-testid="remove-video" onClick={clearSelection}>
                <FontAwesomeIcon icon={faXmark} />
              </PreviewCloseButton>
            </PreviewImageBox>
            <PreviewInfo>
              <Typography variant="body2" color="text.secondary" data-testid="selected-video">
                {(() => {
                  const template = t('audioExtract.selectedVideo', { file: '{{file}}' });
                  const [before, after] = template.split('{{file}}');
                  return (
                    <>
                      {before}
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        {fileName(store.input)}
                      </Box>
                      {after}
                    </>
                  );
                })()}
              </Typography>
              {store.audioStreams.length > 0 && (
                <ErrorBoundary fallback={null}>
                  <AudioStreamInfo streams={store.audioStreams} />
                </ErrorBoundary>
              )}
            </PreviewInfo>
          </PreviewBox>
        )}
      </Box>

      <FilePathField
        label={t('audioExtract.outputFile')}
        hint={t('audioExtract.outputFileHint')}
        value={store.output}
        placeholder={t('audioExtract.placeholderOutput')}
        buttonLabel={t('convert.browse')}
        onChange={handleOutputChange}
        testId="audio-extract-output"
        onBlur={() => {
          if (!store.output.trim()) setFieldError('output', t('validation.outputRequired'));
        }}
        error={errors.output}
        onBrowse={async () => {
          const f = await window.electronAPI.selectOutput();
          if (f) {
            store.setOutput(withExtension(f, suggestedExt));
            clearFieldError('output');
          }
        }}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FieldBox>
          <FieldLabel variant="caption" color="text.secondary">
            {t('audioExtract.audioCodec')}
            <InfoTooltip title={t('audioExtract.audioCodecHint')} />
          </FieldLabel>
          <ErrorBoundary fallback={null}>
            <CodecSelect type="audio" value={store.audioCodec} onChange={handleCodecChange} testId="audio-extract-codec" />
          </ErrorBoundary>
        </FieldBox>
        <FieldBox>
          <FieldLabel variant="caption" color="text.secondary">
            {t('audioExtract.bitrate')}
            <InfoTooltip title={t('audioExtract.bitrateHint')} />
          </FieldLabel>
          <TextField select fullWidth size="small" value={store.audioBitrate} onChange={(e) => store.setAudioBitrate(e.target.value)} data-testid="audio-extract-bitrate">
            {BITRATE_OPTIONS.map((b) => (
              <MenuItem key={b} value={b}>
                {b}
              </MenuItem>
            ))}
          </TextField>
        </FieldBox>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<FontAwesomeIcon icon={faMusic} />}
          onClick={handleExtract}
          disabled={!store.input || !store.output || store.isConverting}
          data-testid="audio-extract-extract"
        >
          {store.isConverting ? t('audioExtract.extracting') : t('audioExtract.extract')}
        </Button>
        {store.isConverting && !store.isPaused && (
          <Button variant="contained" color="warning" startIcon={<FontAwesomeIcon icon={faPause} />} onClick={() => store.pauseExtract()}>
            {t('audioExtract.pause')}
          </Button>
        )}
        {store.isConverting && store.isPaused && (
          <Button variant="contained" color="success" startIcon={<FontAwesomeIcon icon={faPlay} />} onClick={() => store.resumeExtract()}>
            {t('audioExtract.resume')}
          </Button>
        )}
        {store.isConverting && (
          <Button
            variant="contained"
            color="error"
            startIcon={<FontAwesomeIcon icon={faXmark} />}
            onClick={() => setCancelConfirmOpen(true)}
          >
            {t('audioExtract.cancel')}
          </Button>
        )}
      </Stack>

      {store.progress && (
        <ErrorBoundary fallback={null}>
          <ProgressBar
            percent={store.progress.percent}
            time={store.progress.time}
            speed={store.progress.speed}
            eta={store.progress.eta}
            paused={store.isPaused}
          />
        </ErrorBoundary>
      )}

      <ConfirmDialog
        open={cancelConfirmOpen}
        title={t('audioExtract.cancelTitle')}
        message={t('audioExtract.cancelMessage')}
        confirmLabel={t('audioExtract.yes')}
        cancelLabel={t('audioExtract.no')}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => {
          setCancelConfirmOpen(false);
          store.cancelExtract();
        }}
      />
    </PageContainer>
  );
}
