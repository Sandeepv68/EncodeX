import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, TextField, MenuItem, Button, Stack, Typography } from '@mui/material';
import { faCompress, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import FileDropZone from '../components/FileDropZone';
import ProgressBar from '../components/ProgressBar';
import PageContainer from '../components/PageContainer';
import FilePathField from '../components/FilePathField';
import { pageIcons } from '../pageIcons';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { useToastStore } from '../stores/toastStore';
import { ErrorCode } from '../../shared/errors';
import { IMAGE_FORMATS, IMAGE_CODEC_MAP } from '../../shared/media-options';
import { IMAGE_DROPZONE_ACCEPT } from '../../shared/file-extensions';
import { TRANSCODER_TYPES, CONVERSION_DEFAULTS, QSCALE_RANGE } from '../../shared/transcoder-constants';
import { useMediaTask } from '../hooks/useMediaTask';
import { useFormErrors } from '../hooks/useFormErrors';
import { isValidScale, isInRange } from '../../shared/validation';
import { formatSize } from '../utils/formatters';
import type { ImageFileInfo } from '../../shared/types';
import {
  FieldBox,
  FieldLabel,
  PreviewBox,
  PreviewImage,
  PreviewImageBox,
  PreviewInfo,
  PreviewCloseButton,
} from '../styles/ImageCompress.styles';

const log = new Logger('renderer/pages/ImageCompress');

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function withExtension(path: string, ext: string): string {
  const slashIdx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const dotIdx = path.lastIndexOf('.');
  const base = dotIdx > slashIdx ? path.slice(0, dotIdx) : path;
  return `${base}.${ext}`;
}

export default function ImageCompress() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<ImageFileInfo | null>(null);
  const [output, setOutput] = useState('');
  const [format, setFormat] = useState<string>(IMAGE_FORMATS[0].value);
  const [quality, setQuality] = useState<number>(CONVERSION_DEFAULTS.QSCALE);
  const [scale, setScale] = useState('');
  const { progress, setProgress, isConverting, runTask } = useMediaTask();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const showErrorMessage = useErrorStore((s) => s.showErrorMessage);
  const transcoder = TRANSCODER_TYPES[0];

  const handleFileSelect = async (path: string) => {
    setInput(path);
    setPreview(null);
    setFileInfo(null);
    if (!path) return;
    const dataUrl = await window.electronAPI.getImagePreview(path);
    setPreview(dataUrl);
    const info = await window.electronAPI.getImageFileInfo(path);
    setFileInfo(info);
  };

  const clearSelection = () => {
    setInput('');
    setPreview(null);
    setFileInfo(null);
  };

  const handleFormatChange = (value: string) => {
    setFormat(value);
    if (output.trim()) setOutput(withExtension(output, value));
  };

  const handleOutputChange = (value: string) => {
    setOutput(value.trim() ? withExtension(value, format) : '');
    clearFieldError('output');
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!output.trim()) next.output = t('validation.outputRequired');
    if (!isInRange(quality, QSCALE_RANGE.MIN, QSCALE_RANGE.MAX)) next.quality = t('validation.qualityRange');
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
      showErrorMessage(ErrorCode.INPUT_NOT_SPECIFIED, t('imageCompress.validationRequired'));
      return;
    }
    log.info('Compressing image:', input, '->', output, 'format:', format, 'quality:', quality);
    await runTask(async () => {
      await window.electronAPI.convertFile(
        input,
        output,
        {
          videoCodec: IMAGE_CODEC_MAP[format],
          qscale: quality,
          scale: scale || undefined,
          pixelFormat: CONVERSION_DEFAULTS.PIXEL_FORMAT,
        },
        transcoder,
      );
      useToastStore.getState().success(t('toast.imageCompressed'));
    });
    setProgress(null);
  };

  return (
    <PageContainer title={t('imageCompress.title')} icon={pageIcons['/image-compress']}>
      <Box>
        <FieldLabel variant="caption" color="text.secondary">
          {t('imageCompress.inputImage')}
        </FieldLabel>
        {!input && (
          <ErrorBoundary fallback={null}>
            <FileDropZone onFileSelect={handleFileSelect} label={t('imageCompress.dropLabel')} accept={IMAGE_DROPZONE_ACCEPT} />
          </ErrorBoundary>
        )}
        {input && (
          <PreviewBox data-testid="image-preview">
            <PreviewImageBox>
              {preview && <PreviewImage src={preview} alt={fileName(input)} />}
              <PreviewCloseButton size="small" aria-label={t('batchQueue.remove')} data-testid="remove-image" onClick={clearSelection}>
                <FontAwesomeIcon icon={faXmark} />
              </PreviewCloseButton>
            </PreviewImageBox>
            <PreviewInfo>
              <Typography variant="body2" color="text.secondary" data-testid="selected-image">
                {(() => {
                  const template = t('imageCompress.selectedImage', { file: '{{file}}' });
                  const [before, after] = template.split('{{file}}');
                  return (
                    <>
                      {before}
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        {fileName(input)}
                      </Box>
                      {after}
                    </>
                  );
                })()}
              </Typography>
              {fileInfo && (
                <Typography variant="caption" color="text.secondary" data-testid="image-file-info">
                  {fileInfo.width && fileInfo.height ? `${fileInfo.width} × ${fileInfo.height}` : ''}
                  {fileInfo.width && fileInfo.height ? ' · ' : ''}
                  {formatSize(fileInfo.size)}
                </Typography>
              )}
            </PreviewInfo>
          </PreviewBox>
        )}
      </Box>

      <FilePathField
        label={t('imageCompress.outputFile')}
        value={output}
        placeholder={t('imageCompress.placeholderOutput')}
        buttonLabel={t('convert.browse')}
        onChange={handleOutputChange}
        onBlur={() => {
          if (!output.trim()) setFieldError('output', t('validation.outputRequired'));
        }}
        error={errors.output}
        onBrowse={async () => {
          const f = await window.electronAPI.selectOutput();
          if (f) {
            setOutput(withExtension(f, format));
            clearFieldError('output');
          }
        }}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FieldBox>
          <FieldLabel variant="caption" color="text.secondary">
            {t('imageCompress.outputFormat')}
          </FieldLabel>
          <TextField select fullWidth size="small" value={format} onChange={(e) => handleFormatChange(e.target.value)}>
            {IMAGE_FORMATS.map((f) => (
              <MenuItem key={f.value} value={f.value}>
                {f.label}
              </MenuItem>
            ))}
          </TextField>
        </FieldBox>
        <FieldBox>
          <FieldLabel variant="caption" color="text.secondary">
            {t('imageCompress.quality')}
          </FieldLabel>
          <TextField
            fullWidth
            size="small"
            type="number"
            error={!!errors.quality}
            helperText={errors.quality || ' '}
            value={quality}
            onChange={(e) => {
              setQuality(parseInt(e.target.value) || CONVERSION_DEFAULTS.QSCALE);
              clearFieldError('quality');
            }}
            onBlur={() => {
              if (!isInRange(quality, QSCALE_RANGE.MIN, QSCALE_RANGE.MAX)) setFieldError('quality', t('validation.qualityRange'));
            }}
            slotProps={{ htmlInput: { min: QSCALE_RANGE.MIN, max: QSCALE_RANGE.MAX } }}
          />
        </FieldBox>
      </Stack>

      <Box>
        <FieldLabel variant="caption" color="text.secondary">
          {t('imageCompress.scale')}
        </FieldLabel>
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
            if (scale && !isValidScale(scale)) setFieldError('scale', t('validation.invalidScale'));
          }}
          placeholder={t('imageCompress.placeholderScale')}
        />
      </Box>

      <Button
        variant="contained"
        startIcon={<FontAwesomeIcon icon={faCompress} />}
        onClick={handleConvert}
        disabled={!input || !output || isConverting}
      >
        {isConverting ? t('imageCompress.compressing') : t('imageCompress.compress')}
      </Button>
      {progress && (
        <ErrorBoundary fallback={null}>
          <ProgressBar percent={progress.percent} />
        </ErrorBoundary>
      )}
    </PageContainer>
  );
}
