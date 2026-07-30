import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, TextField, Button, Paper, Stack, Switch } from '@mui/material';
import ErrorBanner from '../components/ErrorBanner';
import MediaPlayer from '../components/MediaPlayer';
import ProgressBar from '../components/ProgressBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { useToastStore } from '../stores/toastStore';
import { ErrorCode } from '../../shared/errors';
import { isValidTime } from '../../shared/validation';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';

const log = new Logger('renderer/pages/VideoCut');

export default function VideoCut() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; time?: string; speed?: string; eta?: string } | null>(null);
  const [useDuration, setUseDuration] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { currentError, showError, showErrorMessage, clearError: clearErrorBanner } = useErrorStore();
  const transcoder = TRANSCODER_TYPES[0];

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!output.trim()) next.output = t('validation.outputRequired');
    if (startTime && !isValidTime(startTime)) next.startTime = t('validation.invalidTime');
    if (useDuration) {
      if (!duration.trim()) next.duration = t('validation.durationRequired');
      else if (!isValidTime(duration)) next.duration = t('validation.invalidTime');
    } else if (endTime.trim() && !isValidTime(endTime)) {
      next.endTime = t('validation.invalidTime');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCut = async () => {
    if (!validate()) {
      log.warn('Validation failed');
      return;
    }
    if (!input) {
      log.warn('No input file selected');
      showErrorMessage(ErrorCode.INPUT_NOT_SPECIFIED, t('videoCut.validationRequired'));
      return;
    }
    log.info('Cutting video:', input, '->', output, 'start:', startTime, 'useDuration:', useDuration);
    setIsConverting(true);
    try {
      await window.electronAPI.convertFile(
        input,
        output,
        {
          copy: true,
          startTime,
          ...(useDuration ? { duration } : { endTime }),
        },
        transcoder,
      );
      setProgress({ percent: 100, time: 'Done', speed: '-', eta: '0' });
      useToastStore.getState().success(t('toast.videoCut'));
    } catch (err: unknown) {
      showError(err);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        {t('videoCut.title')}
      </Typography>
      <Paper sx={{ p: { xs: 2, sm: 3 }, width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentError && (
          <ErrorBoundary fallback={null}>
            <ErrorBanner error={currentError} onClose={clearErrorBanner} />
          </ErrorBoundary>
        )}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('videoCut.videoFile')}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <TextField
              fullWidth
              size="small"
              value={input || ''}
              placeholder={t('videoCut.noFile')}
              slotProps={{ input: { readOnly: true } }}
              sx={{ minWidth: 200, flex: 1 }}
            />
            <Button
              variant="outlined"
              onClick={async () => {
                const f = await window.electronAPI.selectFile();
                if (f) setInput(f);
              }}
            >
              {t('videoCut.browse')}
            </Button>
          </Stack>
        </Box>

        {input && (
          <ErrorBoundary fallback={null}>
            <MediaPlayer filePath={input} />
          </ErrorBoundary>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('videoCut.outputFile')}
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
                clearFieldError('output');
              }}
              onBlur={() => {
                if (!output.trim()) setErrors((prev) => ({ ...prev, output: t('validation.outputRequired') }));
              }}
              placeholder={t('videoCut.placeholderOutput')}
              sx={{ minWidth: 200, flex: 1 }}
            />
            <Button
              variant="outlined"
              onClick={async () => {
                const f = await window.electronAPI.selectOutput();
                if (f) {
                  setOutput(f);
                  clearFieldError('output');
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
              {t('videoCut.startTime')}
            </Typography>
            <TextField
              fullWidth
              size="small"
              error={!!errors.startTime}
              helperText={errors.startTime || ' '}
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                clearFieldError('startTime');
              }}
              onBlur={() => {
                if (startTime && !isValidTime(startTime)) setErrors((prev) => ({ ...prev, startTime: t('validation.invalidTime') }));
              }}
              placeholder={t('videoCut.placeholderStart')}
            />
          </Box>
          {useDuration ? (
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('videoCut.duration')}
              </Typography>
              <TextField
                fullWidth
                size="small"
                error={!!errors.duration}
                helperText={errors.duration || ' '}
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  clearFieldError('duration');
                }}
                onBlur={() => {
                  if (duration && !isValidTime(duration)) setErrors((prev) => ({ ...prev, duration: t('validation.invalidTime') }));
                }}
                placeholder={t('videoCut.placeholderDuration')}
              />
            </Box>
          ) : (
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('videoCut.endTime')}
              </Typography>
              <TextField
                fullWidth
                size="small"
                error={!!errors.endTime}
                helperText={errors.endTime || ' '}
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  clearFieldError('endTime');
                }}
                onBlur={() => {
                  if (endTime && !isValidTime(endTime)) setErrors((prev) => ({ ...prev, endTime: t('validation.invalidTime') }));
                }}
                placeholder={t('videoCut.placeholderEnd')}
              />
            </Box>
          )}
        </Stack>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Switch checked={useDuration} onChange={() => setUseDuration(!useDuration)} />
          <Typography variant="caption" color="text.secondary">
            {t('videoCut.useDuration')}
          </Typography>
        </Box>

        <Button variant="contained" onClick={handleCut} disabled={!input || !output || isConverting}>
          {isConverting ? t('videoCut.cutting') : t('videoCut.cut')}
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
