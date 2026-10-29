/**
 * @fileoverview Type definitions for the EncodeX CLI.
 * Describes the flag shapes every subcommand accepts, the parameter objects the
 * subcommand runners take, and the small output/progress shapes the terminal UI
 * helpers exchange.
 */

import type { RemuxWarning } from '../../shared/codec-containers';
import type { ConversionOptions } from '../../shared/types';
import type { CliThemeId } from '../cli-logo';
import type { ITranscoder } from '../transcoders/types';

/**
 * Conversion flags accepted by the `convert` subcommand.
 * @interface ConvertCliFlags
 * @property {string} [output] - Explicit output file (`-o, --output`).
 * @property {string} [videoCodec] - Video encoder name (`-v, --video-codec`).
 * @property {string} [audioCodec] - Audio encoder name (`-a, --audio-codec`).
 * @property {string} [bitrateVideo] - Video bitrate (`--bitrate-video`).
 * @property {string} [bitrateAudio] - Audio bitrate (`--bitrate-audio`).
 * @property {string} [qscale] - Video quality scale (`-q, --qscale`).
 * @property {string} [pixFmt] - Pixel format (`--pix-fmt`).
 * @property {string} [scale] - Output resolution (`-s, --scale`).
 * @property {string} [startTime] - Trim start time (`--start-time`).
 * @property {string} [endTime] - Trim end time (`--end-time`).
 * @property {string} [duration] - Max output duration (`--duration`).
 * @property {boolean} [copy] - Lossless stream copy (`--copy`).
 * @property {boolean} [audio] - Include audio (`--no-audio` sets false).
 * @property {boolean} [video] - Include video (`--no-video` sets false).
 * @property {boolean} [hwaccel] - Enable hardware acceleration (`--hwaccel`).
 * @property {string} [hwaccelMode] - Hardware acceleration mode (`--hwaccel-mode`).
 * @property {string} [filters] - Comma-joined video filter chain (`--filters`).
 * @property {string[]} [presets] - Curated filter preset ids (`--preset`,
 *   repeatable).
 */
export interface ConvertCliFlags {
  output?: string;
  videoCodec?: string;
  audioCodec?: string;
  bitrateVideo?: string;
  bitrateAudio?: string;
  qscale?: string;
  pixFmt?: string;
  scale?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  copy?: boolean;
  audio?: boolean;
  video?: boolean;
  hwaccel?: boolean;
  hwaccelMode?: string;
  filters?: string;
  presets?: string[];
}

/**
 * Parameters for a single CLI conversion run.
 * @interface RunConvertParams
 * @property {string} input - Input file path.
 * @property {string} [output] - Output file path (derived when absent).
 * @property {ConvertCliFlags} flags - Parsed conversion flags.
 * @property {ITranscoder} transcoder - Transcoder backend to run the job.
 * @property {number} timeoutSeconds - Hard conversion timeout in seconds.
 * @property {CliThemeId} themeId - Theme used to color the progress bar.
 */
export interface RunConvertParams {
  input: string;
  output?: string;
  flags: ConvertCliFlags;
  transcoder: ITranscoder;
  timeoutSeconds: number;
  themeId: CliThemeId;
}

/**
 * Parameters for running an already-built `ConversionOptions` through a
 * transcoder with progress rendering and a hard timeout.
 * @interface RunPreparedParams
 * @property {string} input - Input file path.
 * @property {string} output - Output file path.
 * @property {ConversionOptions} options - Prebuilt conversion options.
 * @property {ITranscoder} transcoder - Transcoder backend to run the job.
 * @property {number} timeoutSeconds - Hard conversion timeout in seconds.
 * @property {CliThemeId} themeId - Theme used to color the progress bar.
 * @property {string} [successText] - Line printed on success (defaults to
 *   `Converted <input> → <output>`).
 */
export interface RunPreparedParams {
  input: string;
  output: string;
  options: ConversionOptions;
  transcoder: ITranscoder;
  timeoutSeconds: number;
  themeId: CliThemeId;
  successText?: string;
}

/**
 * Flags accepted by the `compress` subcommand.
 * @interface CompressCliFlags
 * @property {string} [output] - Explicit output file (`-o, --output`).
 * @property {string} [format] - Output image format (`-f, --format`).
 * @property {string} [quality] - Quality scale (`-q, --quality`, 1-31).
 * @property {string} [scale] - Output resolution (`-s, --scale`).
 */
export interface CompressCliFlags {
  output?: string;
  format?: string;
  quality?: string;
  scale?: string;
}

/**
 * Flags accepted by the `extract-audio` subcommand.
 * @interface ExtractAudioCliFlags
 * @property {string} [output] - Explicit output file (`-o, --output`).
 * @property {string} [audioCodec] - Audio encoder (`-a, --audio-codec`).
 * @property {string} [bitrateAudio] - Audio bitrate (`--bitrate-audio`).
 */
export interface ExtractAudioCliFlags {
  output?: string;
  audioCodec?: string;
  bitrateAudio?: string;
}

/**
 * Parameters for a batch conversion run.
 * @interface RunBatchParams
 * @property {string[]} inputs - Input file paths or glob patterns.
 * @property {string} [outputDir] - Directory to write outputs into (`--output-dir`); created when missing.
 * @property {string} [suffix] - Suffix appended to each output stem (default `_encodex_converted`).
 * @property {ConvertCliFlags} flags - Conversion flags shared by every job.
 * @property {string} transcoder - Raw `--transcoder` backend value.
 * @property {number} [concurrency] - Max parallel conversions (default {@link MAX_QUEUE_CONCURRENCY}).
 * @property {number} timeoutSeconds - Per-job timeout in seconds.
 * @property {CliThemeId} themeId - Theme used to color the progress bars.
 */
export interface RunBatchParams {
  inputs: string[];
  outputDir?: string;
  suffix?: string;
  flags: ConvertCliFlags;
  transcoder: string;
  concurrency?: number;
  timeoutSeconds: number;
  themeId: CliThemeId;
}

/**
 * Stream kinds the `demux` kind filters can select.
 * @typedef {'video'|'audio'|'subtitle'} DemuxKind
 */
export type DemuxKind = 'video' | 'audio' | 'subtitle';

/**
 * Flags accepted by the `demux` subcommand.
 * @interface DemuxCliFlags
 * @property {string} [outputDir] - Directory to write the extracted streams into (`--output-dir`); created when missing.
 * @property {boolean} [video] - Extract video streams (`--video`).
 * @property {boolean} [audio] - Extract audio streams (`--audio`).
 * @property {boolean} [subtitles] - Extract subtitle streams (`--subtitles`).
 * @property {boolean} [all] - Extract every kind (`--all`, the default).
 * @property {string} [videoContainer] - Re-encode video into this container (`--video-container`).
 * @property {string} [audioCodec] - Re-encode audio with this encoder (`--audio-codec`).
 * @property {string} [subtitleFormat] - Convert text subtitles to this format (`--subtitle-format`).
 * @property {string[]} [videoFilters] - Video filter chains (`--video-filters`, repeatable);
 *   only meaningful when the video stream is re-encoded.
 */
export interface DemuxCliFlags {
  outputDir?: string;
  video?: boolean;
  audio?: boolean;
  subtitles?: boolean;
  all?: boolean;
  videoContainer?: string;
  audioCodec?: string;
  subtitleFormat?: string;
  videoFilters?: string[];
}

/**
 * Parameters for a single `demux` run.
 * @interface RunDemuxParams
 * @property {string} input - Input media file.
 * @property {DemuxCliFlags} flags - Parsed demux flags.
 * @property {ITranscoder} transcoder - Transcoder backend.
 * @property {number} timeoutSeconds - Per-target conversion timeout in seconds.
 * @property {CliThemeId} themeId - Theme used to color the progress bar.
 */
export interface RunDemuxParams {
  input: string;
  flags: DemuxCliFlags;
  transcoder: ITranscoder;
  timeoutSeconds: number;
  themeId: CliThemeId;
}

/**
 * Global options that apply to every CLI subcommand. Values come from
 * `optsWithGlobals()` inside each subcommand action.
 * @interface GlobalCliOptions
 * @property {string} [transcoder] - Transcoder backend name ('FFMPEG' | 'FFTOOL' | 'BMF').
 * @property {string} [theme] - Logo color theme id.
 * @property {boolean} [verbose] - Enable verbose status output.
 * @property {boolean} [quiet] - Suppress non-error status output.
 * @property {boolean} [color] - Whether colors are enabled (from `--no-color`).
 * @property {boolean} [json] - Emit machine-readable JSON instead of tables.
 * @property {string} [timeout] - Conversion timeout in seconds.
 */
export interface GlobalCliOptions {
  transcoder?: string;
  theme?: string;
  verbose?: boolean;
  quiet?: boolean;
  color?: boolean;
  json?: boolean;
  timeout?: string;
}

/**
 * Kinds of ordered `--add-*` tokens the remux flags produce.
 * `setSync` tokens carry no input of their own; they shift the token that
 * precedes them.
 * @typedef {'subtitle'|'audio'|'setSync'} RemuxAddTokenKind
 */
export type RemuxAddTokenKind = 'subtitle' | 'audio' | 'setSync';

/**
 * One `--add-subtitle` / `--add-audio` / `--set-sync` occurrence, recorded in
 * command-line order so `--set-sync` can bind to the input that precedes it.
 * @interface RemuxAddToken
 * @property {RemuxAddTokenKind} kind - Which flag produced the token.
 * @property {string} value - Raw flag value.
 * @property {number} order - Zero-based command-line position.
 */
export interface RemuxAddToken {
  kind: RemuxAddTokenKind;
  value: string;
  order: number;
}

/**
 * Flags accepted by the `remux` subcommand.
 * @interface RemuxCliFlags
 * @property {string} [output] - Explicit output file (`-o, --output`).
 * @property {string} [format] - Target container (`-f, --format`); defaults to
 *   the output extension, then the input extension.
 * @property {string[]} [map] - Explicit `-map` specs (`--map`, repeatable).
 *   When absent every source stream is selected.
 * @property {RemuxAddToken[]} [addTokens] - Ordered `--add-*` / `--set-sync`
 *   occurrences (see {@link createRemuxAddCollector}).
 * @property {string} [thumbnail] - Cover-art image (`--thumbnail`).
 * @property {string} [chapters] - FFMETADATA chapters file (`--chapters`).
 * @property {boolean} [copyChapters] - Set false by `--no-chapters` to drop the
 *   source chapters instead of copying them.
 * @property {string} [subtitleCodec] - Default codec for added subtitles
 *   (`--subtitle-codec`); overrides the per-file `::codec` suffix.
 * @property {boolean} [subtitles] - Set false by `--no-subtitles` to drop
 *   source subtitle streams from the default selection.
 * @property {string} [audioSync] - Signed seconds to shift the primary file's
 *   audio (`--audio-sync`).
 * @property {string[]} [filters] - Video filter chains (`--filters`, repeatable).
 *   Filters require re-encoding, so a non-empty chain turns the stream copy into
 *   a re-encode.
 */
export interface RemuxCliFlags {
  output?: string;
  format?: string;
  map?: string[];
  addTokens?: RemuxAddToken[];
  thumbnail?: string;
  chapters?: string;
  copyChapters?: boolean;
  subtitleCodec?: string;
  subtitles?: boolean;
  audioSync?: string;
  filters?: string[];
}

/**
 * A built remux plan plus the resolved output path and the non-blocking
 * findings for the requested container.
 * @interface RemuxCliPlan
 * @property {ConversionOptions} options - Ready-to-run options.
 * @property {string} output - Output path (`-o` when given, else next to the input).
 * @property {string} container - Normalized target container extension.
 * @property {RemuxWarning[]} warnings - Non-blocking findings.
 */
export interface RemuxCliPlan {
  options: ConversionOptions;
  output: string;
  container: string;
  warnings: RemuxWarning[];
}

/**
 * Parameters for a single `remux` run.
 * @interface RunRemuxParams
 * @property {string} input - Primary input file.
 * @property {RemuxCliFlags} flags - Parsed remux flags.
 * @property {ITranscoder} transcoder - Transcoder backend.
 * @property {number} timeoutSeconds - Hard conversion timeout in seconds.
 * @property {CliThemeId} themeId - Theme used to color the progress bar.
 */
export interface RunRemuxParams {
  input: string;
  flags: RemuxCliFlags;
  transcoder: ITranscoder;
  timeoutSeconds: number;
  themeId: CliThemeId;
}

/**
 * Mutable output configuration shared across CLI subcommands. Set once argument
 * parsing completes.
 * @interface CliOutputConfig
 * @property {boolean} quiet - When true, suppress all non-error status output.
 * @property {boolean} verbose - When true, allow debug-level status output.
 * @property {boolean} machine - When true, status lines route to stderr so
 *   stdout stays reserved for data (JSON).
 */
export interface CliOutputConfig {
  quiet: boolean;
  verbose: boolean;
  machine: boolean;
}

/**
 * Theme-aware chalk accessors derived from the selected CLI theme palette.
 * @interface ThemeChalk
 * @property {(s: string) => string} primary - The theme's primary accent color.
 * @property {(s: string) => string} secondary - The theme's secondary accent color.
 */
export interface ThemeChalk {
  primary: (s: string) => string;
  secondary: (s: string) => string;
}

/**
 * Progress payload accepted by the bar update methods. Mirrors
 * {@link ConversionProgress} plus an optional batch label.
 * @interface BarPayload
 * @property {string} [label] - Batch job label shown before the bar.
 * @property {string} [time] - Current output timestamp.
 * @property {string} [speed] - Speed relative to realtime.
 * @property {number} [fps] - Encoding frames per second.
 * @property {string} [eta] - Estimated remaining seconds.
 * @property {string} [bitrate] - Current encoding bitrate.
 */
export interface BarPayload {
  label?: string;
  time?: string;
  speed?: string;
  fps?: number;
  eta?: string;
  bitrate?: string;
}

/**
 * Options controlling how an output file path is derived from an input path.
 * @typedef {Object} DeriveOutputOptions
 * @property {string} [outputDir] - Directory to place the output in. Defaults
 *   to the input's directory when omitted.
 * @property {string} [suffix] - Text appended to the file stem before the
 *   extension (e.g. `_converted`). Defaults to '' when omitted.
 * @property {string} [outputExt] - Extension (without dot) to give the output.
 *   When omitted the input extension is kept.
 * @property {boolean} [keepExt] - When false and `outputExt` is omitted, drop
 *   the input extension entirely instead of keeping it.
 */
export interface DeriveOutputOptions {
  outputDir?: string;
  suffix?: string;
  outputExt?: string;
  keepExt?: boolean;
}
