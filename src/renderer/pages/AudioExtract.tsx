import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, TextField, MenuItem, Button, Stack } from '@mui/material';
import CodecSelect from '../components/CodecSelect';
import FileDropZone from '../components/FileDropZone';
import ProgressBar from '../components/ProgressBar';
import PageContainer from '../components/PageContainer';
import FilePathField from '../components/FilePathField';
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

const log = new Logger('renderer/pages/AudioExtract');

export default function AudioExtract() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [audioCodec, setAudioCodec] = useState('libmp3lame');
  const [audioBitrate, setAudioBitrate] = useState<string>(BITRATE_OPTIONS[1]);
  const { progress, isConverting, runTask } = useMediaTask();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const showErrorMessage = useErrorStore((s) => s.showErrorMessage);
  const transcoder = TRANSCODER_TYPES[0];

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
    await runTask(async () => {
      await window.electronAPI.convertFile(input, output, { audioCodec, audioBitrate }, transcoder);
      useToastStore.getState().success(t('toast.audioExtracted'));
    });
  };

  return (
    <PageContainer title={t('audioExtract.title')}>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          {t('audioExtract.videoFile')}
        </Typography>
        <ErrorBoundary fallback={null}>
          <FileDropZone onFileSelect={setInput} label={t('audioExtract.dropLabel')} accept={VIDEO_DROPZONE_ACCEPT} />
        </ErrorBoundary>
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
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('audioExtract.audioCodec')}
          </Typography>
          <ErrorBoundary fallback={null}>
            <CodecSelect type="audio" value={audioCodec} onChange={setAudioCodec} />
          </ErrorBoundary>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('audioExtract.bitrate')}
          </Typography>
          <TextField select fullWidth size="small" value={audioBitrate} onChange={(e) => setAudioBitrate(e.target.value)}>
            {BITRATE_OPTIONS.map((b) => (
              <MenuItem key={b} value={b}>
                {b}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Stack>

      <Button variant="contained" onClick={handleExtract} disabled={!input || !output || isConverting}>
        {isConverting ? t('audioExtract.extracting') : t('audioExtract.extract')}
      </Button>

      {progress && (
        <ErrorBoundary fallback={null}>
          <ProgressBar percent={progress.percent} />
        </ErrorBoundary>
      )}
    </PageContainer>
  );
}
