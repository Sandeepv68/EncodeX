/**
 * @fileoverview Implementation of the `remux` CLI subcommand.
 *
 * Composes the same plan the Remux GUI builds: a target container, a `-map`
 * stream selection (defaulting to every source stream), added
 * subtitle/audio/cover inputs, an optional FFMETADATA chapters file, and the
 * lossless audio-sync shift. The plan goes through the shared
 * {@link buildAndValidateRemuxPlan} so hard incompatibilities (a codec the
 * container cannot hold) are rejected before FFmpeg runs, while the remaining
 * `remuxWarnings` findings are printed and the remux proceeds.
 *
 * `--filters` is the one escape from the lossless copy: an FFmpeg video filter
 * chain cannot be applied to stream-copied streams, so passing it re-encodes the
 * selected streams (reported as the `filters_force_reencode` finding).
 *
 * Exit codes follow the CLI contract: usage (2) for invalid flags, hard
 * incompatibilities, and unsupported cover containers; not-found (4) for a
 * missing primary or auxiliary input.
 *
 * The run reports the shared `remux_started`/`remux_completed`/`remux_failed`
 * analytics events, built from the same categorical summary the Remux GUI
 * store uses (cancellations stay silent).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ITranscoder } from '../transcoders/types';
import type { ConversionOptions, MediaStreamInfo, RemuxInput } from '../../shared/types';
import { isContainerCompatibleWithCover, isContainerCompatibleWithChapters, type RemuxWarning } from '../../shared/codec-containers';
import { ATTACHED_PIC_DISPOSITION, SUBTITLE_CODEC_CONTAINERS } from '../../shared/transcoder-constants';
import { buildAndValidateRemuxPlan, buildPrimaryStreamMaps } from '../../shared/remux-utils';
import { remuxAnalyticsSummary } from '../../shared/analytics/analytics-summaries';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import { CLI_EXIT_NOT_FOUND, CLI_EXIT_USAGE } from '../../shared/constants';
import { isAppError, ErrorCode } from '../../shared/errors';
import { runPreparedConversion, resolveCliVideoFilterChain } from './cli-convert';
import { getInputExtension } from './cli-util';
import { CliExitError } from './cli-options';
import { status, warn } from './cli-ui';
import type { CliThemeId } from '../cli-logo';

/**
 * Separator between an added subtitle path and its per-file codec in
 * `--add-subtitle <file[::subcodec]>`. Split on the LAST occurrence so Windows
 * drive letters (`C:\...`) are never mistaken for the separator.
 * @const {string} SUBTITLE_CODEC_SEPARATOR
 */
const SUBTITLE_CODEC_SEPARATOR = '::';

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
 * Creates the Commander coercion factory for the three order-sensitive
 * `--add-*` / `--set-sync` flags. Each occurrence is pushed onto one shared
 * list, preserving command-line order across the three options.
 * @returns {{ collect: (kind: RemuxAddTokenKind) => (value: string) => string, tokens: () => RemuxAddToken[] }} Collector.
 */
export function createRemuxAddCollector(): {
  collect: (kind: RemuxAddTokenKind) => (value: string) => string;
  tokens: () => RemuxAddToken[];
} {
  const tokens: RemuxAddToken[] = [];
  return {
    collect: (kind: RemuxAddTokenKind) => (value: string) => {
      tokens.push({ kind, value, order: tokens.length });
      return value;
    },
    tokens: () => tokens,
  };
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
 * Resolves the target container: `-f/--format` wins, then the output
 * extension, then the input extension.
 * @param {string} input - Input file path.
 * @param {RemuxCliFlags} flags - Parsed remux flags.
 * @returns {string} Normalized container extension (no dot, lowercase).
 * @throws {CliExitError} When no container can be determined (usage exit code).
 */
export function resolveRemuxContainer(input: string, flags: RemuxCliFlags): string {
  const container = (flags.format ?? (flags.output ? getInputExtension(flags.output) : '') ?? '').trim() || getInputExtension(input);
  const normalized = container.toLowerCase().replace(/^\./, '');
  if (!normalized) {
    throw new CliExitError('remux requires a target container (-f/--format, or an input file with a known extension)', CLI_EXIT_USAGE);
  }
  return normalized;
}

/**
 * Parses a signed seconds value for `--audio-sync` / `--set-sync`.
 * @param {string} value - Raw flag value.
 * @param {string} flag - Flag name used in the error message.
 * @returns {number} The parsed seconds.
 * @throws {CliExitError} When the value is not a finite number (usage exit).
 */
export function parseSyncSeconds(value: string, flag: string): number {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    throw new CliExitError(`${flag} expects a number of seconds, got: ${value}`, CLI_EXIT_USAGE);
  }
  return seconds;
}

/**
 * Splits a `--add-subtitle` value into its file and optional per-file codec.
 * @param {string} value - Raw flag value (`file` or `file::codec`).
 * @returns {{ file: string, codec?: string }} Parsed value.
 * @throws {CliExitError} When the path is empty or the codec part is empty
 *   (usage exit code).
 */
export function parseAddedSubtitle(value: string): { file: string; codec?: string } {
  const index = value.lastIndexOf(SUBTITLE_CODEC_SEPARATOR);
  if (index < 0) return { file: value };
  const file = value.slice(0, index);
  const codec = value.slice(index + SUBTITLE_CODEC_SEPARATOR.length);
  if (!file) throw new CliExitError(`--add-subtitle is missing a file path: ${value}`, CLI_EXIT_USAGE);
  if (!codec) throw new CliExitError(`--add-subtitle ${value} has an empty codec after "${SUBTITLE_CODEC_SEPARATOR}"`, CLI_EXIT_USAGE);
  return { file, codec };
}

/**
 * The default subtitle codec for a container (the first entry of
 * `SUBTITLE_CODEC_CONTAINERS`), mirroring the Remux GUI's picker default.
 * @param {string} container - Normalized container extension.
 * @returns {string} The container's default subtitle codec, or 'subrip'.
 */
export function defaultSubtitleCodec(container: string): string {
  return SUBTITLE_CODEC_CONTAINERS[container]?.[0] ?? 'subrip';
}

/**
 * Builds the ordered extra-input list from the recorded `--add-*` tokens.
 *
 * Added inputs consume input indices `1..N` in command-line order (the
 * `-i` accounting `buildFfmpegArgs` performs), so the `map` spec of each entry
 * is emitted with its own index. `--set-sync` shifts the entry that precedes
 * it via `syncOffsetSeconds` (`-itsoffset`).
 *
 * @param {RemuxAddToken[]} tokens - Ordered tokens from {@link createRemuxAddCollector}.
 * @param {string} container - Normalized target container extension.
 * @param {string} [subtitleCodec] - Default codec for added subtitles.
 * @returns {RemuxInput[]} Extra inputs in command-line order.
 * @throws {CliExitError} When `--set-sync` has no preceding add input, or a
 *   subtitle value is malformed (usage exit code).
 */
export function buildAddedInputs(tokens: RemuxAddToken[], container: string, subtitleCodec?: string): RemuxInput[] {
  const ordered = [...tokens].sort((a, b) => a.order - b.order);
  const entries: RemuxInput[] = [];
  let nextInputIndex = 1;

  for (const token of ordered) {
    if (token.kind === 'setSync') {
      const target = entries[entries.length - 1];
      if (!target) {
        throw new CliExitError('--set-sync must follow an --add-subtitle or --add-audio input', CLI_EXIT_USAGE);
      }
      target.syncOffsetSeconds = parseSyncSeconds(token.value, '--set-sync');
      continue;
    }
    if (token.kind === 'audio') {
      entries.push({ path: token.value, map: [`${nextInputIndex}:0`], codec: 'copy' });
      nextInputIndex += 1;
      continue;
    }
    const { file, codec } = parseAddedSubtitle(token.value);
    entries.push({ path: file, map: [`${nextInputIndex}:0`], codec: subtitleCodec ?? codec ?? defaultSubtitleCodec(container) });
    nextInputIndex += 1;
  }

  return entries;
}

/**
 * Builds the thumbnail (cover-art) extra input for a container: MKV/WebM
 * attach the picture with `-attach` (no `-i`, so no input index), while
 * MP4/MOV map it as an extra video stream carrying the `attached_pic`
 * disposition.
 * @param {string} image - Cover-art image path.
 * @param {string} container - Normalized target container extension.
 * @param {number} inputIndex - Next free input index.
 * @returns {RemuxInput} The thumbnail entry.
 * @throws {CliExitError} When the container cannot store cover art (usage exit).
 */
export function buildThumbnailInput(image: string, container: string, inputIndex: number): RemuxInput {
  if (container === 'mkv' || container === 'webm') {
    return { path: image, map: [], attachment: true };
  }
  if (!isContainerCompatibleWithCover(container)) {
    throw new CliExitError(`Container ${container} cannot store cover art (use mkv, webm, mp4, or mov)`, CLI_EXIT_USAGE);
  }
  return { path: image, map: [`${inputIndex}:0`], disposition: ATTACHED_PIC_DISPOSITION };
}

/**
 * Builds the `-map` selection: the explicit `--map` specs when given, else
 * every source stream (minus subtitles under `--no-subtitles`).
 * @param {MediaStreamInfo[]} streams - Probed source streams.
 * @param {RemuxCliFlags} flags - Parsed remux flags.
 * @returns {string[]} `-map` specs for the primary input.
 */
export function resolveRemuxMaps(streams: MediaStreamInfo[], flags: RemuxCliFlags): string[] {
  const explicit = (flags.map ?? []).map((spec) => spec.trim()).filter(Boolean);
  if (explicit.length > 0) return explicit;
  return buildPrimaryStreamMaps(streams, flags.subtitles !== false);
}

/**
 * Builds the full remux plan from CLI flags, resolving the container, stream
 * selection, extra inputs, chapters handling, and the video filter chain, then
 * validating it against the probed source streams.
 *
 * A non-empty `--filters` chain is resolved (comma-split, `preset.value`
 * shorthand expanded, validated) and handed to the shared planner, which turns
 * the lossless copy into a re-encode. There is no `--copy` flag on `remux`, so
 * no conflict to reject.
 *
 * @param {string} input - Primary input file.
 * @param {RemuxCliFlags} flags - Parsed remux flags.
 * @param {MediaStreamInfo[]} streams - Probed source streams.
 * @returns {RemuxCliPlan} Options, output path, container, and warnings.
 * @throws {CliExitError} On usage errors (bad flags, an invalid filter chain,
 *   unsupported cover container, chapters file for a container that drops them).
 * @throws {Error} `INCOMPATIBLE_CONTAINER` when a selected stream cannot be
 *   stored in the target container.
 */
export function buildRemuxCliPlan(input: string, flags: RemuxCliFlags, streams: MediaStreamInfo[]): RemuxCliPlan {
  const container = resolveRemuxContainer(input, flags);
  const maps = resolveRemuxMaps(streams, flags);

  if (flags.subtitles === false && (flags.map ?? []).length > 0) {
    status('--no-subtitles is ignored because --map selects streams explicitly.');
  }

  const videoFilters = resolveCliVideoFilterChain(flags.filters);
  if (videoFilters.length > 0 && !maps.some((spec) => /^0:v(?::|-)/.test(spec))) {
    warn('--filters has no effect: no video stream is selected.');
  }

  const additionalInputs = buildAddedInputs(flags.addTokens ?? [], container, flags.subtitleCodec);

  if (flags.thumbnail) {
    const inputIndex = 1 + additionalInputs.filter((entry) => !entry.attachment).length;
    additionalInputs.push(buildThumbnailInput(flags.thumbnail, container, inputIndex));
  }

  const chaptersFile = flags.chapters;
  if (chaptersFile && !isContainerCompatibleWithChapters(container)) {
    throw new CliExitError(`Container ${container} does not store chapters (use mp4, mov, or mkv)`, CLI_EXIT_USAGE);
  }

  const audioSyncSeconds = flags.audioSync === undefined ? undefined : parseSyncSeconds(flags.audioSync, '--audio-sync');
  if (audioSyncSeconds !== undefined && !maps.some((spec) => /^0:a(?::|-)/.test(spec))) {
    warn('--audio-sync has no effect: no primary audio stream is selected.');
  }

  const plan = buildAndValidateRemuxPlan(
    { input, container, maps, additionalInputs, chaptersFile, copyChapters: flags.copyChapters, audioSyncSeconds, videoFilters },
    streams,
  );

  return { ...plan, output: flags.output ?? plan.output, container };
}

/**
 * Verifies that every file the remux will read exists, so a missing subtitle,
 * audio, cover, or chapters file fails fast with the not-found exit code
 * instead of an FFmpeg error.
 * @param {string} input - Primary input file.
 * @param {RemuxCliFlags} flags - Parsed remux flags.
 * @throws {CliExitError} With the not-found exit code for a missing file.
 */
function assertAuxiliaryInputsExist(input: string, flags: RemuxCliFlags): void {
  const auxiliaries: string[] = [
    ...(flags.addTokens ?? []).filter((token) => token.kind === 'subtitle').map((token) => parseAddedSubtitle(token.value).file),
    ...(flags.addTokens ?? []).filter((token) => token.kind === 'audio').map((token) => token.value),
    ...(flags.thumbnail ? [flags.thumbnail] : []),
    ...(flags.chapters ? [flags.chapters] : []),
  ];
  for (const file of [input, ...auxiliaries]) {
    if (!fs.existsSync(file)) {
      throw new CliExitError(`Input file not found: ${file}`, CLI_EXIT_NOT_FOUND);
    }
  }
}

/**
 * Runs the `remux` subcommand: probes the source, builds and validates the
 * remux plan, prints any non-blocking findings, and stream-copies into the
 * target container.
 *
 * @param {RunRemuxParams} params - Remux parameters.
 * @returns {Promise<void>} Resolves when the remux completes.
 * @throws {CliExitError} On usage errors, hard incompatibilities (usage exit),
 *   or a missing input/auxiliary file (not-found exit).
 */
export async function runRemux(params: RunRemuxParams): Promise<void> {
  const { input, flags, transcoder, timeoutSeconds, themeId } = params;

  assertAuxiliaryInputsExist(input, flags);

  const info = await transcoder.getInfo(input);
  const streams = info.streams ?? [];

  let plan: RemuxCliPlan;
  try {
    plan = buildRemuxCliPlan(input, flags, streams);
  } catch (err) {
    if (isAppError(err) && err.code === ErrorCode.INCOMPATIBLE_CONTAINER) {
      throw new CliExitError(err.message, CLI_EXIT_USAGE);
    }
    throw err;
  }

  for (const finding of plan.warnings) {
    warn(finding.message);
  }
  const hard = plan.warnings.filter((finding) => finding.icon === 'error');
  if (hard.length > 0) {
    throw new CliExitError(hard[0].message, CLI_EXIT_USAGE);
  }

  const summary = remuxAnalyticsSummary(plan.options, { container: plan.container, input });
  recordAnalyticsEvent(createAnalyticsEvent('remux_started', summary));
  const startedAt = Date.now();
  try {
    await runPreparedConversion({
      input,
      output: plan.output,
      options: plan.options,
      transcoder,
      timeoutSeconds,
      themeId,
      successText: `Remuxed ${path.basename(input)} → ${plan.output}`,
    });
  } catch (err) {
    if (!isAppError(err) || err.code !== ErrorCode.CANCELLED) {
      recordAnalyticsEvent(
        createAnalyticsEvent('remux_failed', { container: plan.container, code: isAppError(err) ? err.code : undefined }),
      );
    }
    throw err;
  }
  recordAnalyticsEvent(
    createAnalyticsEvent('remux_completed', {
      ...summary,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
    }),
  );
}
