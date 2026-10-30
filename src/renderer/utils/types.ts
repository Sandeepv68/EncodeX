/**
 * @fileoverview Type definitions for the renderer utilities.
 * Declares the shapes shared by the batch-option builders, the queue-job
 * planners, the seasonal easter-egg date helpers, the lunar-calendar fallback,
 * the string helpers, and the timeline geometry helpers.
 */

import type { ConversionOptions, HwAccelMode, MediaStreamInfo, QueueJob } from '../../shared/types';

/* ------------------------------------------------------------------ *
 * batch-options
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * easter-egg-dates
 * ------------------------------------------------------------------ */

/**
 * Identifier for every festival that has a seasonal logo.
 * @typedef {('diwali'|'christmas'|'easter'|'holi'|'halloween'|'july4th'|'new_year')} FestivalId
 */
export type FestivalId = 'diwali' | 'christmas' | 'easter' | 'holi' | 'halloween' | 'july4th' | 'new_year';

/**
 * A calendar date as month/day numbers, month is 1-based.
 * @typedef {Object} CalendarDate
 * @property {number} month - Month of the year (1-12).
 * @property {number} day - Day of the month (1-31).
 */
export interface CalendarDate {
  month: number;
  day: number;
}

/* ------------------------------------------------------------------ *
 * lunar-calendar
 * ------------------------------------------------------------------ */

/**
 * A calendar date as month/day numbers, month is 1-based.
 * @typedef {Object} LunarDate
 * @property {number} month - Month of the year (1-12).
 * @property {number} day - Day of the month (1-31).
 */
export interface LunarDate {
  month: number;
  day: number;
}

/**
 * A detected syzygy: the exact Julian Ephemeris Day and the sidereal longitude
 * of the Sun at that instant.
 * @typedef {Object} Syzygy
 * @property {number} jde - Julian Ephemeris Day of the syzygy.
 * @property {number} siderealSun - Sidereal solar longitude at the syzygy.
 */
export interface Syzygy {
  jde: number;
  siderealSun: number;
}

/* ------------------------------------------------------------------ *
 * queue-job-utils
 * ------------------------------------------------------------------ */

/**
 * MUI Chip color props used for the queue-status chip.
 * @typedef {string} StatusChipColor
 */
export type StatusChipColor = 'default' | 'primary' | 'success' | 'error' | 'warning';

/**
 * A single validated enqueue request, ready for the IPC call.
 * @interface EnqueueDraft
 * @property {string} file - The source file path.
 * @property {string} output - The derived output path.
 * @property {ConversionOptions} options - The built conversion options.
 * @property {string} transcoder - The transcoder value.
 * @property {boolean} overwrite - Whether overwrite is enabled.
 */
export interface EnqueueDraft {
  file: string;
  output: string;
  options: ConversionOptions;
  transcoder: string;
  overwrite: boolean;
}

/**
 * Result of planning a set of batch enqueues.
 * @interface EnqueuePlan
 * @property {EnqueueDraft[]} enqueues - Validated drafts, one per accepted file.
 * @property {string[]} skippedNames - Basenames of rejected files (in order).
 */
export interface EnqueuePlan {
  enqueues: EnqueueDraft[];
  skippedNames: string[];
}

/**
 * Inputs shared by every selection while planning enqueues.
 * @interface PlanEnqueuesContext
 * @property {Array<{ file: string; operation: string }>} selections - Files with
 *   their chosen batch operation.
 * @property {QueueJob[]} currentJobs - Jobs already in the queue.
 * @property {string} outputDir - Target output folder ('' = source-adjacent).
 * @property {BatchEncodingValues} enc - Shared encoding field values.
 * @property {{ hardwareAcceleration: boolean; hwaccelMode: HwAccelMode }} hw -
 *   Hardware-acceleration settings.
 * @property {string} suffix - Name suffix inserted before the extension.
 * @property {string} transcoder - Transcoder value for every job.
 * @property {boolean} overwrite - Overwrite flag for every job.
 * @property {(file: string) => Promise<MediaStreamInfo[]>} [probe] - Optional
 *   stream prober used by 'demux' (and only 'demux') to split each file into
 *   one job per extracted stream. Absent = the operation is skipped.
 */
export interface PlanEnqueuesContext {
  selections: Array<{ file: string; operation: string }>;
  currentJobs: QueueJob[];
  outputDir: string;
  enc: BatchEncodingValues;
  hw: { hardwareAcceleration: boolean; hwaccelMode: HwAccelMode };
  suffix: string;
  transcoder: string;
  overwrite: boolean;
  probe?: (file: string) => Promise<MediaStreamInfo[]>;
}

/* ------------------------------------------------------------------ *
 * string-utils
 * ------------------------------------------------------------------ */

/**
 * A single segment of text, flagged as highlighted when it matched the query.
 * @interface HighlightSegment
 * @property {string} text - The segment's text content.
 * @property {boolean} highlight - True when the segment is a query match.
 */
export interface HighlightSegment {
  text: string;
  highlight: boolean;
}

/* ------------------------------------------------------------------ *
 * timeline-utils
 * ------------------------------------------------------------------ */

/**
 * Resolved ruler tick layout for a visible time range.
 * @interface RulerTicks
 * @property {number} step - Major tick interval in seconds.
 * @property {number} sub - Minor sub-tick interval in seconds (0 when no room).
 * @property {number[]} major - Major tick time values (seconds).
 * @property {number[]} minor - Minor sub-tick time values that do not coincide
 *   with major ticks.
 * @property {number[]} labels - Major tick values that pass the label-gap test.
 */
export interface RulerTicks {
  step: number;
  sub: number;
  major: number[];
  minor: number[];
  labels: number[];
}

/**
 * Geometry of a single waveform bar.
 * @interface WaveformBarGeometry
 * @property {number} left - Left offset in pixels.
 * @property {number} top - Top offset in pixels.
 * @property {number} width - Bar width in pixels.
 * @property {number} height - Bar height in pixels.
 */
export interface WaveformBarGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
}
