/**
 * @fileoverview Shared helpers for turning demux targets into conversion options.
 *
 * A demux target describes *what* to extract (which stream, stream-copied or
 * re-encoded); the FFmpeg invocation needs the matching `ConversionOptions`.
 * The direct demux runner and the mux queue's enqueue path both build the
 * options from the same helper, so a queued demux is invoked exactly like a
 * direct one.
 */

import type { ConversionOptions, DemuxTarget } from './types';

/**
 * Composes the `ConversionOptions` for a single demux target: stream-copy by
 * default, per-kind encoder when converting, `-vn`/`-an` guards so only the
 * mapped stream kind is written, and the video filter chain when the target
 * re-encodes video.
 * @param {DemuxTarget} target - The extraction target.
 * @returns {ConversionOptions} Ready-to-run conversion options.
 */
export function optionsForDemuxTarget(target: DemuxTarget): ConversionOptions {
  const opts: ConversionOptions = { copy: target.copy, map: [target.map] };
  if (target.kind === 'video') {
    opts.video = true;
    opts.audio = false;
    if (!target.copy && target.codec) opts.videoCodec = target.codec;
    if (target.videoFilters?.length) opts.videoFilters = target.videoFilters;
  } else if (target.kind === 'audio') {
    opts.video = false;
    opts.audio = true;
    if (!target.copy && target.codec) opts.audioCodec = target.codec;
    if (target.audioFilters?.length) opts.audioFilters = target.audioFilters;
  } else {
    opts.video = false;
    opts.audio = false;
    if (!target.copy && target.codec) opts.subtitleCodec = target.codec;
  }
  return opts;
}

/**
 * Builds the short label shown for a demux target in the queue.
 * @param {DemuxTarget} target - The extraction target.
 * @returns {string} A label such as `video:0`.
 */
export function demuxTargetLabel(target: DemuxTarget): string {
  return `${target.kind}:${target.index}`;
}
