import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, TextField, MenuItem, Switch, Stack, Button, CircularProgress, IconButton } from '@mui/material';
import { faPalette, faBrush, faDroplet, faSun, faPlay, faPause, faXmark, faEye } from '@fortawesome/free-solid-svg-icons';
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
import FileSummary from '../components/FileSummary';
import StreamDetails from '../components/StreamDetails';
import { pageIcons } from '../pageIcons';
import GroupedSelect from '../components/GroupedSelect';
import InfoTooltip from '../components/InfoTooltip';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PIXEL_FORMATS, VIDEO_BITRATE_OPTIONS, SCALE_OPTIONS, BITRATE_OPTIONS } from '../../shared/media-options';
import { TRANSCODER_TYPES, TRANSCODER_LABELS, CONVERSION_DEFAULTS, QSCALE_RANGE } from '../../shared/transcoder-constants';
import { MediaInfo as MediaInfoType } from '../../shared/types';
import { isInRange } from '../../shared/validation';
import { useFormErrors } from '../hooks/useFormErrors';
import { useSettingsStore } from '../stores/settingsStore';
import { ENCODER_TYPES } from '../../shared/hwaccel-settings';
import type { EncoderType } from '../../shared/hwaccel-settings';
import {
  ToggleRow,
  FieldBox,
  FieldLabel,
  ActionStack,
  AccelAlert,
  CompatAlert,
  PreviewPanel,
  PreviewHeader,
  PreviewDivider,
  PreviewSectionTitle,
} from '../styles/Convert.styles';
import {
  getExtension,
  replaceExtension,
  suggestedExtensionForVideoCodec,
  isExtensionCompatibleWithVideoCodec,
} from '../../shared/codec-containers';
import {
  LOG_ARROW,
  LOG_FAILED_TO_LOAD_MEDIA_INFO_FOR_PREVIEW,
  LOG_STARTING_CONVERSION,
  LOG_VALIDATION_FAILED_NOT_STARTING_CONVERSION,
} from '../../shared/log-constants';

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
    outputUserSet,
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
    setOutputFile,
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
  const [previewOpen, setPreviewOpen] = useState(true);
  const [mediaInfo, setMediaInfo] = useState<MediaInfoType | null>(null);
  const [mediaInfoLoading, setMediaInfoLoading] = useState(false);
  const settingsHardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);
  const settingsEncoderType = useSettingsStore((s) => s.encoderType);
  const effectiveEncoderType: EncoderType = encoderType !== 'auto' ? encoderType : settingsEncoderType;
  const outputExt = getExtension(outputFile || '');
  const suggestedOutputExt = suggestedExtensionForVideoCodec(videoCodec);
  const showCompatWarning =
    !copyMode &&
    !isConverting &&
    !!outputFile &&
    !!outputExt &&
    outputUserSet &&
    !isExtensionCompatibleWithVideoCodec(outputExt, videoCodec);

  const applySuggestedExtension = () => {
    if (!outputFile) return;
    setOutputFile(replaceExtension(outputFile, suggestedOutputExt));
  };

  useEffect(() => {
    if (!inputFile || !previewOpen) {
      setMediaInfo(null);
      setMediaInfoLoading(false);
      return;
    }
    let cancelled = false;
    setMediaInfoLoading(true);
    window.electronAPI
      .getMediaInfo(inputFile, 'FFMPEG')
      .then((info) => {
        if (!cancelled) setMediaInfo(info);
      })
      .catch((err) => log.error(LOG_FAILED_TO_LOAD_MEDIA_INFO_FOR_PREVIEW, err))
      .finally(() => {
        if (!cancelled) setMediaInfoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inputFile, previewOpen]);

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
      log.warn(LOG_VALIDATION_FAILED_NOT_STARTING_CONVERSION);
      return;
    }
    log.info(LOG_STARTING_CONVERSION, inputFile, LOG_ARROW, outputFile);
    startConversion();
  };

  return (
    <PageContainer
      title={t('convert.title')}
      icon={pageIcons['/convert']}
      aside={
        previewOpen && inputFile ? (
          <PreviewPanel>
            <PreviewHeader>
              <Typography variant="h6">{t('convert.preview')}</Typography>
              <IconButton size="small" aria-label={t('convert.closePreview')} onClick={() => setPreviewOpen(false)}>
                <FontAwesomeIcon icon={faXmark} />
              </IconButton>
            </PreviewHeader>
            {
              <ErrorBoundary fallback={null}>
                <MediaPlayer filePath={inputFile} />
              </ErrorBoundary>
            }
            <Box>
              <PreviewSectionTitle variant="subtitle2" color="text.secondary">
                {t('mediaInfo.fileInfo')}
              </PreviewSectionTitle>
              {mediaInfoLoading && !mediaInfo && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {mediaInfo && (
                <ErrorBoundary fallback={null}>
                  <FileSummary info={mediaInfo} compact />
                  <StreamDetails streams={mediaInfo.streams} compact />
                </ErrorBoundary>
              )}
            </Box>
          </PreviewPanel>
        ) : undefined
      }
    >
      <FilePathField
        label={t('convert.inputFile')}
        hint={t('convert.inputFileHint')}
        value={inputFile || ''}
        placeholder={t('convert.noFile')}
        buttonLabel={t('convert.browse')}
        onBrowse={selectInput}
      />

      {inputFile && !previewOpen && (
        <Button
          variant="outlined"
          startIcon={<FontAwesomeIcon icon={faEye} />}
          onClick={() => setPreviewOpen(true)}
          sx={{ alignSelf: 'flex-start' }}
        >
          {t('convert.showPreview')}
        </Button>
      )}

      <FilePathField
        label={t('convert.outputFile')}
        hint={t('convert.outputFileHint')}
        value={outputFile || ''}
        placeholder={t('convert.noOutput')}
        buttonLabel={t('convert.saveAs')}
        onBrowse={selectOutput}
      />

      {showCompatWarning && (
        <CompatAlert
          severity="warning"
          action={
            <Button size="small" color="inherit" onClick={applySuggestedExtension}>
              {t('convert.applySuggestedExt', { extension: suggestedOutputExt })}
            </Button>
          }
        >
          {t('convert.codecCompatWarning', { codec: videoCodec, extension: outputExt, suggested: suggestedOutputExt })}
        </CompatAlert>
      )}

      <ToggleRow>
        <Switch checked={copyMode} onChange={(e) => setCopyMode(e.target.checked)} />
        <Typography variant="caption" color="text.secondary">
          {t('convert.losslessCopy')}
        </Typography>
        <InfoTooltip title={t('convert.losslessCopyHint')} />
      </ToggleRow>

      {!copyMode && (
        <>
          {settingsHardwareAcceleration && (
            <>
              <AccelAlert severity="info">{t('convert.hardwareAccelAlert')}</AccelAlert>
              <FieldBox>
                <FieldLabel variant="caption" color="text.secondary">
                  {t('settings.encoderType')}
                  <InfoTooltip title={t('convert.encoderTypeHint')} />
                </FieldLabel>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={encoderType}
                  onChange={(e) => setEncoderType(e.target.value as EncoderType)}
                >
                  {ENCODER_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {t(encoderTypeLabel[type])}
                    </MenuItem>
                  ))}
                </TextField>
              </FieldBox>
            </>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FieldBox>
              <FieldLabel variant="caption" color="text.secondary">
                {t('convert.videoCodec')}
                <InfoTooltip title={t('convert.videoCodecHint')} />
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
                <InfoTooltip title={t('convert.audioCodecHint')} />
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
                <InfoTooltip title={t('convert.videoBitrateHint')} />
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
                <InfoTooltip title={t('convert.audioBitrateHint')} />
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
                <InfoTooltip title={t('convert.qscaleHint')} />
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
                <InfoTooltip title={t('convert.scaleHint')} />
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
                <InfoTooltip title={t('convert.pixelFormatHint')} />
              </FieldLabel>
              <GroupedSelect value={pixelFormat} onChange={setPixelFormat} options={pixelFormatOptions} groupIcons={pixelGroupIcons} />
            </FieldBox>
          </Stack>
        </>
      )}

      <Box>
        <FieldLabel variant="caption" color="text.secondary">
          {t('convert.transcoderCore')}
          <InfoTooltip title={t('convert.transcoderCoreHint')} />
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
          <ProgressBar percent={progress.percent} time={progress.time} speed={progress.speed} eta={progress.eta} paused={isPaused} />
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
