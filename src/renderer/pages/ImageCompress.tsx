/**
 * @fileoverview Image compression page. Lets the user pick an image, choose an
 * output format, quality, and optional scale, and convert it lossily. Corresponds
 * to the `/image-compress` route and is the destination of the Dashboard
 * "Image Compress" feature card.
 *
 * Workflow: drop or pick an image -> a preview thumbnail and file dimensions
 * (width, height, size) are fetched -> choose output path, format, quality
 * (qscale), scale, and whether to keep the aspect ratio -> click Compress. While
 * the conversion runs a ProgressBar is shown, driven by `useMediaTask`'s
 * progress subscription.
 *
 * State is entirely local to the component (`useState`): `input`, `preview`,
 * `fileInfo`, `output`, `format`, `quality`, `scale`, `keepAspectRatio`, plus
 * the shared conversion state from `useMediaTask` and field errors from
 * `useFormErrors`.
 *
 * IPC interactions:
 *  - `getImagePreview(path)` - thumbnail of the selected image.
 *  - `getImageFileInfo(path)` - dimensions and size of the selected image.
 *  - `selectOutput()` - native save dialog for the output file.
 *  - `convertFile(...)` - runs the FFmpeg conversion (via `runTask`).
 *  - `onConversionProgress` - feeds the progress bar (via `useMediaTask`).
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, TextField, MenuItem, Button, Stack, Typography, Switch, InputAdornment, Tooltip } from '@mui/material';
import { faCompress } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import FileDropZone from '../components/FileDropZone';
import ProgressBar from '../components/ProgressBar';
import PageContainer from '../components/PageContainer';
import FilePathField from '../components/FilePathField';
import InfoTooltip from '../components/InfoTooltip';
import { pageIcons } from '../pageIcons';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { useToastStore } from '../stores/toastStore';
import { useTaskStore } from '../stores/taskStore';
import { ErrorCode } from '../../shared/errors';
import { IMAGE_FORMATS, IMAGE_CODEC_MAP, SCALE_OPTIONS } from '../../shared/media-options';
import { IMAGE_DROPZONE_ACCEPT } from '../../shared/file-extensions';
import { TRANSCODER_TYPES, CONVERSION_DEFAULTS, QSCALE_RANGE } from '../../shared/transcoder-constants';
import { useMediaTask } from '../hooks/useMediaTask';
import { useFormErrors } from '../hooks/useFormErrors';
import { useHotkeys } from '../hooks/useHotkeys';
import { SHORTCUT_BY_ID, shortcutHint } from '../constants/shortcuts';
import { focusFirstError } from '../utils/focusFirstError';
import { openFileDialog } from '../utils/fileDialog';
import { isInRange } from '../../shared/validation';
import { formatSize } from '../utils/formatters';
import type { ImageFileInfo } from '../../shared/types';
import { ToggleSpacer, SelectedImageName, AspectRatioRow } from '../styles/ImageCompress.styles';
import MediaPreview from '../components/MediaPreview';
import { useFieldId } from '../hooks/useFieldId';
import { FieldBox, FieldLabel } from '../styles/form.styles';
import {
  LOG_ARROW,
  LOG_COMPRESSING_IMAGE,
  LOG_FORMAT,
  LOG_NO_INPUT_FILE_SELECTED,
  LOG_QUALITY,
  LOG_VALIDATION_FAILED,
} from '../../shared/log-constants';

/**
 * Logger instance scoped to this page. Reports compression starts, validation
 * failures, and missing-input warnings.
 * @const {Logger} log
 */
const log = new Logger('renderer/pages/ImageCompress');

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
 * Replaces the extension of a file path with the given one, preserving any
 * directory portion. If `path` has no extension (or only directory dots), the
 * new extension is appended. Extension detection stops at the last slash so
 * directory names containing dots are not mangled.
 * @param {string} path - The file path whose extension is replaced.
 * @param {string} ext - The new extension, without a leading dot.
 * @returns {string} The path with its extension replaced or appended.
 */
function withExtension(path: string, ext: string): string {
  const slashIdx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const dotIdx = path.lastIndexOf('.');
  const base = dotIdx > slashIdx ? path.slice(0, dotIdx) : path;
  return `${base}.${ext}`;
}

/**
 * Renders the image compression page (`/image-compress`).
 *
 * Layout: a drop zone / image preview box at the top, an output file field, an
 * output-format select, a quality number field (qscale, constrained to
 * `QSCALE_RANGE`), a scale select, a keep-aspect-ratio switch, and the Compress
 * button. While converting, a ProgressBar is shown.
 *
 * State managed: local `useState` for the input path, preview data URL, file
 * info, output path, format, quality, scale, and aspect-ratio flag. Conversion
 * progress and `isConverting` come from `useMediaTask`; field errors from
 * `useFormErrors`. The transcoder is fixed to `TRANSCODER_TYPES[0]`.
 *
 * IPC interactions:
 *  - `getImagePreview(path)` - thumbnail for the preview box.
 *  - `getImageFileInfo(path)` - dimensions/size for the caption.
 *  - `selectOutput()` - native save dialog for the output file.
 *  - `convertFile(...)` - the FFmpeg conversion, wrapped by `runTask`.
 *
 * @returns {JSX.Element} The page content inside a PageContainer.
 */
export default function ImageCompress() {
  const { t } = useTranslation();
  const qualityId = useFieldId();

  /**
   * Absolute path of the currently selected input image, or '' when none.
   * @type {string}
   */
  const [input, setInput] = useState('');

  /**
   * Data URL of the input image's preview thumbnail, or null while loading.
   * @type {string | null}
   */
  const [preview, setPreview] = useState<string | null>(null);

  /**
   * Dimensions and size of the selected image, or null while loading.
   * @type {ImageFileInfo | null}
   */
  const [fileInfo, setFileInfo] = useState<ImageFileInfo | null>(null);

  /**
   * Absolute path of the output file to write.
   * @type {string}
   */
  const [output, setOutput] = useState('');

  /**
   * Output image format; one of the IMAGE_FORMATS values (e.g. 'jpeg', 'png').
   * @type {string}
   */
  const [format, setFormat] = useState<string>(IMAGE_FORMATS[0].value);

  /**
   * Output quality as an FFmpeg qscale value, defaulting to
   * `CONVERSION_DEFAULTS.QSCALE`.
   * @type {number}
   */
  const [quality, setQuality] = useState<number>(CONVERSION_DEFAULTS.QSCALE);

  /**
   * Optional scale preset (e.g. '1280x720'), or '' for no scaling.
   * @type {string}
   */
  const [scale, setScale] = useState('');

  /**
   * Whether scaling preserves the image's aspect ratio.
   * @type {boolean}
   */
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);
  const { progress, setProgress, isConverting, runTask } = useMediaTask();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const showErrorMessage = useErrorStore((s) => s.showErrorMessage);
  const setHasPendingWork = useTaskStore((s) => s.setHasPendingWork);

  /**
   * Publishes the local form's pending-work flag to the global task store so
   * the close-confirmation dialog can detect a configured-but-unstarted job.
   * @returns {void}
   */
  useEffect(() => {
    return () => {
      setHasPendingWork(false);
    };
  }, [setHasPendingWork]);

  /**
   * Transcoder backend used for every conversion from this page, fixed to the
   * first entry of TRANSCODER_TYPES.
   * @type {string}
   */
  const transcoder = TRANSCODER_TYPES[0];

  /**
   * Handles a newly selected or dropped image file. Clears the previous preview
   * and file info, then fetches a preview thumbnail and the file dimensions/size
   * via `window.electronAPI`.
   * @param {string} path - Absolute path of the selected image file.
   * @returns {Promise<void>} Resolves once preview and file info settle.
   */
  const handleFileSelect = async (path: string) => {
    setInput(path);
    setPreview(null);
    setFileInfo(null);
    if (!path) return;
    setHasPendingWork(true);
    const dataUrl = await window.electronAPI.getImagePreview(path);
    setPreview(dataUrl);
    const info = await window.electronAPI.getImageFileInfo(path);
    setFileInfo(info);
  };

  /**
   * Clears the whole form and resets every field to its default value: input,
   * preview, file info, output, format (first IMAGE_FORMATS entry), quality
   * (`CONVERSION_DEFAULTS.QSCALE`), scale, aspect-ratio flag, field errors, and
   * the conversion progress. Used by the preview close button.
   * @returns {void}
   */
  const clearSelection = () => {
    setInput('');
    setPreview(null);
    setFileInfo(null);
    setOutput('');
    setFormat(IMAGE_FORMATS[0].value);
    setQuality(CONVERSION_DEFAULTS.QSCALE);
    setScale('');
    setKeepAspectRatio(true);
    setErrors({});
    setProgress(null);
    setHasPendingWork(false);
  };

  /**
   * Updates the selected output format. When an output file is already entered,
   * its extension is rewritten to the new format so output path and format stay
   * consistent.
   * @param {string} value - The newly selected format value.
   * @returns {void}
   */
  const handleFormatChange = (value: string) => {
    setFormat(value);
    if (output.trim()) setOutput(withExtension(output, value));
  };

  /**
   * Updates the output path. Non-empty values are normalized to carry the
   * selected format extension (via `withExtension`); empty values clear the
   * field. The `output` field error is cleared.
   * @param {string} value - The raw output path typed by the user.
   * @returns {void}
   */
  const handleOutputChange = (value: string) => {
    setOutput(value.trim() ? withExtension(value, format) : '');
    clearFieldError('output');
  };

  /**
   * Validates the compression form. Requires a non-empty output path and a
   * quality within `QSCALE_RANGE`. Collects every problem into the errors map;
   * on any failure false is returned.
   * @returns {boolean} True when validation passes and compression may start.
   */
  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!output.trim()) next.output = t('validation.outputRequired');
    if (!isInRange(quality, QSCALE_RANGE.MIN, QSCALE_RANGE.MAX)) next.quality = t('validation.qualityRange');
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(next, ['output', 'quality'], { output: 'image-compress-output', quality: 'image-compress-quality' });
    }
    return Object.keys(next).length === 0;
  };

  /**
   * Validates the form and, when valid, ensures an input file is present and
   * starts the compression through `runTask`, which calls
   * `window.electronAPI.convertFile` with the format's codec (`IMAGE_CODEC_MAP`),
   * qscale, optional scale, aspect-ratio flag, and default pixel format. A
   * success toast is shown on completion; on validation or missing-input
   * failures a warning is logged and an error message is shown.
   * @returns {Promise<void>} Resolves when compression completes or fails.
   */
  const handleConvert = async () => {
    if (!validate()) {
      log.warn(LOG_VALIDATION_FAILED);
      return;
    }
    if (!input) {
      log.warn(LOG_NO_INPUT_FILE_SELECTED);
      showErrorMessage(ErrorCode.INPUT_NOT_SPECIFIED, t('imageCompress.validationRequired'));
      return;
    }
    log.info(LOG_COMPRESSING_IMAGE, input, LOG_ARROW, output, LOG_FORMAT, format, LOG_QUALITY, quality);
    await runTask(async () => {
      await window.electronAPI.convertFile(
        input,
        output,
        {
          videoCodec: IMAGE_CODEC_MAP[format],
          qscale: quality,
          scale: scale || undefined,
          keepAspectRatio,
          pixelFormat: CONVERSION_DEFAULTS.PIXEL_FORMAT,
        },
        transcoder,
      );
      useToastStore.getState().success(t('toast.imageCompressed'));
    });
    setProgress(null);
  };

  /**
   * Registers the page keyboard shortcuts (Ctrl+O input, Ctrl+Shift+S output,
   * Ctrl+Enter compress, K keep aspect ratio). Bindings mirror the enabled
   * state of the equivalent on-page controls.
   * @returns {void}
   */
  useHotkeys([
    {
      id: 'imageCompress.input',
      handler: async () => {
        const file = await openFileDialog(IMAGE_DROPZONE_ACCEPT);
        if (file) handleFileSelect(file);
      },
    },
    {
      id: 'imageCompress.output',
      handler: async () => {
        const f = await window.electronAPI.selectOutput();
        if (f) {
          setOutput(withExtension(f, format));
          clearFieldError('output');
        }
      },
    },
    { id: 'imageCompress.compress', handler: () => handleConvert(), enabled: !!input && !!output && !isConverting },
    { id: 'imageCompress.aspect', handler: () => setKeepAspectRatio(!keepAspectRatio) },
  ]);

  return (
    <PageContainer title={t('imageCompress.title')} icon={pageIcons['/image-compress']}>
      <Box>
        <FieldLabel>
          {t('imageCompress.inputImage')}
          <InfoTooltip title={t('imageCompress.inputImageHint')} />
        </FieldLabel>
        {!input && (
          <ErrorBoundary fallback={null}>
            <FileDropZone onFileSelect={handleFileSelect} label={t('imageCompress.dropLabel')} accept={IMAGE_DROPZONE_ACCEPT} />
          </ErrorBoundary>
        )}
        {input && (
          <MediaPreview
            imageSrc={preview}
            alt={fileName(input)}
            removeLabel={t('batchQueue.remove')}
            testId="image-preview"
            removeTestId="remove-image"
            variant="square"
            onRemove={clearSelection}
          >
            <Typography variant="body2" color="text.secondary" data-testid="selected-image">
              {(() => {
                const template = t('imageCompress.selectedImage', { file: '{{file}}' });
                const [before, after] = template.split('{{file}}');
                return (
                  <>
                    {before}
                    <SelectedImageName component="span">{fileName(input)}</SelectedImageName>
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
          </MediaPreview>
        )}
      </Box>

      <FilePathField
        label={t('imageCompress.outputFile')}
        hint={t('imageCompress.outputFileHint')}
        required
        value={output}
        placeholder={t('imageCompress.placeholderOutput')}
        buttonLabel={t('convert.browse')}
        onChange={handleOutputChange}
        testId="image-compress-output"
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
          <FieldLabel>
            {t('imageCompress.outputFormat')}
            <InfoTooltip title={t('imageCompress.outputFormatHint')} />
          </FieldLabel>
          <TextField
            select
            fullWidth
            size="small"
            value={format}
            onChange={(e) => handleFormatChange(e.target.value)}
            data-testid="image-compress-format"
            slotProps={{ htmlInput: { 'aria-label': t('imageCompress.outputFormat') } }}
          >
            {IMAGE_FORMATS.map((f) => (
              <MenuItem key={f.value} value={f.value}>
                {f.label}
              </MenuItem>
            ))}
          </TextField>
        </FieldBox>
        <FieldBox>
          <FieldLabel htmlFor={qualityId}>
            {t('imageCompress.quality')}
            <InfoTooltip title={t('imageCompress.qualityHint')} />
          </FieldLabel>
          <TextField
            fullWidth
            size="small"
            type="number"
            id={qualityId}
            data-testid="image-compress-quality"
            error={!!errors.quality}
            helperText={errors.quality || t('imageCompress.qualityRangeCaption')}
            value={quality}
            onChange={(e) => {
              setQuality(parseInt(e.target.value) || CONVERSION_DEFAULTS.QSCALE);
              clearFieldError('quality');
            }}
            onBlur={() => {
              if (!isInRange(quality, QSCALE_RANGE.MIN, QSCALE_RANGE.MAX)) setFieldError('quality', t('validation.qualityRange'));
            }}
            slotProps={{
              htmlInput: { min: QSCALE_RANGE.MIN, max: QSCALE_RANGE.MAX },
              input: {
                endAdornment: <InputAdornment position="end">/ {QSCALE_RANGE.MAX}</InputAdornment>,
              },
            }}
          />
        </FieldBox>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FieldBox>
          <FieldLabel>
            {t('imageCompress.scale')}
            <InfoTooltip title={t('imageCompress.scaleHint')} />
          </FieldLabel>
          <TextField
            select
            fullWidth
            size="small"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
            data-testid="image-compress-scale"
            slotProps={{ htmlInput: { 'aria-label': t('imageCompress.scale') } }}
          >
            <MenuItem value="">{t('imageCompress.noScale')}</MenuItem>
            {SCALE_OPTIONS.filter((s) => s !== '').map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        </FieldBox>
        <FieldBox>
          <ToggleSpacer />
          <AspectRatioRow data-testid="keep-aspect-ratio-row">
            <Switch
              checked={keepAspectRatio}
              onChange={(e) => setKeepAspectRatio(e.target.checked)}
              size="small"
              slotProps={{ input: { 'aria-label': t('imageCompress.keepAspectRatio') } }}
              data-testid="keep-aspect-ratio"
            />
            <Typography variant="caption">{t('imageCompress.keepAspectRatio')}</Typography>
            <InfoTooltip title={t('imageCompress.keepAspectRatioHint')} />
          </AspectRatioRow>
        </FieldBox>
      </Stack>

      <Tooltip title={shortcutHint(t, 'imageCompress.compress', SHORTCUT_BY_ID['imageCompress.compress'].keys)} arrow>
        <span>
          <Button
            variant="contained"
            startIcon={<FontAwesomeIcon icon={faCompress} />}
            onClick={handleConvert}
            disabled={!input || !output || isConverting}
            data-testid="image-compress-compress"
          >
            {isConverting ? t('imageCompress.compressing') : t('imageCompress.compress')}
          </Button>
        </span>
      </Tooltip>
      {progress && (
        <ErrorBoundary fallback={null}>
          <ProgressBar percent={progress.percent} />
        </ErrorBoundary>
      )}
    </PageContainer>
  );
}
