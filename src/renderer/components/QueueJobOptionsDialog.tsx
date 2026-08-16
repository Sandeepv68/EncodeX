/**
 * @fileoverview Per-job encoding-options editor for the batch queue page.
 *
 * Renders the batch encoding controls (`BatchEncodingPanel`) inside an MUI
 * dialog so a single queued job can have its options changed after being added.
 * The controls are seeded from the job's baked `ConversionOptions`, falling
 * back to the page's current field values for anything the job does not carry,
 * and the operation is recovered from the options with {@link inferJobOperation}.
 *
 * The dialog is stateful but stateless on purpose: the parent remounts it with
 * a `key` per edited job (`key={editJob?.id}`), so the local state is always
 * seeded fresh for whichever job opened it.
 *
 * Saving builds the exact options payload with {@link buildBatchOptions} (using
 * the current hardware-acceleration settings) and recomputes the output path
 * with {@link recomputeJobOutput} before handing both to the parent's
 * `onSave` callback, which performs the actual `queueUpdateOptions` IPC call.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import BatchEncodingPanel from './BatchEncodingPanel';
import { useSettingsStore } from '../stores/settingsStore';
import { IMAGE_FORMATS } from '../../shared/media-options';
import { getAudioCodecContainers, getVideoCodecContainer } from '../../shared/codec-containers';
import type { QueueJob } from '../../shared/types';
import type { QueueJobOptionsDialogProps } from './types';
import type { BatchEncodingValues } from '../utils/batch-options';
import { buildBatchOptions, inferJobOperation, recomputeJobOutput } from '../utils/batch-options';

/**
 * Extracts the basename of a file path, handling both Windows backslashes and
 * POSIX forward slashes.
 * @param {string} path - The file path to process.
 * @returns {string} The trailing path segment, or the original path when it
 *   has no separators.
 */
function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * Seeds the dialog's encoding field values from a job's baked options, using
 * the page defaults for any field the job does not carry. The container/format
 * field is derived from the job's current output extension when it is
 * compatible with the job's codecs (so the dropdown reflects the actual
 * output), otherwise the page's current container value is used.
 * @param {QueueJob} job - The job being edited.
 * @param {BatchEncodingValues} defaults - The page's current field values.
 * @returns {BatchEncodingValues} The seeded values for the dialog controls.
 */
function seedEncodingValues(job: QueueJob, defaults: BatchEncodingValues): BatchEncodingValues {
  const options = job.options;
  const operation = inferJobOperation(options);
  const videoCodec = options.videoCodec ?? defaults.videoCodec;
  const audioCodec = options.audioCodec ?? defaults.audioCodec;

  let container = defaults.container;
  const ext = basename(job.output).split('.').pop()?.toLowerCase();
  if (ext) {
    const compatible =
      operation === 'compress_image'
        ? IMAGE_FORMATS.some((f) => f.value === ext)
        : options.videoCodec
          ? getVideoCodecContainer(options.videoCodec).containers.includes(ext)
          : options.audioCodec
            ? getAudioCodecContainers(options.audioCodec).includes(ext)
            : false;
    if (compatible) container = ext;
  }

  return {
    videoCodec,
    audioCodec,
    container,
    videoBitrate: options.videoBitrate ?? defaults.videoBitrate,
    audioBitrate: options.audioBitrate ?? defaults.audioBitrate,
    quality: options.qscale !== undefined ? String(options.qscale) : defaults.quality,
    scale: options.scale ?? defaults.scale,
    pixelFormat: options.pixelFormat ?? defaults.pixelFormat,
  };
}

/**
 * Renders the per-job encoding-options dialog.
 *
 * Controlled field state is initialized once from the edited job (the parent
 * remounts this component per job), and every change flows through the panel's
 * callbacks. The Save action builds the options payload from the field values
 * and the current hardware-acceleration settings, recomputes the output path,
 * and forwards both to the parent; Cancel just closes.
 * @param {QueueJobOptionsDialogProps} props - Component props.
 * @param {boolean} props.open - Whether the dialog is shown.
 * @param {QueueJob | null} props.job - The job being edited; null hides the
 *   dialog (no controls are interactive while hidden).
 * @param {BatchEncodingValues} props.defaults - Fallback field values for
 *   fields the job's options do not carry.
 * @param {(job: QueueJob, options: object, output: string) => void} props.onSave
 *   - Fired with the job, built options, and recomputed output on confirm.
 * @param {() => void} props.onClose - Fired when the dialog is dismissed
 *   without saving.
 * @returns {JSX.Element} The dialog.
 */
export default function QueueJobOptionsDialog({ open, job, defaults, onSave, onClose }: QueueJobOptionsDialogProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<BatchEncodingValues>(() => (job ? seedEncodingValues(job, defaults) : { ...defaults }));

  if (!job) {
    return null;
  }

  const operation = inferJobOperation(job.options);

  /**
   * Applies a new video codec selection and clears the chosen container when it
   * is no longer compatible with that codec, so the job never muxes into a
   * container the encoder cannot write.
   * @param {string} codec - The newly selected video encoder name.
   * @returns {void}
   */
  const handleVideoCodecChange = (codec: string) => {
    setValues((prev) => {
      const next = { ...prev, videoCodec: codec };
      if (next.container && !getVideoCodecContainer(codec).containers.includes(next.container)) {
        next.container = '';
      }
      return next;
    });
  };

  /**
   * Applies a new audio codec selection and clears the chosen container when it
   * is no longer compatible with that codec, so extract-audio jobs never mux
   * into a container the encoder cannot write.
   * @param {string} codec - The newly selected audio encoder name.
   * @returns {void}
   */
  const handleAudioCodecChange = (codec: string) => {
    setValues((prev) => {
      const next = { ...prev, audioCodec: codec };
      if (next.container && !getAudioCodecContainers(codec).includes(next.container)) {
        next.container = '';
      }
      return next;
    });
  };

  /**
   * Builds the job's options from the current field values and the
   * hardware-acceleration settings, recomputes the output path, and forwards
   * everything to the parent for the actual `queueUpdateOptions` call.
   * @returns {void}
   */
  const handleSave = () => {
    const { hardwareAcceleration, hwaccelMode } = useSettingsStore.getState();
    const options = buildBatchOptions(operation, values, { hardwareAcceleration, hwaccelMode });
    const output = recomputeJobOutput(job, values.container);
    onSave(job, options, output);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('batchQueue.editOptionsTitle', { file: basename(job.input) })}</DialogTitle>
      <DialogContent dividers>
        <BatchEncodingPanel
          operation={operation}
          videoCodec={values.videoCodec}
          audioCodec={values.audioCodec}
          container={values.container}
          videoBitrate={values.videoBitrate}
          audioBitrate={values.audioBitrate}
          quality={values.quality}
          scale={values.scale}
          pixelFormat={values.pixelFormat}
          onVideoCodecChange={handleVideoCodecChange}
          onAudioCodecChange={handleAudioCodecChange}
          onContainerChange={(value) => setValues((prev) => ({ ...prev, container: value }))}
          onVideoBitrateChange={(value) => setValues((prev) => ({ ...prev, videoBitrate: value }))}
          onAudioBitrateChange={(value) => setValues((prev) => ({ ...prev, audioBitrate: value }))}
          onQualityChange={(value) => setValues((prev) => ({ ...prev, quality: value }))}
          onScaleChange={(value) => setValues((prev) => ({ ...prev, scale: value }))}
          onPixelFormatChange={(value) => setValues((prev) => ({ ...prev, pixelFormat: value }))}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<FontAwesomeIcon icon={faXmark} />} color="inherit">
          {t('batchQueue.dialogCancel')}
        </Button>
        <Button onClick={handleSave} variant="contained" startIcon={<FontAwesomeIcon icon={faCheck} />}>
          {t('batchQueue.editOptionsSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
