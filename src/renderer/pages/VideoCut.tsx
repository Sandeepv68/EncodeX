import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, Switch, Button, Typography } from '@mui/material';
import { faScissors } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PageContainer from '../components/PageContainer';
import FilePathField from '../components/FilePathField';
import TimeField from '../components/TimeField';
import MediaPlayer from '../components/MediaPlayer';
import ProgressBar from '../components/ProgressBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { useToastStore } from '../stores/toastStore';
import { ErrorCode } from '../../shared/errors';
import { isValidTime } from '../../shared/validation';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { useMediaTask } from '../hooks/useMediaTask';
import { useFormErrors } from '../hooks/useFormErrors';
import { ToggleRow } from '../styles/VideoCut.styles';

const log = new Logger('renderer/pages/VideoCut');

export default function VideoCut() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState('');
  const [useDuration, setUseDuration] = useState(false);
  const { progress, isConverting, runTask } = useMediaTask();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const showErrorMessage = useErrorStore((s) => s.showErrorMessage);
  const transcoder = TRANSCODER_TYPES[0];

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
    await runTask(async () => {
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
      useToastStore.getState().success(t('toast.videoCut'));
    });
  };

  return (
    <PageContainer title={t('videoCut.title')}>
      <FilePathField
        label={t('videoCut.videoFile')}
        value={input || ''}
        placeholder={t('videoCut.noFile')}
        buttonLabel={t('videoCut.browse')}
        onBrowse={async () => {
          const f = await window.electronAPI.selectFile();
          if (f) setInput(f);
        }}
      />

      {input && (
        <ErrorBoundary fallback={null}>
          <MediaPlayer filePath={input} />
        </ErrorBoundary>
      )}

      <FilePathField
        label={t('videoCut.outputFile')}
        value={output}
        placeholder={t('videoCut.placeholderOutput')}
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
        <TimeField
          label={t('videoCut.startTime')}
          value={startTime}
          placeholder={t('videoCut.placeholderStart')}
          error={errors.startTime}
          onChange={(v) => {
            setStartTime(v);
            clearFieldError('startTime');
          }}
          onBlur={() => {
            if (startTime && !isValidTime(startTime)) setFieldError('startTime', t('validation.invalidTime'));
          }}
        />
        {useDuration ? (
          <TimeField
            label={t('videoCut.duration')}
            value={duration}
            placeholder={t('videoCut.placeholderDuration')}
            error={errors.duration}
            onChange={(v) => {
              setDuration(v);
              clearFieldError('duration');
            }}
            onBlur={() => {
              if (duration && !isValidTime(duration)) setFieldError('duration', t('validation.invalidTime'));
            }}
          />
        ) : (
          <TimeField
            label={t('videoCut.endTime')}
            value={endTime}
            placeholder={t('videoCut.placeholderEnd')}
            error={errors.endTime}
            onChange={(v) => {
              setEndTime(v);
              clearFieldError('endTime');
            }}
            onBlur={() => {
              if (endTime && !isValidTime(endTime)) setFieldError('endTime', t('validation.invalidTime'));
            }}
          />
        )}
      </Stack>

      <ToggleRow>
        <Switch checked={useDuration} onChange={() => setUseDuration(!useDuration)} />
        <Typography variant="caption" color="text.secondary">
          {t('videoCut.useDuration')}
        </Typography>
      </ToggleRow>

      <Button
        variant="contained"
        startIcon={<FontAwesomeIcon icon={faScissors} />}
        onClick={handleCut}
        disabled={!input || !output || isConverting}
      >
        {isConverting ? t('videoCut.cutting') : t('videoCut.cut')}
      </Button>

      {progress && (
        <ErrorBoundary fallback={null}>
          <ProgressBar percent={progress.percent} />
        </ErrorBoundary>
      )}
    </PageContainer>
  );
}
