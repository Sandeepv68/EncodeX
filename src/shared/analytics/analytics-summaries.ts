/**
 * @fileoverview Shared categorical analytics payload builders for the remux and
 * demux operations.
 *
 * The payloads are derived from an already-built plan/target list so every entry
 * point (Remux GUI store, Demux GUI store, and the `remux`/`demux` CLI
 * subcommands) reports identical numbers. Only categorical data is included -
 * no paths, file names, or stream identifiers.
 */

import type { DemuxTargetKind, DemuxAnalyticsSummary, RemuxAnalyticsContext, RemuxAnalyticsSummary } from './types';
import type { DemuxTarget } from '../types';
import { AUDIO_EXTENSIONS, SUBTITLE_EXTENSIONS } from '../file-extensions';
import type { ConversionOptions, RemuxInput } from '../types';

export type { DemuxAnalyticsSummary, RemuxAnalyticsContext, RemuxAnalyticsSummary } from './types';

/**
 * Lowercased extension of a path (without the dot), or an empty string when the
 * path has none. The last dot after the final separator wins, so directories
 * containing dots (`/media/v1.2/movie`) do not confuse the result.
 * @param {string} filePath - Path to inspect.
 * @returns {string} The lowercase extension, or ''.
 */
function extensionOf(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) return '';
  const separator = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return dot > separator ? filePath.slice(dot + 1).toLowerCase() : '';
}

/**
 * Counts the added inputs whose file extension is one of `extensions`, i.e. the
 * number of external subtitle or audio files the plan muxes in.
 * @param {RemuxInput[]} entries - Added inputs of a remux plan.
 * @param {readonly string[]} extensions - Extensions that identify the kind.
 * @returns {number} Number of matching added inputs.
 */
function countAddedByExtension(entries: RemuxInput[], extensions: readonly string[]): number {
  return entries.filter((entry) => extensions.includes(extensionOf(entry.path))).length;
}

/**
 * Derives the categorical remux summary from the conversion options of a built
 * remux plan: the target container, how many source streams are mapped, and
 * which kinds of auxiliary input (subtitles, audio, cover art, chapters) or
 * audio sync the plan adds.
 *
 * Added inputs are classified by file extension (`SUBTITLE_EXTENSIONS` /
 * `AUDIO_EXTENSIONS`); the re-read sync entry still counts towards
 * `hasAudioSync`.
 *
 * @param {ConversionOptions} options - Options of the built remux plan.
 * @param {RemuxAnalyticsContext} [context] - Target container and primary path.
 * @returns {RemuxAnalyticsSummary} Categorical summary for analytics payloads.
 */
export function remuxAnalyticsSummary(options: ConversionOptions, context: RemuxAnalyticsContext = {}): RemuxAnalyticsSummary {
  const all = options.additionalInputs ?? [];
  const added = context.input ? all.filter((entry) => entry.path !== context.input) : all;
  return {
    container: context.container ?? '',
    streamCount: options.map?.length ?? 0,
    addedSubs: countAddedByExtension(added, SUBTITLE_EXTENSIONS),
    addedAudio: countAddedByExtension(added, AUDIO_EXTENSIONS),
    hasThumbnail: added.some((entry) => entry.attachment === true || entry.disposition !== undefined),
    hasChapters: Boolean(options.chaptersFile) || options.copyChapters !== false,
    hasAudioSync: typeof options.audioSyncSeconds === 'number' || all.some((entry) => typeof entry.syncOffsetSeconds === 'number'),
  };
}

/**
 * Derives the categorical demux summary from a set of extraction targets:
 * per-kind stream counts, the target total, and the kinds that are re-encoded
 * rather than stream-copied.
 * @param {DemuxTarget[]} targets - The targets about to run (or that ran).
 * @returns {DemuxAnalyticsSummary} Categorical summary for analytics payloads.
 */
export function demuxAnalyticsSummary(targets: DemuxTarget[]): DemuxAnalyticsSummary {
  const kindCounts: Partial<Record<DemuxTargetKind, number>> = {};
  const convertedKinds: DemuxTargetKind[] = [];
  for (const target of targets) {
    kindCounts[target.kind] = (kindCounts[target.kind] ?? 0) + 1;
    if (!target.copy && !convertedKinds.includes(target.kind)) convertedKinds.push(target.kind);
  }
  return { kindCounts, streamCount: targets.length, convertedKinds };
}
