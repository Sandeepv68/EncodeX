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
import { pageIcons } from '../pageIcons';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { useToastStore } from '../stores/toastStore';
import { ErrorCode } from '../../shared/errors';
import { BITRATE_OPTIONS } from '../../shared/media-options';
import { VIDEO_DROPZONE_ACCEPT } from '../../shared/file-extensions';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { useMediaTask } from '../hooks/useMediaTask';
import { useFormErrors } from '../hooks/useFormErrors';
import { replaceExtension, suggestedExtensionForAudioCodec } from '../../shared/codec-containers';
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

export default function AudioExtract() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [audioCodec, setAudioCodec] = useState('libmp3lame');
  const [audioBitrate, setAudioBitrate] = useState<string>(BITRATE_OPTIONS[1]);
  const [isPaused, setIsPaused] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const { progress, setProgress, isConverting, runTask } = useMediaTask();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const showErrorMessage = useErrorStore((s) => s.showErrorMessage);
  const transcoder = TRANSCODER_TYPES[0];

  const handleFileSelect = async (path: string) => {
    setInput(path);
    setPreview(null);
    if (!path) return;
    const dataUrl = await window.electronAPI.getVideoPreview(path);
    setPreview(dataUrl);
  };

  const clearSelection = () => {
    setInput('');
    setPreview(null);
    setErrors({});
  };

  const handleCodecChange = (value: string) => {
    setAudioCodec(value);
    if (!output.trim()) return;
    const ext = suggestedExtensionForAudioCodec(value);
    if (ext) setOutput(replaceExtension(output, ext));
  };

  const validate = (): boolean => {
    if (!output.trim()) {
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
    if (!input) {
      log.warn('No input file selected');
      showErrorMessage(ErrorCode.INPUT_NOT_SPECIFIED, t('audioExtract.validationRequired'));
      return;
    }
    log.info('Extracting audio:', input, '->', output, 'codec:', audioCodec);
    setIsPaused(false);
    await runTask(async () => {
      await window.electronAPI.convertFile(input, output, { audioCodec, audioBitrate }, transcoder);
      useToastStore.getState().success(t('toast.audioExtracted'));
    });
    setProgress(null);
  };

  const handlePause = async () => {
    log.info('Pausing extraction');
    await window.electronAPI.pauseConversion();
    setIsPaused(true);
  };

  const handleResume = async () => {
    log.info('Resuming extraction');
    await window.electronAPI.resumeConversion();
    setIsPaused(false);
  };

  const handleCancelClick = () => {
    setCancelConfirmOpen(true);
  };

  const handleConfirmCancel = async () => {
    log.info('Cancelling extraction');
    setCancelConfirmOpen(false);
    await window.electronAPI.cancelConversion();
    setProgress(null);
  };

  return (
    <PageContainer title={t('audioExtract.title')} icon={pageIcons['/audio-extract']}>
      <Box>
        <FieldLabel variant="caption" color="text.secondary">
          {t('audioExtract.videoFile')}
        </FieldLabel>
        {!input && (
          <ErrorBoundary fallback={null}>
            <FileDropZone onFileSelect={handleFileSelect} label={t('audioExtract.dropLabel')} accept={VIDEO_DROPZONE_ACCEPT} />
          </ErrorBoundary>
        )}
        {input && (
          <PreviewBox data-testid="video-preview">
            <PreviewImageBox>
              {preview && <PreviewImage src={preview} alt={fileName(input)} />}
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
                        {fileName(input)}
                      </Box>
                      {after}
                    </>
                  );
                })()}
              </Typography>
            </PreviewInfo>
          </PreviewBox>
        )}
      </Box>

      <FilePathField
        label={t('audioExtract.outputFile')}
        value={output}
        placeholder={t('audioExtract.placeholderOutput')}
        buttonLabel={t('convert.browse')}
        onChange={(v) => {
          setOutput(v);
          clearFieldError('output');
        }}
        onBlur={() => {
          if (!output.trim()) setFieldError('output', t('validation.outputRequired'));
        }}
        error={errors.output}
        onBrowse={async () => {
          const f = await window.electronAPI.selectOutput();
          if (f) {
            setOutput(f);
            clearFieldError('output');
          }
        }}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FieldBox>
          <FieldLabel variant="caption" color="text.secondary">
            {t('audioExtract.audioCodec')}
          </FieldLabel>
          <ErrorBoundary fallback={null}>
            <CodecSelect type="audio" value={audioCodec} onChange={handleCodecChange} />
          </ErrorBoundary>
        </FieldBox>
        <FieldBox>
          <FieldLabel variant="caption" color="text.secondary">
            {t('audioExtract.bitrate')}
          </FieldLabel>
          <TextField select fullWidth size="small" value={audioBitrate} onChange={(e) => setAudioBitrate(e.target.value)}>
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
          disabled={!input || !output || isConverting}
        >
          {isConverting ? t('audioExtract.extracting') : t('audioExtract.extract')}
        </Button>
        {isConverting && !isPaused && (
          <Button variant="contained" color="warning" startIcon={<FontAwesomeIcon icon={faPause} />} onClick={handlePause}>
            {t('audioExtract.pause')}
          </Button>
        )}
        {isConverting && isPaused && (
          <Button variant="contained" color="success" startIcon={<FontAwesomeIcon icon={faPlay} />} onClick={handleResume}>
            {t('audioExtract.resume')}
          </Button>
        )}
        {isConverting && (
          <Button variant="contained" color="error" startIcon={<FontAwesomeIcon icon={faXmark} />} onClick={handleCancelClick}>
            {t('audioExtract.cancel')}
          </Button>
        )}
      </Stack>

      {progress && (
        <ErrorBoundary fallback={null}>
          <ProgressBar percent={progress.percent} time={progress.time} speed={progress.speed} eta={progress.eta} paused={isPaused} />
        </ErrorBoundary>
      )}

      <ConfirmDialog
        open={cancelConfirmOpen}
        title={t('audioExtract.cancelTitle')}
        message={t('audioExtract.cancelMessage')}
        confirmLabel={t('audioExtract.yes')}
        cancelLabel={t('audioExtract.no')}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleConfirmCancel}
      />
    </PageContainer>
  );
}
