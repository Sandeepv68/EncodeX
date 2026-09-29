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
import {
  DEFAULT_VIDEO_ENCODERS,
  getAudioCodecContainers,
  getVideoCodecContainer,
  suggestedExtensionForAudioCodec,
  suggestedExtensionForVideoCodec,
} from '../../shared/codec-containers';
import { basename, dirname as getSourceDir, stem as getSourceStem } from './path-utils';

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
  rotate: string;
  flipH: boolean;
  flipV: boolean;
  pixelFormat: string;
  videoFilters: string[];
  /**
   * Remux: explicit stream-edge selection of the source file as `-map` specs
   * (e.g. ['0:v:0', '0:a:1']). Empty or absent selects every stream.
   */
  selectedMaps?: string[];
  /**
   * Demux: stream kind extracted by THIS per-stream job ('video' | 'audio' |
   * 'subtitle').
   */
  demuxKind?: 'video' | 'audio' | 'subtitle';
  /**
   * Demux: stream kinds a batch extracts from each file ('video' | 'audio' |
   * 'subtitle'). Empty or absent extracts every kind.
   */
  demuxKinds?: Array<'video' | 'audio' | 'subtitle'>;
  /** Demux: `-map` spec of the single stream THIS job extracts (e.g. '0:a:1'). */
  demuxMap?: string;
  /** Demux: video re-encode container (extension); empty = lossless stream copy. */
  demuxVideoContainer?: string;
  /** Demux: audio encoder for converted audio streams; empty = stream copy. */
  demuxAudioCodec?: string;
  /** Demux: subtitle format for converted subtitle streams; empty = stream copy. */
  demuxSubtitleFormat?: string;
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
 * keeps video and audio codecs plus video/audio bitrate, scale, pixel format,
 * and the ordered video-filter chain; 'extract_audio' keeps only audio (with
 * audio bitrate); 'compress_image' keeps only image encoding (qscale, scale,
 * and rotation, no video/audio codecs). Rotation and mirroring apply to both
 * 'transcode' and 'compress_image'.
 *
 * 'remux' forces a stream copy into the selected container, maps the explicit
 * `selectedMaps` edges (all streams when empty), and drops every encoder.
 * 'demux' builds the options of ONE per-stream job: it stream-copies the
 * `demuxMap` stream by default and re-encodes that kind when the matching
 * `DemuxMediaPreferences` target (`demuxVideoContainer` / `demuxAudioCodec` /
 * `demuxSubtitleFormat`) is set. Each build returns -vn/-an guards so only the
 * mapped stream kind is written to the output.
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
  rotate?: ConversionOptions['rotate'];
  flipH?: boolean;
  flipV?: boolean;
  pixelFormat?: string;
  videoFilters?: string[];
  copy?: boolean;
  video?: boolean;
  audio?: boolean;
  map?: string[];
  subtitleCodec?: string;
  hardwareAcceleration: boolean;
  hwaccelMode: HwAccelMode;
} {
  if (operation === 'remux') {
    const selectedMaps = values.selectedMaps && values.selectedMaps.length > 0 ? values.selectedMaps : undefined;
    return {
      copy: true,
      video: selectedMaps ? true : undefined,
      audio: selectedMaps ? true : undefined,
      map: selectedMaps,
      hardwareAcceleration: hw.hardwareAcceleration,
      hwaccelMode: hw.hwaccelMode,
    };
  }
  if (operation === 'demux') {
    const map = values.demuxMap ? [values.demuxMap] : undefined;
    if (values.demuxKind === 'video') {
      const container = values.demuxVideoContainer || '';
      const convert = container.length > 0;
      return {
        copy: !convert,
        video: true,
        audio: false,
        map,
        videoCodec: convert ? (DEFAULT_VIDEO_ENCODERS[container] ?? 'libx264') : undefined,
        hardwareAcceleration: hw.hardwareAcceleration,
        hwaccelMode: hw.hwaccelMode,
      };
    }
    if (values.demuxKind === 'audio') {
      const codec = values.demuxAudioCodec || '';
      const convert = codec.length > 0;
      return {
        copy: !convert,
        video: false,
        audio: true,
        map,
        audioCodec: convert ? codec : undefined,
        hardwareAcceleration: hw.hardwareAcceleration,
        hwaccelMode: hw.hwaccelMode,
      };
    }
    if (values.demuxKind === 'subtitle') {
      const format = values.demuxSubtitleFormat || '';
      const convert = format.length > 0;
      return {
        copy: !convert,
        video: false,
        audio: false,
        map,
        subtitleCodec: convert ? format : undefined,
        hardwareAcceleration: hw.hardwareAcceleration,
        hwaccelMode: hw.hwaccelMode,
      };
    }
  }
  const { videoCodec, audioCodec, videoBitrate, audioBitrate, quality, scale, rotate, flipH, flipV, pixelFormat, videoFilters } = values;
  const appliesGeometry = operation === 'transcode' || operation === 'compress_image';
  return {
    videoCodec: operation === 'transcode' ? videoCodec : undefined,
    audioCodec: operation === 'transcode' || operation === 'extract_audio' ? audioCodec : undefined,
    videoBitrate: operation === 'transcode' ? videoBitrate || undefined : undefined,
    audioBitrate: operation === 'transcode' || operation === 'extract_audio' ? audioBitrate || undefined : undefined,
    qscale: operation === 'compress_image' && quality ? Number(quality) : undefined,
    scale: appliesGeometry ? scale || undefined : undefined,
    rotate: appliesGeometry ? ((rotate || undefined) as ConversionOptions['rotate']) : undefined,
    flipH: appliesGeometry ? flipH || undefined : undefined,
    flipV: appliesGeometry ? flipV || undefined : undefined,
    pixelFormat: operation === 'transcode' ? pixelFormat : undefined,
    videoFilters: operation === 'transcode' && videoFilters.length > 0 ? videoFilters : undefined,
    hardwareAcceleration: hw.hardwareAcceleration,
    hwaccelMode: hw.hwaccelMode,
  };
}

/**
 * Derives a batch job's output path by inserting the configured suffix before
 * the chosen extension, inside the optional output folder when one is set. The
 * extension is the container value when present, otherwise the per-operation
 * default (audio-codec container for 'extract_audio', the source extension or
 * video-codec container for 'transcode', the source extension otherwise),
 * falling back to 'mp4'. 'remux' keeps the container value and otherwise the
 * source extension; 'demux' keeps the container value (the per-stream
 * stream-derived or conversion-target extension supplied by the caller) and
 * otherwise the source extension. An optional `streamName` (`video|audio_N|
 * subtitle_N|...) is inserted between the stem and the suffix so per-stream
 * demux outputs stay distinct (e.g. `movie.audio_1_encodex_demux.srt`).
 * @param {Object} args - Derivation inputs.
 * @param {string} args.file - The source file path.
 * @param {string} args.operation - The batch operation value.
 * @param {string} args.sourceExt - The source file's extension.
 * @param {string} args.container - The shared container/format value.
 * @param {string} args.audioCodec - The shared audio codec value.
 * @param {string} args.videoCodec - The shared video codec value.
 * @param {string} args.outputDir - The output folder ('' = source-adjacent).
 * @param {string} args.suffix - The name-suffix to insert (e.g. `_encodex_converted`).
 * @param {string} [args.streamName] - Optional per-stream marker inserted after
 *   the stem (e.g. 'audio_0'); default keeps the current naming.
 * @returns {string} The computed output path.
 */
export function buildOutputPath(args: {
  file: string;
  operation: string;
  sourceExt: string;
  container: string;
  audioCodec: string;
  videoCodec: string;
  outputDir: string;
  suffix: string;
  streamName?: string;
}): string {
  const { file, operation, sourceExt, container, audioCodec, videoCodec, outputDir, suffix, streamName } = args;
  const sourceDir = outputDir.length > 0 ? outputDir.replace(/\\/g, '/').replace(/\/+$/, '') : getSourceDir(file).replace(/\\/g, '/');
  const stem = getSourceStem(file);
  let ext = container;
  if (!ext) {
    if (operation === 'extract_audio') ext = suggestedExtensionForAudioCodec(audioCodec) || sourceExt;
    else if (operation === 'transcode') ext = sourceExt || suggestedExtensionForVideoCodec(videoCodec);
    else if (operation === 'remux' || operation === 'demux') ext = sourceExt;
    else ext = sourceExt;
  }
  if (!ext) ext = 'mp4';
  return `${sourceDir ? sourceDir + '/' : ''}${stem}${streamName ? '.' + streamName : ''}${suffix}.${ext}`;
}

/**
 * Recovers which batch operation a job was created under by inspecting its
 * baked options. A job does not store its operation, so it is inferred from the
 * option markers: a stream `map` means 'remux' when both video and audio edges
 * are kept (video:true and audio not disabled) and 'demux' otherwise (single
 * stream kinds always drop the other side); `copy` without a map means 'remux';
 * a video codec implies 'transcode', audio-only implies 'extract_audio', and an
 * image qscale implies 'compress_image'. The map/copy markers take priority
 * over codec markers because converted demux jobs still carry their re-encode
 * codec. Options with none of these markers (e.g. imported jobs with empty
 * options) fall back to the first batch operation ('transcode').
 * @param {ConversionOptions} options - The job's current options.
 * @returns {string} The inferred batch operation value.
 */
export function inferJobOperation(options: ConversionOptions): string {
  if (options.map) return options.video === true && options.audio !== false ? 'remux' : 'demux';
  if (options.copy) return 'remux';
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
  } else if (operation === 'remux') {
    // any container is acceptable for a stream-copy remux; swap without codec checks
  } else if (operation === 'demux') {
    // per-stream outputs keep their stream-derived conversion extension
    return job.output;
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

/**
 * Moves a queued job's output path into the given output directory (or back to
 * source-adjacent when the directory is empty). The job's output basename
 * (filename including extension and suffix) is preserved; only the parent
 * directory changes. Used when the batch output folder setting changes so
 * queued jobs follow the new directory before the batch starts.
 * @param {QueueJob} job - The queued job whose output should be recomputed.
 * @param {string} outputDir - The new output folder; empty means source-adjacent.
 * @returns {string} The updated output path, or the job's current output when
 *   the target directory already matches.
 */
export function recomputeJobOutputDir(job: QueueJob, outputDir: string): string {
  const targetDir = outputDir.length > 0 ? outputDir.replace(/\\/g, '/').replace(/\/+$/, '') : getSourceDir(job.input).replace(/\\/g, '/');
  const currentDir = getSourceDir(job.output).replace(/\\/g, '/');
  if (targetDir === currentDir) return job.output;
  return `${targetDir}/${basename(job.output)}`;
}
