/**
 * @fileoverview Shared helpers for batch queue encoding-option editing.
 *
 * The batch page and the per-job options dialog must compute a job's options
 * and output path identically to add-time code, so these functions centralize
 * that logic:
 *  - {@link buildBatchOptions} mirrors the page's old inline builder, producing
 *    the exact `ConversionOptions` payload for a batch operation.
 *  - {@link inferJobOperation} recovers which batch operation a job was created
 *    under by inspecting its baked options (needed because a job does not store
 *    the operation itself).
 *  - {@link recomputeJobOutput} swaps a queued job's output extension when the
 *    user changes the container/format, only when the new container is actually
 *    compatible with the job's codecs.
 */

import { QueueJob, ConversionOptions, HwAccelMode } from '../../shared/types';
import { BATCH_OPERATIONS, IMAGE_FORMATS } from '../../shared/media-options';
import { getAudioCodecContainers, getVideoCodecContainer } from '../../shared/codec-containers';

/**
 * Encoding-option field values shared by the batch page and the per-job dialog.
 * Each string mirrors the page's controlled state; empty strings mean "use the
 * encoder default" for the optional fields.
 * @interface BatchEncodingValues
 */
export interface BatchEncodingValues {
  videoCodec: string;
  audioCodec: string;
  container: string;
  videoBitrate: string;
  audioBitrate: string;
  quality: string;
  scale: string;
  pixelFormat: string;
}

/**
 * Hardware-acceleration settings used to decorate the built options.
 * @interface BatchHwSettings
 */
export interface BatchHwSettings {
  hardwareAcceleration: boolean;
  hwaccelMode: HwAccelMode;
}

/**
 * Builds the queued `ConversionOptions` for a batch operation from the shared
 * encoding field values and the hardware-acceleration settings. 'transcode'
 * keeps video and audio codecs plus video/audio bitrate, scale, and pixel
 * format; 'extract_audio' keeps only audio (with audio bitrate);
 * 'compress_image' keeps only image encoding (qscale and scale, no video/audio
 * codecs).
 * @param {string} operation - The batch operation value.
 * @param {BatchEncodingValues} values - The shared encoding field values.
 * @param {BatchHwSettings} hw - Current hardware-acceleration settings.
 * @returns {Object} The options payload for the job.
 */
export function buildBatchOptions(
  operation: string,
  values: BatchEncodingValues,
  hw: BatchHwSettings,
): {
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  qscale?: number;
  scale?: string;
  pixelFormat?: string;
  hardwareAcceleration: boolean;
  hwaccelMode: HwAccelMode;
} {
  const { videoCodec, audioCodec, videoBitrate, audioBitrate, quality, scale, pixelFormat } = values;
  return {
    videoCodec: operation === 'transcode' ? videoCodec : undefined,
    audioCodec: operation === 'transcode' || operation === 'extract_audio' ? audioCodec : undefined,
    videoBitrate: operation === 'transcode' ? videoBitrate || undefined : undefined,
    audioBitrate: operation === 'transcode' || operation === 'extract_audio' ? audioBitrate || undefined : undefined,
    qscale: operation === 'compress_image' && quality ? Number(quality) : undefined,
    scale: operation === 'transcode' || operation === 'compress_image' ? scale || undefined : undefined,
    pixelFormat: operation === 'transcode' ? pixelFormat : undefined,
    hardwareAcceleration: hw.hardwareAcceleration,
    hwaccelMode: hw.hwaccelMode,
  };
}

/**
 * Recovers which batch operation a job was created under by inspecting its
 * baked options. A job does not store its operation, so it is inferred from the
 * codec fields: video codec implies 'transcode', audio-only implies
 * 'extract_audio', and an image qscale implies 'compress_image'. Options with
 * none of these markers (e.g. imported jobs with empty options) fall back to
 * the first batch operation ('transcode').
 * @param {ConversionOptions} options - The job's current options.
 * @returns {string} The inferred batch operation value.
 */
export function inferJobOperation(options: ConversionOptions): string {
  if (options.videoCodec) return 'transcode';
  if (options.audioCodec) return 'extract_audio';
  if (options.qscale !== undefined) return 'compress_image';
  return BATCH_OPERATIONS[0].value;
}

/**
 * Swaps a queued job's output extension to `container` when that container is
 * compatible with the job's codecs. The current output extension is preserved
 * when the requested container is empty, incompatible with the job's codec, or
 * the job's operation cannot be inferred. Used when the container/format
 * selection changes so already-queued jobs keep their outputs in sync.
 * @param {QueueJob} job - The queued job whose output should be recomputed.
 * @param {string} container - The requested container/format value (no leading
 *   dot; empty keeps the current extension).
 * @returns {string} The updated output path, or the job's current output when
 *   nothing changes.
 */
export function recomputeJobOutput(job: QueueJob, container: string): string {
  if (!container) return job.output;
  const ext = container.replace(/^\./, '');
  const operation = inferJobOperation(job.options);
  if (operation === 'compress_image') {
    if (!IMAGE_FORMATS.some((f) => f.value === ext)) return job.output;
  } else if (job.options.videoCodec) {
    if (!getVideoCodecContainer(job.options.videoCodec).containers.includes(ext)) return job.output;
  } else if (job.options.audioCodec) {
    if (!getAudioCodecContainers(job.options.audioCodec).includes(ext)) return job.output;
  } else {
    return job.output;
  }
  const base = job.output.replace(/\.[^/\\]*$/, '');
  if (base === job.output) return job.output;
  return `${base}.${ext}`;
}
