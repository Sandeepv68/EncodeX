/**
 * @fileoverview Shared remux plan builder. Translates a container + stream
 * selection + asset list into the exact `ConversionOptions` for a lossless
 * remux, and derives the output path. Pure and CLI-free so the Remux GUI, CLI,
 * and MCP all emit identical arguments (unit-tested once).
 */

import { withExtension } from './codec-containers';
import { isExtensionCompatibleWithVideoCodec } from './codec-containers';
import { isSubtitleCodecCompatibleWithContainer } from './codec-containers';
import { remuxWarnings } from './codec-containers';
import { ATTACHED_PIC_DISPOSITION } from './transcoder-constants';
import { createError, ErrorCode, ERROR_MESSAGES } from './errors';
import type { ConversionOptions, MediaStreamInfo, RemuxInput } from './types';

/**
 * Input the user composes for a remux: container + `-map` stream selection +
 * added assets. Maps and assets reference input indices exactly as documented
 * on `ConversionOptions` (primary = 0, additionalInputs = 1..N, chapters = N+1).
 *
 * @interface RemuxPlanInput
 * @property {string} input - Absolute path of the source file.
 * @property {string} container - Target container extension (e.g. 'mkv').
 * @property {string[]} [maps] - `-map` specs selecting streams for the output.
 * @property {RemuxInput[]} [additionalInputs] - Added subtitles/audio/cover
 *   entries as extra inputs.
 * @property {string} [chaptersFile] - FFMETADATA chapters file to import.
 * @property {boolean} [copyChapters] - Preserve source chapters via
 *   `-map_chapters 0`. Defaults to true.
 * @property {number} [audioSyncSeconds] - Signed seconds to shift the primary's
 *   audio relative to video via the "re-read" trick (positive = audio plays
 *   LATER). Absent = no adjustment.
 * @property {string[]} [videoFilters] - Ordered FFmpeg video filter
 *   expressions. Filters require re-encoding, so a non-empty chain flips
 *   `copy` to false and the whole plan runs as a re-encode.
 */
export interface RemuxPlanInput {
  input: string;
  container: string;
  maps?: string[];
  additionalInputs?: RemuxInput[];
  chaptersFile?: string;
  copyChapters?: boolean;
  audioSyncSeconds?: number;
  videoFilters?: string[];
}

/**
 * Result of {@link buildRemuxPlanOptions}.
 * @interface RemuxPlan
 * @property {ConversionOptions} options - Ready-to-run conversion options.
 * @property {string} output - Derived output path (same dir as input).
 */
export interface RemuxPlan {
  options: ConversionOptions;
  output: string;
}

/**
 * Primary audio `-map` specs selectors. A re-read sync entry pulls the primary's
 * audio tracks out of `map` and re-emits them against the new input.
 * @const {RegExp} PRIMARY_AUDIO_MAP
 */
const PRIMARY_AUDIO_MAP = /^0:a(?::|-)/;

/**
 * Builds the default `-map` selection for a remux from the probed source
 * streams: every stream in probe order as `0:<type initial>:<ordinal>`, with
 * the ordinal counted per type. Cover-art streams carrying the
 * `attached_pic` disposition are skipped because they are re-added through a
 * thumbnail input instead of the primary selection.
 *
 * Shared by the Remux GUI, the CLI, and MCP so all three remux the same default
 * stream set.
 *
 * @param {MediaStreamInfo[]} streams - Probed source streams.
 * @param {boolean} [includeSubtitles] - Set false to drop subtitle streams
 *   (the CLI `--no-subtitles` behavior). Defaults to true.
 * @returns {string[]} Ordered `-map` specs for the primary input.
 */
export function buildPrimaryStreamMaps(streams: MediaStreamInfo[], includeSubtitles = true): string[] {
  const ordinals: Record<string, number> = { video: 0, audio: 0, subtitle: 0 };
  const maps: string[] = [];
  for (const stream of streams) {
    if (stream.disposition?.includes(ATTACHED_PIC_DISPOSITION)) continue;
    if (stream.type === 'subtitle' && !includeSubtitles) continue;
    maps.push(`0:${stream.type[0]}:${ordinals[stream.type]++}`);
  }
  return maps;
}

/**
 * Builds the remux `ConversionOptions` (and output path) for a target container.
 * Enforces copy mode, sets stream selection `-map` specs, yields the chapters
 * flags, and applies the lossless audio-sync trick when `audioSyncSeconds` is
 * set (primary audio re-read is appended LAST so its input index is fixed).
 *
 * A non-empty `videoFilters` chain flips `copy` to false: filters can only be
 * applied while re-encoding, so the plan runs as a re-encode and the emitted
 * chain joins the single `-vf` slot built by the transcoder.
 *
 * Hard incompatibilities (a source video codec the container cannot hold, a
 * selected added stream the container cannot store) raise `INCOMPATIBLE_CONTAINER`.
 *
 * `-c:a copy` is added to `extraArgs` whenever the audio re-read is used so the
 * shifted audio stays stream-copied even though the blanket `-c copy` is
 * keyed to the per-input overrides.
 *
 * @param {RemuxPlanInput} plan - The composed remux request.
 * @returns {RemuxPlan} Ready-to-run options and derived output path.
 * @throws {Error} When the target container cannot hold a required stream.
 */
export function buildRemuxPlan(plan: RemuxPlanInput): RemuxPlan {
  const container = plan.container.toLowerCase().replace(/^\./, '');
  const extraArgs: string[] = [];

  const audioSync = plan.audioSyncSeconds !== undefined && plan.audioSyncSeconds !== null;
  const audioSpecs = (plan.maps ?? []).filter((spec) => PRIMARY_AUDIO_MAP.test(spec.trim()));

  let maps = (plan.maps ?? []).map((spec) => spec.trim()).filter((spec) => spec && !(audioSync && PRIMARY_AUDIO_MAP.test(spec)));
  const additionalInputs: RemuxInput[] = [...(plan.additionalInputs ?? [])];

  if (audioSync && audioSpecs.length > 0) {
    const reReadIndex = countInputs(additionalInputs) + 1;
    additionalInputs.push({
      path: plan.input,
      map: audioSpecs.map((spec) => `${reReadIndex}${spec.trim().slice(1)}`),
      syncOffsetSeconds: plan.audioSyncSeconds,
    });
    extraArgs.push('-c:a', 'copy');
  }

  const videoFilters = plan.videoFilters ?? [];
  const options: ConversionOptions = {
    copy: videoFilters.length === 0,
    map: maps,
    additionalInputs,
    extraArgs,
  };
  if (videoFilters.length > 0) {
    options.videoFilters = [...videoFilters];
  }

  if (plan.chaptersFile) {
    options.chaptersFile = plan.chaptersFile;
  } else if (plan.copyChapters === false) {
    options.copyChapters = false;
  } else {
    options.copyChapters = true;
  }

  const output = withExtension(plan.input, container);
  return { options, output };
}

/**
 * Validates a remux plan against the probed source streams, rejecting with
 * `INCOMPATIBLE_CONTAINER` when a required stream cannot be stored, and
 * returns the non-blocking `remuxWarnings` alongside options/output for the
 * GUI/CLI/MCP to display.
 *
 * @param {RemuxPlanInput} plan - The composed remux request.
 * @param {MediaStreamInfo[]} inputs - Probed source streams.
 * @returns {RemuxPlan & { warnings: ReturnType<typeof remuxWarnings> }}
 * @throws {Error} `INCOMPATIBLE_CONTAINER` on hard incompatibilities.
 */
export function buildAndValidateRemuxPlan(plan: RemuxPlanInput, inputs: MediaStreamInfo[]) {
  const container = plan.container.toLowerCase().replace(/^\./, '');
  const selected = new Set(plan.maps ?? []);
  const head = buildRemuxPlan(plan);

  const ordinals: Record<string, number> = { video: 0, audio: 0, subtitle: 0 };
  for (const stream of inputs) {
    const mapSpec = `0:${stream.type[0]}:${ordinals[stream.type]++}`;
    if (!selected.has(mapSpec)) continue;

    if (stream.type === 'video' && !isExtensionCompatibleWithVideoCodec(container, stream.codec)) {
      throw createError(
        ErrorCode.INCOMPATIBLE_CONTAINER,
        ERROR_MESSAGES[ErrorCode.INCOMPATIBLE_CONTAINER],
        `${container} cannot hold video codec ${stream.codec}`,
      );
    }
    if (stream.type === 'subtitle' && !isSubtitleCodecCompatibleWithContainer(stream.codec, container)) {
      throw createError(
        ErrorCode.INCOMPATIBLE_CONTAINER,
        ERROR_MESSAGES[ErrorCode.INCOMPATIBLE_CONTAINER],
        `${container} cannot store subtitle codec ${stream.codec}`,
      );
    }
  }

  const warnings = remuxWarnings(inputs, plan.additionalInputs, plan.chaptersFile, container, plan.videoFilters);
  return { ...head, warnings };
}

/**
 * Counts the extra `-i` inputs an `additionalInputs` list will add, so a re-read
 * sync entry can compute its own input index. Cover-art attachments (MKV/WebM
 * `-attach`) do NOT consume an input index; everything else does.
 * @param {RemuxInput[]} entries - The additional-input list.
 * @returns {number} The index the next input will receive.
 */
function countInputs(entries: RemuxInput[]): number {
  return entries.filter((entry) => !entry.attachment).length;
}
