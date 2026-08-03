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

const log = new Logger('renderer/pages/AudioExtract');

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function withExtension(path: string, ext: string): string {
  const slashIdx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const dotIdx = path.lastIndexOf('.');
  const base = dotIdx > slashIdx ? path.slice(0, dotIdx) : path;
  return `${base}.${ext}`;
}

export default function AudioExtract() {
  const { t } = useTranslation();
  const store = useAudioExtractStore();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const suggestedExt = suggestedExtensionForAudioCodec(store.audioCodec);

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
      log.error('Failed to load media info:', err);
    }
  };

  const clearSelection = () => {
    store.clearSelection();
    setErrors({});
  };

  const handleCodecChange = (value: string) => {
    store.setAudioCodec(value);
    if (!store.output.trim()) return;
    const ext = suggestedExtensionForAudioCodec(value);
    if (ext) store.setOutput(replaceExtension(store.output, ext));
  };

  const handleOutputChange = (value: string) => {
    store.setOutput(value.trim() ? withExtension(value, suggestedExt) : '');
    clearFieldError('output');
  };

  const validate = (): boolean => {
    if (!store.output.trim()) {
      setErrors({ output: t('validation.outputRequired') });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleExtract = async () => {
    if (!validate()) {
      log.warn('Validation failed');
      return;
    }
    log.info('Extracting audio:', store.input, '->', store.output, 'codec:', store.audioCodec);
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
            <CodecSelect type="audio" value={store.audioCodec} onChange={handleCodecChange} />
          </ErrorBoundary>
        </FieldBox>
        <FieldBox>
          <FieldLabel variant="caption" color="text.secondary">
            {t('audioExtract.bitrate')}
            <InfoTooltip title={t('audioExtract.bitrateHint')} />
          </FieldLabel>
          <TextField select fullWidth size="small" value={store.audioBitrate} onChange={(e) => store.setAudioBitrate(e.target.value)}>
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
