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
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Switch,
  Stack,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Divider,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  faPalette,
  faBrush,
  faDroplet,
  faSun,
  faPlay,
  faPause,
  faXmark,
  faEye,
  faFolderOpen,
  faChevronDown,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Logger } from '../../shared/logger';
import { analytics } from '../../shared/analytics/analytics';
import { useConversion } from '../hooks/useConversion';
import { useHotkeys } from '../hooks/useHotkeys';
import { SHORTCUT_BY_ID, shortcutHint } from '../constants/shortcuts';
import CodecSelect from '../components/CodecSelect';
import ProgressBar from '../components/ProgressBar';
import MediaPlayer from '../components/MediaPlayer';
import PageContainer from '../components/PageContainer';
import FilePathField from '../components/FilePathField';
import FileDropZone from '../components/FileDropZone';
import ConfirmDialog from '../components/ConfirmDialog';
import FileSummary from '../components/FileSummary';
import StreamDetails from '../components/StreamDetails';
import { pageIcons } from '../pageIcons';
import GroupedSelect from '../components/GroupedSelect';
import InfoTooltip from '../components/InfoTooltip';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PIXEL_FORMATS, VIDEO_BITRATE_OPTIONS, SCALE_OPTIONS, BITRATE_OPTIONS } from '../../shared/media-options';
import { VIDEO_DROPZONE_ACCEPT } from '../../shared/file-extensions';
import { TRANSCODER_TYPES, TRANSCODER_LABELS, CONVERSION_DEFAULTS, QSCALE_RANGE } from '../../shared/transcoder-constants';
import { MediaInfo as MediaInfoType } from '../../shared/types';
import { isInRange } from '../../shared/validation';
import { useFormErrors } from '../hooks/useFormErrors';
import { focusFirstError } from '../utils/focusFirstError';
import { useSettingsStore } from '../stores/settingsStore';
import { useDismissedAlertsStore, DISMISSED_ALERT_KEYS } from '../stores/dismissedAlertsStore';
import { useFieldId } from '../hooks/useFieldId';
import { ENCODER_TYPES } from '../../shared/hwaccel-settings';
import type { EncoderType } from '../../shared/types';
import {
  ActionStack,
  AccelAlert,
  CompatAlert,
  LoadingBox,
  SelectedFileRow,
  SelectedFileName,
  ShowPreviewButton,
  PreviewPanel,
  PreviewHeader,
  PreviewDivider,
  PreviewSectionTitle,
  PageSection,
} from '../styles/Convert.styles';
import { FieldBox, FieldLabel, ToggleRow, SectionTitle } from '../styles/form.styles';
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
 * Extracts the base file name from an absolute path, handling both `/` and `\`
 * separators (POSIX and Windows paths).
 * @param {string} path - The full file path to process.
 * @returns {string} The trailing path segment, or the original `path` when no
 *   separator is present.
 */
function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

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
 * Layout: a drag-and-drop input zone (with a change button once a source is
 * chosen) and an output file field (with a codec-compatibility warning when the
 * chosen output extension clashes with the selected video codec), a
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
  const qscaleId = useFieldId();
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
    setInputFile,
    isDirty,
    resetForm,
  } = useConversion();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [jobCancelOpen, setJobCancelOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [streamsExpanded, setStreamsExpanded] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaInfoType | null>(null);
  const [mediaInfoLoading, setMediaInfoLoading] = useState(false);
  const settingsHardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);
  const settingsEncoderType = useSettingsStore((s) => s.encoderType);
  const accelAlertDismissed = useDismissedAlertsStore((s) => s.isDismissed(DISMISSED_ALERT_KEYS.HARDWARE_ACCEL));
  const compatAlertDismissed = useDismissedAlertsStore((s) => s.isDismissed(DISMISSED_ALERT_KEYS.COMPAT));

  const handleFileSelect = (file: string) => {
    analytics.featureUsed('convert');
    setInputFile(file);
  };

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
    if (Object.keys(next).length > 0) focusFirstError(next, ['qscale'], { qscale: 'convert-qscale' });
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

  /**
   * Registers the page keyboard shortcuts (Ctrl+O input, Ctrl+Shift+S output,
   * Ctrl+Enter start, Ctrl+Shift+P pause, Ctrl+Shift+C cancel, Ctrl+Shift+X
   * clear job, L lossless copy, P preview). Bindings mirror the enabled state of
   * the equivalent on-page controls.
   * @returns {void}
   */
  useHotkeys([
    { id: 'convert.input', handler: () => selectInput() },
    { id: 'convert.output', handler: () => selectOutput() },
    {
      id: 'convert.start',
      handler: () => handleStartConversion(),
      enabled: !!inputFile && !!outputFile && !isConverting,
    },
    { id: 'convert.pause', handler: () => pauseConversion(), enabled: isConverting && !isPaused },
    { id: 'convert.cancel', handler: () => handleCancelClick(), enabled: isConverting },
    { id: 'convert.clear', handler: () => setJobCancelOpen(true), enabled: isDirty && !isConverting },
    { id: 'convert.lossless', handler: () => setCopyMode(!copyMode) },
    { id: 'convert.preview', handler: () => setPreviewOpen(true), enabled: !!inputFile && !previewOpen },
  ]);

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
                <LoadingBox>
                  <CircularProgress size={24} />
                </LoadingBox>
              )}
              {mediaInfo && (
                <>
                  <ErrorBoundary fallback={null}>
                    <FileSummary info={mediaInfo} compact />
                  </ErrorBoundary>
                  <Stack direction="row" sx={{ justifyContent: 'center' }}>
                    <Button
                      size="small"
                      variant="text"
                      color="primary"
                      data-testid="convert-toggle-streams"
                      endIcon={
                        <Box
                          component="span"
                          sx={(theme) => ({
                            display: 'inline-flex',
                            transform: streamsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: theme.transitions.create('transform', { duration: theme.transitions.duration.short }),
                          })}
                        >
                          <FontAwesomeIcon icon={faChevronDown} />
                        </Box>
                      }
                      onClick={() => setStreamsExpanded((v) => !v)}
                      aria-expanded={streamsExpanded}
                    >
                      {streamsExpanded ? t('convert.viewLess') : t('convert.viewMore')}
                    </Button>
                  </Stack>
                  <Collapse in={streamsExpanded} unmountOnExit>
                    <ErrorBoundary fallback={null}>
                      <StreamDetails streams={mediaInfo.streams} compact />
                    </ErrorBoundary>
                  </Collapse>
                </>
              )}
            </Box>
          </PreviewPanel>
        ) : undefined
      }
    >
      <PageSection>
        <SectionTitle variant="h6" component="h2">
          {t('convert.sourceFiles')}
        </SectionTitle>

        <Box>
          <FieldLabel>
            {t('convert.inputFile')}
            <InfoTooltip title={t('convert.inputFileHint')} />
          </FieldLabel>
          {!inputFile ? (
            <ErrorBoundary fallback={null}>
              <FileDropZone onFileSelect={handleFileSelect} label={t('convert.dropLabel')} accept={VIDEO_DROPZONE_ACCEPT} />
            </ErrorBoundary>
          ) : (
            <SelectedFileRow direction="row" spacing={1} useFlexGap>
              <SelectedFileName variant="body2" color="text.secondary" data-testid="convert-input-file">
                {fileName(inputFile)}
              </SelectedFileName>
              <Tooltip title={t('convert.changeFileHint')} arrow>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FontAwesomeIcon icon={faFolderOpen} />}
                  onClick={() => {
                    analytics.featureUsed('convert');
                    selectInput();
                  }}
                  data-testid="convert-change-input"
                >
                  {t('convert.changeFile')}
                </Button>
              </Tooltip>
              {!previewOpen && (
                <ShowPreviewButton
                  variant="outlined"
                  size="small"
                  startIcon={<FontAwesomeIcon icon={faEye} />}
                  onClick={() => setPreviewOpen(true)}
                >
                  {t('convert.showPreview')}
                </ShowPreviewButton>
              )}
            </SelectedFileRow>
          )}
        </Box>

        <FilePathField
          label={t('convert.outputFile')}
          hint={t('convert.outputFileHint')}
          required
          value={outputFile || ''}
          placeholder={t('convert.noOutput')}
          buttonLabel={t('convert.saveAs')}
          onBrowse={selectOutput}
          testId="convert-output"
        />

        {showCompatWarning && !compatAlertDismissed && (
          <CompatAlert
            severity="warning"
            onClose={() => useDismissedAlertsStore.getState().dismiss(DISMISSED_ALERT_KEYS.COMPAT)}
            action={
              <Button size="small" color="inherit" onClick={applySuggestedExtension}>
                {t('convert.applySuggestedExt', { extension: suggestedOutputExt })}
              </Button>
            }
          >
            {t('convert.codecCompatWarning', { codec: videoCodec, extension: outputExt, suggested: suggestedOutputExt })}
          </CompatAlert>
        )}
      </PageSection>

      <Divider />

      <PageSection>
        <SectionTitle variant="h6" component="h2">
          {t('convert.encoding')}
        </SectionTitle>

        <ToggleRow>
          <Switch
            data-testid="convert-copy-switch"
            checked={copyMode}
            onChange={(e) => setCopyMode(e.target.checked)}
            slotProps={{ input: { 'aria-label': t('convert.losslessCopy') } }}
          />
          <Typography variant="caption" color="text.secondary">
            {t('convert.losslessCopy')}
          </Typography>
          <InfoTooltip title={t('convert.losslessCopyHint')} />
        </ToggleRow>

        {!copyMode && (
          <>
            {settingsHardwareAcceleration && !accelAlertDismissed && (
              <>
                <AccelAlert severity="info" onClose={() => useDismissedAlertsStore.getState().dismiss(DISMISSED_ALERT_KEYS.HARDWARE_ACCEL)}>
                  {t('convert.hardwareAccelAlert')}
                </AccelAlert>
                <FieldBox>
                  <FieldLabel>
                    {t('settings.encoderType')}
                    <InfoTooltip title={t('convert.encoderTypeHint')} />
                  </FieldLabel>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    data-testid="convert-encoder-type"
                    slotProps={{ htmlInput: { 'aria-label': t('settings.encoderType') } }}
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
                <FieldLabel>
                  {t('convert.videoCodec')}
                  <InfoTooltip title={t('convert.videoCodecHint')} />
                </FieldLabel>
                <ErrorBoundary fallback={null}>
                  <CodecSelect
                    type="video"
                    value={videoCodec}
                    onChange={setVideoCodec}
                    encoderType={settingsHardwareAcceleration ? effectiveEncoderType : 'auto'}
                    ariaLabel={t('convert.videoCodec')}
                    testId="convert-video-codec"
                  />
                </ErrorBoundary>
              </FieldBox>
              <FieldBox>
                <FieldLabel>
                  {t('convert.audioCodec')}
                  <InfoTooltip title={t('convert.audioCodecHint')} />
                </FieldLabel>
                <ErrorBoundary fallback={null}>
                  <CodecSelect
                    type="audio"
                    value={audioCodec}
                    onChange={setAudioCodec}
                    ariaLabel={t('convert.audioCodec')}
                    testId="convert-audio-codec"
                  />
                </ErrorBoundary>
              </FieldBox>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FieldBox>
                <FieldLabel>
                  {t('convert.videoBitrate')}
                  <InfoTooltip title={t('convert.videoBitrateHint')} />
                </FieldLabel>
                <TextField
                  select
                  fullWidth
                  size="small"
                  data-testid="convert-video-bitrate"
                  slotProps={{ htmlInput: { 'aria-label': t('convert.videoBitrate') } }}
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
                <FieldLabel>
                  {t('convert.audioBitrate')}
                  <InfoTooltip title={t('convert.audioBitrateHint')} />
                </FieldLabel>
                <TextField
                  select
                  fullWidth
                  size="small"
                  data-testid="convert-audio-bitrate"
                  slotProps={{ htmlInput: { 'aria-label': t('convert.audioBitrate') } }}
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
                <FieldLabel htmlFor={qscaleId}>
                  {t('convert.qscale')}
                  <InfoTooltip title={t('convert.qscaleHint')} />
                </FieldLabel>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  id={qscaleId}
                  data-testid="convert-qscale"
                  error={!!errors.qscale}
                  helperText={errors.qscale || t('convert.qscaleRangeCaption')}
                  value={qscale}
                  onChange={(e) => {
                    setQscale(parseInt(e.target.value) || CONVERSION_DEFAULTS.QSCALE);
                    clearFieldError('qscale');
                  }}
                  onBlur={() => {
                    if (!isInRange(qscale, QSCALE_RANGE.MIN, QSCALE_RANGE.MAX)) setFieldError('qscale', t('validation.qscaleRange'));
                  }}
                  slotProps={{
                    htmlInput: { min: QSCALE_RANGE.MIN, max: QSCALE_RANGE.MAX },
                    input: {
                      endAdornment: <InputAdornment position="end">/ {QSCALE_RANGE.MAX}</InputAdornment>,
                    },
                  }}
                />
              </FieldBox>
              <FieldBox>
                <FieldLabel>
                  {t('convert.scale')}
                  <InfoTooltip title={t('convert.scaleHint')} />
                </FieldLabel>
                <TextField
                  select
                  fullWidth
                  size="small"
                  data-testid="convert-scale"
                  slotProps={{ htmlInput: { 'aria-label': t('convert.scale') } }}
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
                <FieldLabel>
                  {t('convert.pixelFormat')}
                  <InfoTooltip title={t('convert.pixelFormatHint')} />
                </FieldLabel>
                <GroupedSelect
                  testId="convert-pixel-format"
                  ariaLabel={t('convert.pixelFormat')}
                  value={pixelFormat}
                  onChange={setPixelFormat}
                  options={pixelFormatOptions}
                  groupIcons={pixelGroupIcons}
                />
              </FieldBox>
            </Stack>
          </>
        )}
      </PageSection>

      <Divider />

      <PageSection>
        <SectionTitle variant="h6" component="h2">
          {t('convert.advanced')}
        </SectionTitle>

        <Box>
          <FieldLabel>
            {t('convert.transcoderCore')}
            <InfoTooltip title={t('convert.transcoderCoreHint')} />
          </FieldLabel>
          <TextField
            select
            fullWidth
            size="small"
            data-testid="convert-transcoder"
            slotProps={{ htmlInput: { 'aria-label': t('convert.transcoderCore') } }}
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
      </PageSection>

      <ActionStack direction="row" spacing={1} useFlexGap>
        <Tooltip title={shortcutHint(t, 'convert.startConversion', SHORTCUT_BY_ID['convert.start'].keys)} arrow>
          <span>
            <Button
              variant="contained"
              data-testid="convert-start"
              startIcon={<FontAwesomeIcon icon={faPlay} />}
              onClick={handleStartConversion}
              disabled={!inputFile || !outputFile || isConverting}
            >
              {isConverting ? t('convert.converting') : t('convert.startConversion')}
            </Button>
          </span>
        </Tooltip>
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
