import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, TextField, MenuItem, Button, Paper, Stack } from '@mui/material';
import FileDropZone from '../components/FileDropZone';
import ErrorBanner from '../components/ErrorBanner';
import ProgressBar from '../components/ProgressBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { ErrorCode } from '../../shared/errors';
import { IMAGE_FORMATS, IMAGE_CODEC_MAP } from '../../shared/ui-constants';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { isValidScale, isInRange } from '../../shared/validation';

const log = new Logger('renderer/pages/ImageCompress');

export default function ImageCompress() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [format, setFormat] = useState(IMAGE_FORMATS[0].value);
  const [quality, setQuality] = useState(23);
  const [scale, setScale] = useState('');
  const [progress, setProgress] = useState<{ percent: number; time?: string; speed?: string; eta?: string } | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { currentError, showError, clearError: clearErrorBanner } = useErrorStore();
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
    if (!isInRange(quality, 1, 31)) next.quality = t('validation.qualityRange');
    if (scale && !isValidScale(scale)) next.scale = t('validation.invalidScale');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleConvert = async () => {
    if (!validate()) {
      log.warn('Validation failed');
      return;
    }
    if (!input) {
      log.warn('No input file selected');
      showError({ code: ErrorCode.INPUT_NOT_SPECIFIED, message: 'Please select an input image.' });
      return;
    }
    log.info('Compressing image:', input, '->', output, 'format:', format, 'quality:', quality);
    setIsConverting(true);
    try {
      await window.electronAPI.convertFile(
        input,
        output,
        {
          videoCodec: IMAGE_CODEC_MAP[format],
          qscale: quality,
          scale: scale || undefined,
          pixelFormat: 'yuv420p',
        },
        transcoder,
      );
      setProgress({ percent: 100, time: 'Done', speed: '-', eta: '0' });
    } catch (err: unknown) {
      showError(err);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        {t('imageCompress.title')}
      </Typography>
      <Paper sx={{ p: { xs: 2, sm: 3 }, width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentError && (
          <ErrorBoundary fallback={null}>
            <ErrorBanner error={currentError} onClose={clearErrorBanner} />
          </ErrorBoundary>
        )}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('imageCompress.inputImage')}
          </Typography>
          <ErrorBoundary fallback={null}>
            <FileDropZone onFileSelect={setInput} label={t('imageCompress.dropLabel')} accept="jpg,jpeg,png,webp,bmp" />
          </ErrorBoundary>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('imageCompress.outputFile')}
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
              placeholder={t('imageCompress.placeholderOutput')}
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
              {t('imageCompress.outputFormat')}
            </Typography>
            <TextField select fullWidth size="small" value={format} onChange={(e) => setFormat(e.target.value)}>
              {IMAGE_FORMATS.map((f) => (
                <MenuItem key={f.value} value={f.value}>
                  {f.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {t('imageCompress.quality')}
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="number"
              error={!!errors.quality}
              helperText={errors.quality || ' '}
              value={quality}
              onChange={(e) => {
                setQuality(parseInt(e.target.value) || 23);
                clearFieldError('quality');
              }}
              onBlur={() => {
                if (!isInRange(quality, 1, 31)) setErrors((prev) => ({ ...prev, quality: t('validation.qualityRange') }));
              }}
              slotProps={{ htmlInput: { min: 1, max: 31 } }}
            />
          </Box>
        </Stack>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('imageCompress.scale')}
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
            placeholder={t('imageCompress.placeholderScale')}
          />
        </Box>
        <Button variant="contained" onClick={handleConvert} disabled={!input || !output || isConverting}>
          {isConverting ? t('imageCompress.compressing') : t('imageCompress.compress')}
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
