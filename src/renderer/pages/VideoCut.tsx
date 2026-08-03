import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, Switch, Button, Typography, Tooltip, Box } from '@mui/material';
import { faScissors, faPause, faPlay, faXmark, faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PageContainer from '../components/PageContainer';
import FilePathField from '../components/FilePathField';
import FileDropZone from '../components/FileDropZone';
import InfoTooltip from '../components/InfoTooltip';
import ConfirmDialog from '../components/ConfirmDialog';
import { pageIcons } from '../pageIcons';
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
import { VIDEO_DROPZONE_ACCEPT } from '../../shared/file-extensions';
import { FieldLabel } from '../styles/FilePathField.styles';
import { ToggleRow } from '../styles/VideoCut.styles';

const log = new Logger('renderer/pages/VideoCut');

function timeToSeconds(value: string): number | null {
  if (!value.trim()) return null;
  if (/^\d+(\.\d+)?$/.test(value.trim())) return parseFloat(value.trim());
  const match = /^(\d{1,2}):(\d{2}):(\d{2})(\.\d+)?$/.exec(value.trim());
  if (!match) return null;
  return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10) + (match[4] ? parseFloat(match[4]) : 0);
}

function secondsToTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const base = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return ms > 0 ? `${base}.${ms.toString().padStart(3, '0')}` : base;
}

export default function VideoCut() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState('');
  const [useDuration, setUseDuration] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const { progress, setProgress, isConverting, runTask } = useMediaTask();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const showErrorMessage = useErrorStore((s) => s.showErrorMessage);
  const transcoder = TRANSCODER_TYPES[0];

  const startSeconds = timeToSeconds(startTime) ?? 0;
  const endSeconds = endTime ? (timeToSeconds(endTime) ?? undefined) : undefined;

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

  const resetForm = () => {
    setInput('');
    setOutput('');
    setStartTime('00:00:00');
    setEndTime('');
    setDuration('');
    setUseDuration(false);
    setIsPaused(false);
    setProgress(null);
    setErrors({});
  };

  const handleFileSelect = (path: string) => {
    setInput(path);
    setStartTime('00:00:00');
    setEndTime('');
    setDuration('');
  };

  const handleBrowseVideo = async () => {
    const extList = [{ name: 'Files', extensions: VIDEO_DROPZONE_ACCEPT.split(',').map((s) => s.trim()) }];
    const file = await window.electronAPI.selectFile(extList);
    if (file) handleFileSelect(file);
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

  const pauseCut = async () => {
    log.info('Pausing cut job');
    await window.electronAPI.pauseConversion();
    setIsPaused(true);
  };

  const resumeCut = async () => {
    log.info('Resuming cut job');
    await window.electronAPI.resumeConversion();
    setIsPaused(false);
  };

  const handleConfirmCancel = async () => {
    setCancelConfirmOpen(false);
    log.info('Cancelling cut job');
    await window.electronAPI.cancelConversion();
    resetForm();
  };

  return (
    <PageContainer title={t('videoCut.title')} icon={pageIcons['/video-cut']}>
      <Box>
        <FieldLabel variant="caption" color="text.secondary">
          {t('videoCut.videoFile')}
          <InfoTooltip title={t('videoCut.videoFileHint')} />
        </FieldLabel>
        {!input ? (
          <ErrorBoundary fallback={null}>
            <FileDropZone onFileSelect={handleFileSelect} label={t('videoCut.dropLabel')} accept={VIDEO_DROPZONE_ACCEPT} />
          </ErrorBoundary>
        ) : (
          <Tooltip title={t('videoCut.changeFileHint')} arrow>
            <Button variant="outlined" startIcon={<FontAwesomeIcon icon={faFolderOpen} />} onClick={handleBrowseVideo}>
              {t('videoCut.changeFile')}
            </Button>
          </Tooltip>
        )}
      </Box>

      {input && (
        <ErrorBoundary fallback={null}>
          <MediaPlayer
            filePath={input}
            startMarker={startSeconds}
            endMarker={endSeconds}
            onStartMarkerChange={(s) => setStartTime(secondsToTime(s))}
            onEndMarkerChange={(s) => setEndTime(secondsToTime(s))}
          />
        </ErrorBoundary>
      )}

      <FilePathField
        label={t('videoCut.outputFile')}
        hint={t('videoCut.outputFileHint')}
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
          hint={t('videoCut.startTimeHint')}
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
            hint={t('videoCut.durationHint')}
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
            hint={t('videoCut.endTimeHint')}
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
        <InfoTooltip title={t('videoCut.useDurationHint')} />
      </ToggleRow>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Tooltip title={t('videoCut.cutHint')} arrow>
          <span>
            <Button
              variant="contained"
              startIcon={<FontAwesomeIcon icon={faScissors} />}
              onClick={handleCut}
              disabled={!input || !output || isConverting}
            >
              {isConverting ? t('videoCut.cutting') : t('videoCut.cut')}
            </Button>
          </span>
        </Tooltip>
        {isConverting && !isPaused && (
          <Button variant="contained" color="warning" startIcon={<FontAwesomeIcon icon={faPause} />} onClick={pauseCut}>
            {t('videoCut.pause')}
          </Button>
        )}
        {isConverting && isPaused && (
          <Button variant="contained" color="success" startIcon={<FontAwesomeIcon icon={faPlay} />} onClick={resumeCut}>
            {t('videoCut.resume')}
          </Button>
        )}
        {isConverting && (
          <Button
            variant="contained"
            color="error"
            startIcon={<FontAwesomeIcon icon={faXmark} />}
            onClick={() => setCancelConfirmOpen(true)}
          >
            {t('videoCut.cancel')}
          </Button>
        )}
      </Stack>

      {progress && isConverting && (
        <ErrorBoundary fallback={null}>
          <ProgressBar percent={progress.percent} time={progress.time} speed={progress.speed} eta={progress.eta} paused={isPaused} />
        </ErrorBoundary>
      )}

      <ConfirmDialog
        open={cancelConfirmOpen}
        title={t('videoCut.cancelTitle')}
        message={t('videoCut.cancelMessage')}
        confirmLabel={t('videoCut.yes')}
        cancelLabel={t('videoCut.no')}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleConfirmCancel}
      />
    </PageContainer>
  );
}
