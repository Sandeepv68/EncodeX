import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Typography, TextField, MenuItem, Switch, Paper, Stack } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import InvertColorsIcon from '@mui/icons-material/InvertColors';
import BrightnessHighIcon from '@mui/icons-material/BrightnessHigh';
import { useConversion } from '../hooks/useConversion';
import CodecSelect from '../components/CodecSelect';
import ErrorBanner from '../components/ErrorBanner';
import ProgressBar from '../components/ProgressBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { PIXEL_FORMATS } from '../../shared/ui-constants';
import { TRANSCODER_TYPES, TRANSCODER_LABELS } from '../../shared/transcoder-constants';
import { isValidScale, isValidBitrate, isInRange } from '../../shared/validation';

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
    cancelConversion,
    selectInput,
    selectOutput,
  } = useConversion();

  const { currentError, clearError } = useErrorHandler();
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (scale && !isValidScale(scale)) next.scale = t('validation.invalidScale');
    if (videoBitrate && !isValidBitrate(videoBitrate)) next.videoBitrate = t('validation.invalidBitrate');
    if (audioBitrate && !isValidBitrate(audioBitrate)) next.audioBitrate = t('validation.invalidBitrate');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleStartConversion = () => {
    if (!validateFields()) return;
    startConversion();
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        {t('convert.title')}
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentError && <ErrorBoundary fallback={null}><ErrorBanner error={currentError} onClose={clearError} /></ErrorBoundary>}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('convert.inputFile')}
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              value={inputFile || ''}
              placeholder={t('convert.noFile')}
              slotProps={{ input: { readOnly: true } }}
            />
            <Button variant="outlined" onClick={selectInput}>
              {t('convert.browse')}
            </Button>
          </Stack>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('convert.outputFile')}
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              value={outputFile || ''}
              placeholder={t('convert.noOutput')}
              slotProps={{ input: { readOnly: true } }}
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
            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {t('convert.videoCodec')}
                </Typography>
                <ErrorBoundary fallback={null}><CodecSelect type="video" value={videoCodec} onChange={setVideoCodec} /></ErrorBoundary>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {t('convert.audioCodec')}
                </Typography>
                <ErrorBoundary fallback={null}><CodecSelect type="audio" value={audioCodec} onChange={setAudioCodec} /></ErrorBoundary>
              </Box>
            </Stack>

            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {t('convert.videoBitrate')}
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  error={!!errors.videoBitrate}
                  helperText={errors.videoBitrate || ' '}
                  value={videoBitrate}
                  onChange={(e) => {
                    setVideoBitrate(e.target.value);
                    clearFieldError('videoBitrate');
                  }}
                  onBlur={() => {
                    if (videoBitrate && !isValidBitrate(videoBitrate))
                      setErrors((prev) => ({ ...prev, videoBitrate: t('validation.invalidBitrate') }));
                  }}
                  placeholder={t('convert.placeholderBitrate')}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {t('convert.audioBitrate')}
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  error={!!errors.audioBitrate}
                  helperText={errors.audioBitrate || ' '}
                  value={audioBitrate}
                  onChange={(e) => {
                    setAudioBitrate(e.target.value);
                    clearFieldError('audioBitrate');
                  }}
                  onBlur={() => {
                    if (audioBitrate && !isValidBitrate(audioBitrate))
                      setErrors((prev) => ({ ...prev, audioBitrate: t('validation.invalidBitrate') }));
                  }}
                  placeholder={t('convert.placeholderAudioBitrate')}
                />
              </Box>
            </Stack>

            <Stack direction="row" spacing={2}>
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
                  fullWidth
                  size="small"
                  error={!!errors.scale}
                  helperText={errors.scale || ' '}
                  value={scale}
                  onChange={(e) => {
                    setScale(e.target.value);
                    clearFieldError('scale');
                  }}
                  onBlur={() => {
                    if (scale && !isValidScale(scale)) setErrors((prev) => ({ ...prev, scale: t('validation.invalidScale') }));
                  }}
                  placeholder={t('convert.placeholderScale')}
                />
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

        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleStartConversion} disabled={!inputFile || !outputFile || isConverting}>
            {isConverting ? t('convert.converting') : t('convert.startConversion')}
          </Button>
          {isConverting && (
            <Button variant="contained" color="error" onClick={cancelConversion}>
              {t('convert.cancel')}
            </Button>
          )}
        </Stack>

        {progress && <ErrorBoundary fallback={null}><ProgressBar percent={progress.percent} time={progress.time} speed={progress.speed} eta={progress.eta} /></ErrorBoundary>}
      </Paper>
    </Box>
  );
}
