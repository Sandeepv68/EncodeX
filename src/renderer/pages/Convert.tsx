import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, TextField, MenuItem, Switch, Stack, Button } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import InvertColorsIcon from '@mui/icons-material/InvertColors';
import BrightnessHighIcon from '@mui/icons-material/BrightnessHigh';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import { Logger } from '../../shared/logger';
import { useConversion } from '../hooks/useConversion';
import CodecSelect from '../components/CodecSelect';
import ProgressBar from '../components/ProgressBar';
import MediaPlayer from '../components/MediaPlayer';
import PageContainer from '../components/PageContainer';
import FilePathField from '../components/FilePathField';
import ConfirmDialog from '../components/ConfirmDialog';
import GroupedSelect from '../components/GroupedSelect';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PIXEL_FORMATS, VIDEO_BITRATE_OPTIONS, SCALE_OPTIONS, BITRATE_OPTIONS } from '../../shared/media-options';
import { TRANSCODER_TYPES, TRANSCODER_LABELS, CONVERSION_DEFAULTS, QSCALE_RANGE } from '../../shared/transcoder-constants';
import { isInRange } from '../../shared/validation';
import { useFormErrors } from '../hooks/useFormErrors';

const log = new Logger('renderer/pages/Convert');

const pixelGroupIcons: Record<string, React.ComponentType<SvgIconProps>> = {
  'YUV 8-bit': PaletteIcon,
  'YUV 10-bit': PaletteIcon,
  'YUV 12-bit': PaletteIcon,
  'YUV 16-bit': PaletteIcon,
  'YUV Semi-planar': PaletteIcon,
  'YUV with Alpha': PaletteIcon,
  'RGB Packed': ColorLensIcon,
  'Planar RGB': ColorLensIcon,
  Monochrome: InvertColorsIcon,
  HDR: BrightnessHighIcon,
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Switch checked={copyMode} onChange={(e) => setCopyMode(e.target.checked)} />
        <Typography variant="caption" color="text.secondary">
          {t('convert.losslessCopy')}
        </Typography>
      </Box>

      {!copyMode && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('convert.videoCodec')}
              </Typography>
              <ErrorBoundary fallback={null}>
                <CodecSelect type="video" value={videoCodec} onChange={setVideoCodec} />
              </ErrorBoundary>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('convert.audioCodec')}
              </Typography>
              <ErrorBoundary fallback={null}>
                <CodecSelect type="audio" value={audioCodec} onChange={setAudioCodec} />
              </ErrorBoundary>
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('convert.videoBitrate')}
              </Typography>
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
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('convert.audioBitrate')}
              </Typography>
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
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('convert.qscale')}
              </Typography>
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
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('convert.scale')}
              </Typography>
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
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {t('convert.pixelFormat')}
              </Typography>
              <GroupedSelect value={pixelFormat} onChange={setPixelFormat} options={pixelFormatOptions} groupIcons={pixelGroupIcons} />
            </Box>
          </Stack>
        </>
      )}

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          {t('convert.transcoderCore')}
        </Typography>
        <TextField select fullWidth size="small" value={transcoder} onChange={(e) => setTranscoder(e.target.value)}>
          {TRANSCODER_TYPES.map((tc) => (
            <MenuItem key={tc} value={tc}>
              {TRANSCODER_LABELS[tc]}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={handleStartConversion} disabled={!inputFile || !outputFile || isConverting}>
          {isConverting ? t('convert.converting') : t('convert.startConversion')}
        </Button>
        {isConverting && !isPaused && (
          <Button variant="contained" color="warning" onClick={pauseConversion}>
            {t('convert.pause')}
          </Button>
        )}
        {isConverting && isPaused && (
          <Button variant="contained" color="success" onClick={resumeConversion}>
            {t('convert.resume')}
          </Button>
        )}
        {isConverting && (
          <Button variant="contained" color="error" onClick={handleCancelClick}>
            {t('convert.cancel')}
          </Button>
        )}
        {isDirty && !isConverting && (
          <Button variant="outlined" color="error" onClick={() => setJobCancelOpen(true)}>
            {t('convert.cancelJob')}
          </Button>
        )}
      </Stack>

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
