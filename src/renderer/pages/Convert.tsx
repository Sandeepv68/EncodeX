import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, TextField, MenuItem, Switch, Stack, Button } from '@mui/material';
import { faPalette, faBrush, faDroplet, faSun, faPlay, faPause, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Logger } from '../../shared/logger';
import { useConversion } from '../hooks/useConversion';
import CodecSelect from '../components/CodecSelect';
import ProgressBar from '../components/ProgressBar';
import MediaPlayer from '../components/MediaPlayer';
import PageContainer from '../components/PageContainer';
import FilePathField from '../components/FilePathField';
import ConfirmDialog from '../components/ConfirmDialog';
import GroupedSelect from '../components/GroupedSelect';
import InfoTooltip from '../components/InfoTooltip';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PIXEL_FORMATS, VIDEO_BITRATE_OPTIONS, SCALE_OPTIONS, BITRATE_OPTIONS } from '../../shared/media-options';
import { TRANSCODER_TYPES, TRANSCODER_LABELS, CONVERSION_DEFAULTS, QSCALE_RANGE } from '../../shared/transcoder-constants';
import { isInRange } from '../../shared/validation';
import { useFormErrors } from '../hooks/useFormErrors';
import { useSettingsStore } from '../stores/settingsStore';
import { ENCODER_TYPES } from '../../shared/hwaccel-settings';
import type { EncoderType } from '../../shared/hwaccel-settings';
import { ToggleRow, FieldBox, FieldLabel, ActionStack } from '../styles/Convert.styles';

const log = new Logger('renderer/pages/Convert');

const encoderTypeLabel: Record<EncoderType, string> = {
  auto: 'settings.encoderTypeAuto',
  hardware: 'settings.encoderTypeHardware',
  software: 'settings.encoderTypeSoftware',
};

const pixelGroupIcons: Record<string, IconDefinition> = {
  'YUV 8-bit': faPalette,
  'YUV 10-bit': faPalette,
  'YUV 12-bit': faPalette,
  'YUV 16-bit': faPalette,
  'YUV Semi-planar': faPalette,
  'YUV with Alpha': faPalette,
  'RGB Packed': faBrush,
  'Planar RGB': faBrush,
  Monochrome: faDroplet,
  HDR: faSun,
};

const pixelFormatOptions = PIXEL_FORMATS.map((f) => ({ ...f, label: f.value }));

export default function Convert() {
  const { t } = useTranslation();
  const {
    inputFile,
    outputFile,
    videoCodec,
    audioCodec,
    videoBitrate,
    audioBitrate,
    qscale,
    scale,
    pixelFormat,
    copyMode,
    transcoder,
    encoderType,
    isConverting,
    isPaused,
    progress,
    setVideoCodec,
    setAudioCodec,
    setVideoBitrate,
    setAudioBitrate,
    setQscale,
    setScale,
    setPixelFormat,
    setCopyMode,
    setTranscoder,
    setEncoderType,
    startConversion,
    pauseConversion,
    resumeConversion,
    cancelConversion,
    selectInput,
    selectOutput,
    isDirty,
    resetForm,
  } = useConversion();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [jobCancelOpen, setJobCancelOpen] = useState(false);
  const settingsHardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);
  const settingsEncoderType = useSettingsStore((s) => s.encoderType);
  const effectiveEncoderType: EncoderType = encoderType !== 'auto' ? encoderType : settingsEncoderType;

  const validateFields = (): boolean => {
    const next: Record<string, string> = {};
    if (!isInRange(qscale, QSCALE_RANGE.MIN, QSCALE_RANGE.MAX)) next.qscale = t('validation.qscaleRange');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleConfirmCancel = () => {
    setCancelConfirmOpen(false);
    cancelConversion();
  };

  const handleCancelClick = () => {
    setCancelConfirmOpen(true);
  };

  const handleConfirmJobCancel = () => {
    setJobCancelOpen(false);
    resetForm();
  };

  const handleStartConversion = () => {
    if (!validateFields()) {
      log.warn('Validation failed, not starting conversion');
      return;
    }
    log.info('Starting conversion:', inputFile, '->', outputFile);
    startConversion();
  };

  return (
    <PageContainer title={t('convert.title')}>
      <FilePathField
        label={t('convert.inputFile')}
        value={inputFile || ''}
        placeholder={t('convert.noFile')}
        buttonLabel={t('convert.browse')}
        onBrowse={selectInput}
      />

      {inputFile && !isConverting && (
        <ErrorBoundary fallback={null}>
          <MediaPlayer filePath={inputFile} />
        </ErrorBoundary>
      )}

      <FilePathField
        label={t('convert.outputFile')}
        value={outputFile || ''}
        placeholder={t('convert.noOutput')}
        buttonLabel={t('convert.saveAs')}
        onBrowse={selectOutput}
      />

      <ToggleRow>
        <Switch checked={copyMode} onChange={(e) => setCopyMode(e.target.checked)} />
        <Typography variant="caption" color="text.secondary">
          {t('convert.losslessCopy')}
        </Typography>
      </ToggleRow>

      {!copyMode && (
        <>
          {settingsHardwareAcceleration && (
            <FieldBox>
              <FieldLabel variant="caption" color="text.secondary">
                {t('settings.encoderType')}
                <InfoTooltip title={t('convert.encoderTypeHint')} />
              </FieldLabel>
              <TextField select fullWidth size="small" value={encoderType} onChange={(e) => setEncoderType(e.target.value as EncoderType)}>
                {ENCODER_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {t(encoderTypeLabel[type])}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FieldBox>
              <FieldLabel variant="caption" color="text.secondary">
                {t('convert.videoCodec')}
              </FieldLabel>
              <ErrorBoundary fallback={null}>
                <CodecSelect
                  type="video"
                  value={videoCodec}
                  onChange={setVideoCodec}
                  encoderType={settingsHardwareAcceleration ? effectiveEncoderType : 'auto'}
                />
              </ErrorBoundary>
            </FieldBox>
            <FieldBox>
              <FieldLabel variant="caption" color="text.secondary">
                {t('convert.audioCodec')}
              </FieldLabel>
              <ErrorBoundary fallback={null}>
                <CodecSelect type="audio" value={audioCodec} onChange={setAudioCodec} />
              </ErrorBoundary>
            </FieldBox>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FieldBox>
              <FieldLabel variant="caption" color="text.secondary">
                {t('convert.videoBitrate')}
              </FieldLabel>
              <TextField
                select
                fullWidth
                size="small"
                value={videoBitrate}
                onChange={(e) => {
                  setVideoBitrate(e.target.value);
                  clearFieldError('videoBitrate');
                }}
              >
                {VIDEO_BITRATE_OPTIONS.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b || 'Auto'}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
            <FieldBox>
              <FieldLabel variant="caption" color="text.secondary">
                {t('convert.audioBitrate')}
              </FieldLabel>
              <TextField
                select
                fullWidth
                size="small"
                value={audioBitrate}
                onChange={(e) => {
                  setAudioBitrate(e.target.value);
                  clearFieldError('audioBitrate');
                }}
              >
                <MenuItem value="">{t('status.auto')}</MenuItem>
                {BITRATE_OPTIONS.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FieldBox>
              <FieldLabel variant="caption" color="text.secondary">
                {t('convert.qscale')}
              </FieldLabel>
              <TextField
                fullWidth
                size="small"
                type="number"
                error={!!errors.qscale}
                helperText={errors.qscale || ' '}
                value={qscale}
                onChange={(e) => {
                  setQscale(parseInt(e.target.value) || CONVERSION_DEFAULTS.QSCALE);
                  clearFieldError('qscale');
                }}
                onBlur={() => {
                  if (!isInRange(qscale, QSCALE_RANGE.MIN, QSCALE_RANGE.MAX)) setFieldError('qscale', t('validation.qscaleRange'));
                }}
                slotProps={{ htmlInput: { min: QSCALE_RANGE.MIN, max: QSCALE_RANGE.MAX } }}
              />
            </FieldBox>
            <FieldBox>
              <FieldLabel variant="caption" color="text.secondary">
                {t('convert.scale')}
              </FieldLabel>
              <TextField
                select
                fullWidth
                size="small"
                value={scale}
                onChange={(e) => {
                  setScale(e.target.value);
                  clearFieldError('scale');
                }}
              >
                {SCALE_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s || t('status.none')}
                  </MenuItem>
                ))}
              </TextField>
            </FieldBox>
            <FieldBox>
              <FieldLabel variant="caption" color="text.secondary">
                {t('convert.pixelFormat')}
              </FieldLabel>
              <GroupedSelect value={pixelFormat} onChange={setPixelFormat} options={pixelFormatOptions} groupIcons={pixelGroupIcons} />
            </FieldBox>
          </Stack>
        </>
      )}

      <Box>
        <FieldLabel variant="caption" color="text.secondary">
          {t('convert.transcoderCore')}
        </FieldLabel>
        <TextField select fullWidth size="small" value={transcoder} onChange={(e) => setTranscoder(e.target.value)}>
          {TRANSCODER_TYPES.map((tc) => (
            <MenuItem key={tc} value={tc}>
              {TRANSCODER_LABELS[tc]}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <ActionStack direction="row" spacing={1} useFlexGap>
        <Button
          variant="contained"
          startIcon={<FontAwesomeIcon icon={faPlay} />}
          onClick={handleStartConversion}
          disabled={!inputFile || !outputFile || isConverting}
        >
          {isConverting ? t('convert.converting') : t('convert.startConversion')}
        </Button>
        {isConverting && !isPaused && (
          <Button variant="contained" color="warning" startIcon={<FontAwesomeIcon icon={faPause} />} onClick={pauseConversion}>
            {t('convert.pause')}
          </Button>
        )}
        {isConverting && isPaused && (
          <Button variant="contained" color="success" startIcon={<FontAwesomeIcon icon={faPlay} />} onClick={resumeConversion}>
            {t('convert.resume')}
          </Button>
        )}
        {isConverting && (
          <Button variant="contained" color="error" startIcon={<FontAwesomeIcon icon={faXmark} />} onClick={handleCancelClick}>
            {t('convert.cancel')}
          </Button>
        )}
        {isDirty && !isConverting && (
          <Button variant="outlined" color="error" startIcon={<FontAwesomeIcon icon={faXmark} />} onClick={() => setJobCancelOpen(true)}>
            {t('convert.cancelJob')}
          </Button>
        )}
      </ActionStack>

      {progress && (
        <ErrorBoundary fallback={null}>
          <ProgressBar percent={progress.percent} time={progress.time} speed={progress.speed} eta={progress.eta} />
        </ErrorBoundary>
      )}

      <ConfirmDialog
        open={cancelConfirmOpen}
        title={t('convert.cancelTitle')}
        message={t('convert.cancelMessage')}
        confirmLabel={t('convert.yes')}
        cancelLabel={t('convert.no')}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleConfirmCancel}
      />

      <ConfirmDialog
        open={jobCancelOpen}
        title={t('convert.jobCancelTitle')}
        message={t('convert.jobCancelMessage')}
        confirmLabel={t('convert.yes')}
        cancelLabel={t('convert.no')}
        onClose={() => setJobCancelOpen(false)}
        onConfirm={handleConfirmJobCancel}
      />
    </PageContainer>
  );
}
