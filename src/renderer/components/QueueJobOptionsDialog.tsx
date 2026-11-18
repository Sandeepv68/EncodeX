/**
 * @fileoverview Per-job encoding-options editor for the batch queue page.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@mui/material';
import { faCheck, faSliders, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AppDialog from './AppDialog';
import BatchEncodingPanel from './BatchEncodingPanel';
import { useSettingsStore } from '../stores/settingsStore';
import { IMAGE_FORMATS } from '../../shared/media-options';
import { getAudioCodecContainers, getVideoCodecContainer } from '../../shared/codec-containers';
import type { QueueJob } from '../../shared/types';
import type { QueueJobOptionsDialogProps } from './types';
import type { BatchEncodingValues } from '../utils/batch-options';
import { buildBatchOptions, isMuxStyleJob, inferJobOperation, recomputeJobOutput } from '../utils/batch-options';
import { basename } from '../utils/path-utils';

/**
 * Seeds the dialog's encoding field values from a job's baked options.
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
    rotate: options.rotate ?? defaults.rotate,
    flipH: options.flipH ?? defaults.flipH,
    flipV: options.flipV ?? defaults.flipV,
    pixelFormat: options.pixelFormat ?? defaults.pixelFormat,
    videoFilters: options.videoFilters ?? defaults.videoFilters,
  };
}

/**
 * Renders the per-job encoding-options dialog.
 * @param {QueueJobOptionsDialogProps} props - Component props.
 * @returns {JSX.Element} The dialog.
 */
export default function QueueJobOptionsDialog({ open, job, defaults, onSave, onClose }: QueueJobOptionsDialogProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<BatchEncodingValues>(() => (job ? seedEncodingValues(job, defaults) : { ...defaults }));

  if (!job) {
    return <></>;
  }

  const operation = inferJobOperation(job.options);

  const handleVideoCodecChange = (codec: string) => {
    setValues((prev) => {
      const next = { ...prev, videoCodec: codec };
      if (next.container && !getVideoCodecContainer(codec).containers.includes(next.container)) {
        next.container = '';
      }
      return next;
    });
  };

  const handleAudioCodecChange = (codec: string) => {
    setValues((prev) => {
      const next = { ...prev, audioCodec: codec };
      if (next.container && !getAudioCodecContainers(codec).includes(next.container)) {
        next.container = '';
      }
      return next;
    });
  };

  const handleSave = () => {
    const { hardwareAcceleration, hwaccelMode } = useSettingsStore.getState();
    if (isMuxStyleJob(job.options)) {
      onSave(job, { ...job.options }, job.output);
      return;
    }
    const options = buildBatchOptions(operation, values, { hardwareAcceleration, hwaccelMode });
    const output = recomputeJobOutput(job, values.container);
    onSave(job, options, output);
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={t('batchQueue.editOptionsTitle', { file: basename(job.input) })}
      icon={<FontAwesomeIcon icon={faSliders} />}
      showCloseButton
      closeButtonAriaLabel={t('shortcuts.close')}
      maxWidth="md"
      fullWidth
      actions={
        <>
          <Button onClick={onClose} startIcon={<FontAwesomeIcon icon={faXmark} />} color="inherit">
            {t('batchQueue.dialogCancel')}
          </Button>
          <Button onClick={handleSave} variant="contained" startIcon={<FontAwesomeIcon icon={faCheck} />}>
            {t('batchQueue.editOptionsSave')}
          </Button>
        </>
      }
    >
      <BatchEncodingPanel
        operation={operation}
        videoCodec={values.videoCodec}
        audioCodec={values.audioCodec}
        container={values.container}
        videoBitrate={values.videoBitrate}
        audioBitrate={values.audioBitrate}
        quality={values.quality}
        scale={values.scale}
        rotate={values.rotate}
        flipH={values.flipH}
        flipV={values.flipV}
        pixelFormat={values.pixelFormat}
        videoFilters={values.videoFilters}
        onVideoCodecChange={handleVideoCodecChange}
        onAudioCodecChange={handleAudioCodecChange}
        onContainerChange={(value) => setValues((prev) => ({ ...prev, container: value }))}
        onVideoBitrateChange={(value) => setValues((prev) => ({ ...prev, videoBitrate: value }))}
        onAudioBitrateChange={(value) => setValues((prev) => ({ ...prev, audioBitrate: value }))}
        onQualityChange={(value) => setValues((prev) => ({ ...prev, quality: value }))}
        onScaleChange={(value) => setValues((prev) => ({ ...prev, scale: value }))}
        onRotateChange={(value) => setValues((prev) => ({ ...prev, rotate: value }))}
        onFlipHChange={(value) => setValues((prev) => ({ ...prev, flipH: value }))}
        onFlipVChange={(value) => setValues((prev) => ({ ...prev, flipV: value }))}
        onPixelFormatChange={(value) => setValues((prev) => ({ ...prev, pixelFormat: value }))}
        onVideoFiltersChange={(value) => setValues((prev) => ({ ...prev, videoFilters: value }))}
      />
    </AppDialog>
  );
}
