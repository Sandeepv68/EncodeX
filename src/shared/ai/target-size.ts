/**
 * @fileoverview Deterministic target-size candidate planner (roadmap F3).
 *
 * Produces an ordered ladder of candidate video bitrates for a hard output-size
 * ceiling. This is arithmetic over the target bytes, audio budget and probed
 * duration — never a model call (roadmap §7.3) — and every result is labelled
 * `isEstimated: true` (D4): the candidate that actually fits is only known once
 * the encode is measured and the output re-probed.
 *
 * The ladder is ordered from the most optimistic (highest bitrate, best
 * quality) down to a conservative floor, so a caller that encodes each candidate
 * in turn and stops at the first measured fit gets the highest quality that
 * still honours the ceiling.
 */

import type { MediaFacts, TargetSizeCandidate, TargetSizeOptions, TargetSizePlan } from './types';

export type { TargetSizeCandidate, TargetSizeOptions, TargetSizePlan };

/** Fallback audio bitrate (kbps) when none is supplied. @const {number} */
const DEFAULT_AUDIO_KBPS = 128;

/** Lowest video bitrate a candidate may request. @const {number} */
const DEFAULT_VIDEO_FLOOR_KBPS = 150;

/** Highest video bitrate a candidate may request. @const {number} */
const DEFAULT_VIDEO_CEILING_KBPS = 25000;

/** Upper bound on candidates so the measured loop stays bounded. @const {number} */
const MAX_CANDIDATES = 5;

/**
 * Multiplier ladders per bias, ordered most-optimistic first. The rung at `1`
 * is always the size-derived baseline.
 * @const {Record<'quality'|'balanced'|'size', number[]>}
 */
const LADDERS: Record<'quality' | 'balanced' | 'size', number[]> = {
  quality: [1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6],
  balanced: [1.15, 1.0, 0.85, 0.7, 0.55, 0.45, 0.35],
  size: [1.0, 0.85, 0.7, 0.55, 0.45, 0.35, 0.25],
};

/**
 * Clamps a value into an inclusive range, tolerating a reversed range.
 * @param {number} value - The value to clamp.
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 * @returns {number} The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.min(Math.max(value, low), high);
}

/**
 * Explains one rung of the ladder from its position relative to the baseline.
 * @param {number} multiplier - The ladder multiplier (1 = baseline).
 * @returns {string} A one-line rationale.
 */
function rationaleFor(multiplier: number): string {
  if (multiplier > 1) return 'Optimistic bitrate: the best quality that may still fit once measured.';
  if (multiplier === 1) return 'Size-derived bitrate: the estimate that should land at the ceiling.';
  return 'Safety margin: a lower bitrate that trades quality for a smaller measured output.';
}

/**
 * Plans an ordered ladder of candidate video bitrates for a size ceiling.
 *
 * The 100% baseline is `(targetBytes * 8 / seconds) - audioKbps`. Each bias
 * walks a fixed multiplier ladder around that baseline, clamped to the floor and
 * ceiling and de-duplicated, then truncated to `maxCandidates`. An unmeasurable
 * source (no video stream, or an unknown duration) yields an empty candidate
 * list with an explanatory note rather than a guess.
 * @param {MediaFacts} facts - The probed source facts.
 * @param {number} maxBytes - The hard output-size ceiling in bytes.
 * @param {TargetSizeOptions} [options] - Optional tuning.
 * @returns {TargetSizePlan} The ordered, labelled candidate plan.
 * @example
 * planTargetSizeCandidates(facts, 100 * 1024 * 1024).candidates[0].videoBitrateKbps
 */
export function planTargetSizeCandidates(facts: MediaFacts, maxBytes: number, options: TargetSizeOptions = {}): TargetSizePlan {
  const notes: string[] = [];
  const audioBitrateKbps = facts.hasAudio ? (options.audioBitrateKbps ?? DEFAULT_AUDIO_KBPS) : 0;
  const floor = options.videoFloorKbps ?? DEFAULT_VIDEO_FLOOR_KBPS;
  const ceiling = Math.max(floor, options.videoCeilingKbps ?? DEFAULT_VIDEO_CEILING_KBPS);
  const limit = Math.min(Math.max(Math.floor(options.maxCandidates ?? 3), 1), MAX_CANDIDATES);
  const durationSeconds = facts.durationSeconds;

  const empty: TargetSizePlan = {
    isEstimated: true,
    method: 'bitrate',
    targetBytes: maxBytes,
    durationSeconds,
    audioBitrateKbps,
    baselineVideoKbps: 0,
    candidates: [],
    notes,
  };

  if (!facts.hasVideo) {
    notes.push('No video stream to size-target; candidates are only meaningful for video.');
    return empty;
  }
  if (!(maxBytes > 0)) {
    notes.push('A positive byte ceiling is required to plan candidates.');
    return empty;
  }
  if (!(durationSeconds > 0)) {
    notes.push('The duration is unknown, so no bitrate can be derived from the target size.');
    return empty;
  }

  const totalKbps = (maxBytes * 8) / durationSeconds / 1000;
  const baseline = Math.round(clamp(totalKbps - audioBitrateKbps, floor, ceiling));
  if (baseline <= floor) {
    notes.push(`Even the ${floor} kbps floor may exceed ${maxBytes} bytes; the first fit will be reported by measurement.`);
  }

  const ladder = LADDERS[options.bias ?? 'balanced'];
  const seen = new Set<number>();
  const candidates: TargetSizeCandidate[] = [];
  for (const multiplier of ladder) {
    const videoBitrateKbps = Math.round(clamp(baseline * multiplier, floor, ceiling));
    if (seen.has(videoBitrateKbps)) continue;
    seen.add(videoBitrateKbps);
    candidates.push({
      id: `c${candidates.length + 1}`,
      videoBitrateKbps,
      audioBitrateKbps,
      percentOfBaseline: baseline > 0 ? Math.round((videoBitrateKbps / baseline) * 100) : 100,
      rationale: rationaleFor(multiplier),
    });
    if (candidates.length >= limit) break;
  }

  candidates.sort((a, b) => b.videoBitrateKbps - a.videoBitrateKbps);
  candidates.forEach((candidate, index) => {
    candidate.id = `c${index + 1}`;
  });

  return {
    isEstimated: true,
    method: 'bitrate',
    targetBytes: maxBytes,
    durationSeconds,
    audioBitrateKbps,
    baselineVideoKbps: baseline,
    candidates,
    notes,
  };
}
