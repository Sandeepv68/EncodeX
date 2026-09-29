/**
 * @fileoverview Implementation of the `demux` CLI subcommand.
 *
 * Splits a media file into per-stream outputs: probes the source, keeps the
 * streams of the requested kinds, builds the extraction targets with the shared
 * {@link buildDemuxTargets} (so the CLI, GUI, and MCP name and configure the
 * outputs identically), and runs them one after another through the transcoder.
 *
 * Per-kind conversions come from {@link DemuxMediaPreferences}:
 * `--video-container` re-encodes video when the requested container differs from
 * the stream's native format, `--audio-codec` re-encodes audio, and
 * `--subtitle-format` converts text subtitles (bitmap subtitles stay
 * stream-copied into `.mks` with a warning). `--video-filters` adds an FFmpeg
 * filter chain to the re-encoded video target; because filters need an actual
 * re-encode, combining them with a stream-copied video target is rejected as a
 * usage error (the GUI reports the same situation as a warning instead).
 *
 * The run reports the shared `demux_started`/`demux_completed`/`demux_failed`
 * analytics events, built from the same categorical summary the Demux GUI
 * store uses (cancellations stay silent).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ITranscoder } from '../transcoders/types';
import type { ConversionOptions, MediaStreamInfo } from '../../shared/types';
import {
  buildDemuxTargets,
  demuxWarnings,
  type DemuxMediaPreferences,
  type DemuxTarget,
  type RemuxWarning,
} from '../../shared/codec-containers';
import { ATTACHED_PIC_DISPOSITION } from '../../shared/transcoder-constants';
import { demuxAnalyticsSummary } from '../../shared/analytics/analytics-summaries';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import { createError, isAppError, ErrorCode, ERROR_MESSAGES } from '../../shared/errors';
import { CLI_EXIT_USAGE } from '../../shared/constants';
import { runPreparedConversion, resolveCliVideoFilterChain } from './cli-convert';
import { CliExitError } from './cli-options';
import { status, success, warn } from './cli-ui';
import type { CliThemeId } from '../cli-logo';

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
 * The input file's stem (name without extension), used as the output basename.
 * @param {string} file - File path.
 * @returns {string} The basename without its extension.
 */
export function inputStem(file: string): string {
  return path.basename(file, path.extname(file));
}

/**
 * Resolves the requested stream kinds: `--all` (or no kind flag at all) selects
 * every kind, otherwise the kinds named by `--video`/`--audio`/`--subtitles`.
 * @param {DemuxCliFlags} flags - Parsed demux flags.
 * @returns {DemuxKind[]} Ordered kinds to extract.
 * @throws {CliExitError} When kind flags request nothing (usage exit code).
 */
export function resolveDemuxKinds(flags: DemuxCliFlags): DemuxKind[] {
  const kinds: DemuxKind[] = [];
  if (flags.video) kinds.push('video');
  if (flags.audio) kinds.push('audio');
  if (flags.subtitles) kinds.push('subtitle');
  if (kinds.length > 0 && !flags.all) return kinds;
  return ['video', 'audio', 'subtitle'];
}

/**
 * Converts the CLI conversion flags into {@link DemuxMediaPreferences}.
 *
 * `copy` (and an empty value) means "keep the stream as-is" for every kind, so
 * it is dropped instead of being forwarded as an encoder name. `--video-filters`
 * is resolved (comma-split, shorthand-expanded, validated) and forwarded as the
 * per-kind filter chain.
 *
 * @param {DemuxCliFlags} flags - Parsed demux flags.
 * @returns {DemuxMediaPreferences} Per-kind conversion preferences.
 * @throws {CliExitError} When `--video-filters` holds an invalid entry (usage exit).
 */
export function demuxMediaPreferences(flags: DemuxCliFlags): DemuxMediaPreferences {
  const media: DemuxMediaPreferences = {};
  const container = (flags.videoContainer ?? '').trim().replace(/^\./, '').toLowerCase();
  if (container && container !== 'copy') media.videoContainer = container;
  const audioCodec = (flags.audioCodec ?? '').trim().toLowerCase();
  if (audioCodec && audioCodec !== 'copy') media.audioCodec = audioCodec;
  const subtitleFormat = (flags.subtitleFormat ?? '').trim().toLowerCase();
  if (subtitleFormat && subtitleFormat !== 'copy') media.subtitleCodec = subtitleFormat;
  const videoFilters = resolveCliVideoFilterChain(flags.videoFilters);
  if (videoFilters.length > 0) media.videoFilters = videoFilters;
  return media;
}

/**
 * Keeps the source streams that can be extracted: those of the requested kinds,
 * minus cover-art video streams (re-embedded via remux, not extracted here).
 * @param {MediaStreamInfo[]} streams - Probed source streams.
 * @param {DemuxKind[]} kinds - Requested kinds.
 * @returns {MediaStreamInfo[]} Streams to extract, in probe order.
 */
export function selectDemuxStreams(streams: MediaStreamInfo[], kinds: DemuxKind[]): MediaStreamInfo[] {
  const wanted = new Set(kinds);
  return streams.filter((stream) => wanted.has(stream.type) && !stream.disposition?.includes(ATTACHED_PIC_DISPOSITION));
}

/**
 * Builds the per-stream extraction targets for the requested kinds, resolving
 * each target's output into `outputDir` when one was given and next to the
 * input file otherwise.
 * @param {string} input - Input media file.
 * @param {MediaStreamInfo[]} streams - Probed source streams.
 * @param {DemuxCliFlags} flags - Parsed demux flags.
 * @returns {{ targets: DemuxTarget[], warnings: RemuxWarning[], streams: MediaStreamInfo[] }} Targets, warnings, and the selected streams.
 * @throws {CliExitError} When no stream of the requested kinds exists, or when
 *   `--video-filters` is combined with a video stream that stays a stream copy
 *   (filters require re-encoding) — both usage errors.
 */
export function buildDemuxCliTargets(
  input: string,
  streams: MediaStreamInfo[],
  flags: DemuxCliFlags,
): { targets: DemuxTarget[]; warnings: RemuxWarning[]; streams: MediaStreamInfo[] } {
  const selected = selectDemuxStreams(streams, resolveDemuxKinds(flags));
  if (selected.length === 0) {
    throw new CliExitError(`No ${resolveDemuxKinds(flags).join('/')} streams found in ${path.basename(input)}`, CLI_EXIT_USAGE);
  }
  const media = demuxMediaPreferences(flags);
  const outputDir = flags.outputDir ?? path.dirname(input);
  const targets = buildDemuxTargets(input, inputStem(input), selected, media).map((target) => ({
    ...target,
    output: path.join(outputDir, target.output),
  }));
  if (media.videoFilters?.length && !targets.some((target) => target.kind === 'video' && !target.copy)) {
    throw new CliExitError(
      `${ERROR_MESSAGES[ErrorCode.FILTERS_REQUIRE_RE_ENCODE]} (--video-filters needs a --video-container that re-encodes the video stream)`,
      CLI_EXIT_USAGE,
    );
  }
  return { targets, warnings: demuxWarnings(selected, media), streams: selected };
}

/**
 * Composes the `ConversionOptions` for one extraction target: the single
 * `-map` spec, `-vn`/`-an` guards so only the mapped kind is written, the
 * per-kind encoder as a raw `-c:<kind> <codec>` override when the target is not
 * a stream copy, and the video filter chain on a re-encoded video target.
 * @param {DemuxTarget} target - The extraction target.
 * @returns {ConversionOptions} Ready-to-run conversion options.
 */
export function demuxTargetOptions(target: DemuxTarget): ConversionOptions {
  const options: ConversionOptions = { copy: target.copy, map: [target.map] };
  if (target.kind === 'video') {
    options.video = true;
    options.audio = false;
    if (target.videoFilters?.length) options.videoFilters = target.videoFilters;
  } else if (target.kind === 'audio') {
    options.video = false;
    options.audio = true;
  } else {
    options.video = false;
    options.audio = false;
  }
  if (!target.copy && target.codec) {
    options.extraArgs = [`-c:${target.kind[0]}`, target.codec];
  }
  return options;
}

/**
 * Runs the `demux` subcommand: probes the source, builds the extraction
 * targets, prints the non-blocking findings, and converts each target
 * sequentially, printing the path it wrote.
 * @param {RunDemuxParams} params - Demux parameters.
 * @returns {Promise<void>} Resolves when every target is written.
 * @throws {CliExitError} On usage errors or a per-target timeout.
 * @throws {AppError} When the input file does not exist.
 */
export async function runDemux(params: RunDemuxParams): Promise<void> {
  const { input, flags, transcoder, timeoutSeconds, themeId } = params;

  if (!fs.existsSync(input)) {
    throw createError(ErrorCode.FILE_NOT_FOUND, `Input file not found: ${input}`);
  }

  if (flags.outputDir) {
    fs.mkdirSync(flags.outputDir, { recursive: true });
  }

  const info = await transcoder.getInfo(input);
  const { targets, warnings } = buildDemuxCliTargets(input, info.streams ?? [], flags);

  for (const finding of warnings) {
    warn(finding.message);
  }

  status(`Demux: ${targets.length} stream${targets.length === 1 ? '' : 's'} from ${path.basename(input)}`);

  const summary = demuxAnalyticsSummary(targets);
  recordAnalyticsEvent(createAnalyticsEvent('demux_started', summary));
  const startedAt = Date.now();
  try {
    for (const target of targets) {
      await runPreparedConversion({
        input,
        output: target.output,
        options: demuxTargetOptions(target),
        transcoder,
        timeoutSeconds,
        themeId,
        successText: `Extracted ${target.kind} stream → ${target.output}`,
      });
    }
  } catch (err) {
    if (!isAppError(err) || err.code !== ErrorCode.CANCELLED) {
      recordAnalyticsEvent(createAnalyticsEvent('demux_failed', { ...summary, code: isAppError(err) ? err.code : undefined }));
    }
    throw err;
  }

  recordAnalyticsEvent(
    createAnalyticsEvent('demux_completed', {
      ...summary,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
    }),
  );
  success(`Demuxed ${targets.length} stream${targets.length === 1 ? '' : 's'} from ${path.basename(input)}`);
}
