import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, TextField, MenuItem, Button, Paper, Stack } from '@mui/material';
import CodecSelect from '../components/CodecSelect';
import ErrorBanner from '../components/ErrorBanner';
import FileDropZone from '../components/FileDropZone';
import ProgressBar from '../components/ProgressBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { ErrorCode } from '../../shared/errors';
import { BITRATE_OPTIONS } from '../../shared/ui-constants';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';

const log = new Logger('renderer/pages/AudioExtract');

export default function AudioExtract() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [audioCodec, setAudioCodec] = useState('libmp3lame');
  const [audioBitrate, setAudioBitrate] = useState(BITRATE_OPTIONS[1]);
  const [progress, setProgress] = useState<{ percent: number; time?: string; speed?: string; eta?: string } | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { currentError, showError, showErrorMessage, clearError } = useErrorStore();
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
    setIsConverting(true);
    try {
      await window.electronAPI.convertFile(input, output, { audioCodec, audioBitrate }, transcoder);
      setProgress({ percent: 100, time: 'Done', speed: '-', eta: '0' });
    } catch (err: unknown) {
      showError(err);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        {t('audioExtract.title')}
      </Typography>
      <Paper sx={{ p: { xs: 2, sm: 3 }, width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentError && (
          <ErrorBoundary fallback={null}>
            <ErrorBanner error={currentError} onClose={clearError} />
          </ErrorBoundary>
        )}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('audioExtract.videoFile')}
          </Typography>
          <ErrorBoundary fallback={null}>
            <FileDropZone onFileSelect={setInput} label={t('audioExtract.dropLabel')} accept="mp4,avi,mkv,mov,flv,wmv,webm" />
          </ErrorBoundary>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('audioExtract.outputFile')}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <TextField
              fullWidth
              size="small"
              error={!!errors.output}
              helperText={errors.output || ' '}
              value={output}
              onChange={(e) => {
                setOutput(e.target.value);
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.output;
                  return next;
                });
              }}
              onBlur={() => {
                if (!output.trim()) setErrors((prev) => ({ ...prev, output: t('validation.outputRequired') }));
              }}
              placeholder={t('audioExtract.placeholderOutput')}
              sx={{ minWidth: 200, flex: 1 }}
            />
            <Button
              variant="outlined"
              onClick={async () => {
                const f = await window.electronAPI.selectOutput();
                if (f) {
                  setOutput(f);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.output;
                    return next;
                  });
                }
              }}
            >
              {t('convert.browse')}
            </Button>
          </Stack>
        </Box>
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
      </Paper>
    </Box>
  );
}
