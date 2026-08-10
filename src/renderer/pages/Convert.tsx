/**
 * @fileoverview Single-file video conversion page. Lets the user pick a source
 * file, configure codecs, bitrates, quality, scaling, pixel format, and the
 * transcoder backend, then convert the file. Corresponds to the `/convert`
 * route and is the destination of the Dashboard "Convert Video" feature card.
 *
 * Workflow: select an input file (the output path is auto-suggested unless the
 * user sets one) -> optionally enable lossless copy mode -> configure encoding
 * options -> start the conversion. While configured, a preview panel shows the
 * source file in the built-in MediaPlayer next to a compact file/stream
 * summary; the panel can be closed and reopened.
 *
 * State is managed by the `useConversion` hook backed by the
 * `useConversionStore` zustand store; validation errors live in `useFormErrors`.
 * All encoding is delegated to the main process through `window.electronAPI`
 * (`selectFile`, `selectOutput`, `getMediaInfo`, `convertFile`,
 * `pauseConversion`, `resumeConversion`, `cancelConversion`), with progress
 * streamed back via `onConversionProgress`.
 */

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
import type { EncoderType } from '../../shared/types';
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

/**
 * Logger instance scoped to this page. Reports preview media-info load
 * failures, validation failures, and conversion starts.
 * @const {Logger} log
 */
const log = new Logger('renderer/pages/Convert');

/**
 * Maps encoder types to i18n translation keys for the encoder-type selector.
 * @const {Record<EncoderType, string>} encoderTypeLabel
 */
const encoderTypeLabel: Record<EncoderType, string> = {
  auto: 'settings.encoderTypeAuto',
  hardware: 'settings.encoderTypeHardware',
  software: 'settings.encoderTypeSoftware',
};

/**
 * Maps pixel-format group names to FontAwesome icons used by the GroupedSelect
 * pixel-format picker, giving each group a distinct visual cue.
 * @const {Record<string, IconDefinition>} pixelGroupIcons
 */
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

/**
 * Pixel-format options prepared for the GroupedSelect: every entry of
 * PIXEL_FORMATS is spread and given a `label` equal to its `value` so the
 * select can render the format string.
 * @const {Array<{value: string; group: string; label: string}>} pixelFormatOptions
 */
const pixelFormatOptions = PIXEL_FORMATS.map((f) => ({ ...f, label: f.value }));

/**
 * Renders the single-file conversion page (`/convert`).
 *
 * Layout: input and output file fields (with a codec-compatibility warning when
 * the chosen output extension clashes with the selected video codec), a
 * lossless-copy toggle, and (when copy mode is off) hardware-acceleration-aware
 * codec selectors, bitrate selectors, a QSCALE field, scale, and pixel format.
 * A transcoder-core selector follows, then the action buttons and a ProgressBar
 * while converting. Two ConfirmDialogs guard cancelling the active conversion
 * and clearing a dirty form.
 *
 * Local state: `cancelConfirmOpen` and `jobCancelOpen` dialog flags,
 * `previewOpen`, and `mediaInfo`/`mediaInfoLoading` for the preview panel. All
 * conversion settings come from `useConversion`/`useConversionStore`; field
 * errors come from `useFormErrors`.
 *
 * IPC interactions:
 *  - `selectInput`/`selectOutput` from useConversion wrap `selectFile()` and
 *    `selectOutput()`.
 *  - `getMediaInfo(inputFile, 'FFMPEG')` - preview-panel file summary; failures
 *    are logged and the panel silently stays empty.
 *  - `startConversion`, `pauseConversion`, `resumeConversion`,
 *    `cancelConversion` from useConversion wrap the corresponding electronAPI
 *    calls; progress arrives through `onConversionProgress`.
 *
 * @returns {JSX.Element} The page content inside a PageContainer with an
 *   optional preview aside.
 */
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

  /**
   * The encoder type actually used for codec suggestion: the page-level override
   * when it is not 'auto', otherwise the global setting from useSettingsStore.
   * @type {EncoderType}
   */
  const effectiveEncoderType: EncoderType = encoderType !== 'auto' ? encoderType : settingsEncoderType;

  /**
   * Extension of the current output file (empty when no output is set).
   * @type {string}
   */
  const outputExt = getExtension(outputFile || '');

  /**
   * Extension suggested for the currently selected video codec.
   * @type {string}
   */
  const suggestedOutputExt = suggestedExtensionForVideoCodec(videoCodec);

  /**
   * Whether to show the codec/container compatibility warning. True only when
   * copy mode is off, a conversion is not running, an output file was explicitly
   * set by the user, and its extension is incompatible with the video codec.
   * @type {boolean}
   */
  const showCompatWarning =
    !copyMode &&
    !isConverting &&
    !!outputFile &&
    !!outputExt &&
    outputUserSet &&
    !isExtensionCompatibleWithVideoCodec(outputExt, videoCodec);

  /**
   * Rewrites the current output file path to use the extension suggested for the
   * selected video codec. Used by the compatibility-warning action button.
   * @returns {void}
   */
  const applySuggestedExtension = () => {
    if (!outputFile) return;
    setOutputFile(replaceExtension(outputFile, suggestedOutputExt));
  };

  /**
   * Loads media info for the preview panel whenever the input file changes and
   * the preview is open. The request is guarded by a `cancelled` flag so a stale
   * response after a file change is ignored. Failures are logged and swallowed;
   * the panel simply shows no summary.
   * @returns {() => void} Cleanup that marks the in-flight request as cancelled.
   */
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
        testId="convert-input"
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
        testId="convert-output"
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
        <Switch data-testid="convert-copy-switch" checked={copyMode} onChange={(e) => setCopyMode(e.target.checked)} />
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
                  data-testid="convert-encoder-type"
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
                  testId="convert-video-codec"
                />
              </ErrorBoundary>
            </FieldBox>
            <FieldBox>
              <FieldLabel variant="caption" color="text.secondary">
                {t('convert.audioCodec')}
                <InfoTooltip title={t('convert.audioCodecHint')} />
              </FieldLabel>
              <ErrorBoundary fallback={null}>
                <CodecSelect type="audio" value={audioCodec} onChange={setAudioCodec} testId="convert-audio-codec" />
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
                data-testid="convert-video-bitrate"
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
                data-testid="convert-audio-bitrate"
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
                data-testid="convert-qscale"
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
                data-testid="convert-scale"
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
              <GroupedSelect
                testId="convert-pixel-format"
                value={pixelFormat}
                onChange={setPixelFormat}
                options={pixelFormatOptions}
                groupIcons={pixelGroupIcons}
              />
            </FieldBox>
          </Stack>
        </>
      )}

      <Box>
        <FieldLabel variant="caption" color="text.secondary">
          {t('convert.transcoderCore')}
          <InfoTooltip title={t('convert.transcoderCoreHint')} />
        </FieldLabel>
        <TextField
          select
          fullWidth
          size="small"
          data-testid="convert-transcoder"
          value={transcoder}
          onChange={(e) => setTranscoder(e.target.value)}
        >
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
          data-testid="convert-start"
          startIcon={<FontAwesomeIcon icon={faPlay} />}
          onClick={handleStartConversion}
          disabled={!inputFile || !outputFile || isConverting}
        >
          {isConverting ? t('convert.converting') : t('convert.startConversion')}
        </Button>
        {isConverting && !isPaused && (
          <Button
            variant="contained"
            color="warning"
            data-testid="convert-pause"
            startIcon={<FontAwesomeIcon icon={faPause} />}
            onClick={pauseConversion}
          >
            {t('convert.pause')}
          </Button>
        )}
        {isConverting && isPaused && (
          <Button
            variant="contained"
            color="success"
            data-testid="convert-resume"
            startIcon={<FontAwesomeIcon icon={faPlay} />}
            onClick={resumeConversion}
          >
            {t('convert.resume')}
          </Button>
        )}
        {isConverting && (
          <Button
            variant="contained"
            color="error"
            data-testid="convert-cancel"
            startIcon={<FontAwesomeIcon icon={faXmark} />}
            onClick={handleCancelClick}
          >
            {t('convert.cancel')}
          </Button>
        )}
        {isDirty && !isConverting && (
          <Button
            variant="outlined"
            color="error"
            data-testid="convert-cancel-job"
            startIcon={<FontAwesomeIcon icon={faXmark} />}
            onClick={() => setJobCancelOpen(true)}
          >
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
