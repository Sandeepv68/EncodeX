import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Typography,
  TextField,
  MenuItem,
  Switch,
  Paper,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import InvertColorsIcon from '@mui/icons-material/InvertColors';
import BrightnessHighIcon from '@mui/icons-material/BrightnessHigh';
import { Logger } from '../../shared/logger';
import { useConversion } from '../hooks/useConversion';
import CodecSelect from '../components/CodecSelect';
import ErrorBanner from '../components/ErrorBanner';
import ProgressBar from '../components/ProgressBar';
import MediaPlayer from '../components/MediaPlayer';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { PIXEL_FORMATS, VIDEO_BITRATE_OPTIONS, SCALE_OPTIONS, BITRATE_OPTIONS } from '../../shared/ui-constants';
import { TRANSCODER_TYPES, TRANSCODER_LABELS } from '../../shared/transcoder-constants';
import { isInRange } from '../../shared/validation';

const log = new Logger('renderer/pages/Convert');

const pixelGroupIcons: Record<string, React.ComponentType<{ sx?: object }>> = {
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
    setInputFile,
    setOutputFile,
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

  const { currentError, clearError } = useErrorHandler();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [jobCancelOpen, setJobCancelOpen] = useState(false);

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateFields = (): boolean => {
    const next: Record<string, string> = {};
    if (!isInRange(qscale, 1, 31)) next.qscale = t('validation.qscaleRange');
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
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        {t('convert.title')}
      </Typography>
      <Paper sx={{ p: { xs: 2, sm: 3 }, width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentError && (
          <ErrorBoundary fallback={null}>
            <ErrorBanner error={currentError} onClose={clearError} />
          </ErrorBoundary>
        )}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('convert.inputFile')}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <TextField
              fullWidth
              size="small"
              value={inputFile || ''}
              placeholder={t('convert.noFile')}
              slotProps={{ input: { readOnly: true } }}
              sx={{ minWidth: 200, flex: 1 }}
            />
            <Button variant="outlined" onClick={selectInput}>
              {t('convert.browse')}
            </Button>
          </Stack>
        </Box>

        {inputFile && !isConverting && (
          <ErrorBoundary fallback={null}>
            <MediaPlayer filePath={inputFile} />
          </ErrorBoundary>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('convert.outputFile')}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <TextField
              fullWidth
              size="small"
              value={outputFile || ''}
              placeholder={t('convert.noOutput')}
              slotProps={{ input: { readOnly: true } }}
              sx={{ minWidth: 200, flex: 1 }}
            />
            <Button variant="outlined" onClick={selectOutput}>
              {t('convert.saveAs')}
            </Button>
          </Stack>
        </Box>

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
                    setQscale(parseInt(e.target.value) || 23);
                    clearFieldError('qscale');
                  }}
                  onBlur={() => {
                    if (!isInRange(qscale, 1, 31)) setErrors((prev) => ({ ...prev, qscale: t('validation.qscaleRange') }));
                  }}
                  slotProps={{ htmlInput: { min: 1, max: 31 } }}
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
                <TextField select fullWidth size="small" value={pixelFormat} onChange={(e) => setPixelFormat(e.target.value)}>
                  {PIXEL_FORMATS.reduce<React.ReactNode[]>((acc, f, i) => {
                    if (i === 0 || f.group !== PIXEL_FORMATS[i - 1].group) {
                      acc.push(
                        <MenuItem
                          key={`group-${f.group}`}
                          disabled
                          sx={{
                            fontWeight: 700,
                            opacity: '1 !important',
                            cursor: 'default',
                            fontSize: '0.8rem',
                            bgcolor: 'action.selected',
                            color: 'primary.main',
                            py: 0.75,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                            {(() => {
                              const Icon = pixelGroupIcons[f.group];
                              return Icon ? <Icon sx={{ fontSize: 16 }} /> : null;
                            })()}
                            {f.group}
                          </Box>
                        </MenuItem>,
                      );
                    }
                    acc.push(
                      <MenuItem key={f.value} value={f.value}>
                        {f.value}
                      </MenuItem>,
                    );
                    return acc;
                  }, [])}
                </TextField>
              </Box>
            </Stack>
          </>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('convert.transcoderCore')}
          </Typography>
          <TextField select fullWidth size="small" value={transcoder} onChange={(e) => setTranscoder(e.target.value)}>
            {TRANSCODER_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {TRANSCODER_LABELS[t]}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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

        <Dialog open={cancelConfirmOpen} onClose={() => setCancelConfirmOpen(false)}>
          <DialogTitle>{t('convert.cancelTitle')}</DialogTitle>
          <DialogContent>
            <DialogContentText>{t('convert.cancelMessage')}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCancelConfirmOpen(false)}>{t('convert.no')}</Button>
            <Button onClick={handleConfirmCancel} color="error" variant="contained">
              {t('convert.yes')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={jobCancelOpen} onClose={() => setJobCancelOpen(false)}>
          <DialogTitle>{t('convert.jobCancelTitle')}</DialogTitle>
          <DialogContent>
            <DialogContentText>{t('convert.jobCancelMessage')}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setJobCancelOpen(false)}>{t('convert.no')}</Button>
            <Button onClick={handleConfirmJobCancel} color="error" variant="contained">
              {t('convert.yes')}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
