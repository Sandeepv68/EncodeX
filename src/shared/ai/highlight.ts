/**
 * @fileoverview Frame-analysis primitives for highlight, thumbnail and scene
 * detection (roadmap 2.0, R6 — F16/F18).
 *
 * Everything here operates on an array of sampled frames. A sampled frame is a
 * timestamp plus an optional perceptual hash (from `similarity.ts`); the
 * extraction that produces them lives in the MCP layer so this module stays
 * Electron- and FFmpeg-free. Given hashes, the analysis is deterministic:
 * scene boundaries are large frame-to-frame Hamming jumps, highlights are the
 * spans those boundaries open, and thumbnail candidates are the frames that
 * differ most from one another (greedy farthest-point selection). When no frame
 * could be hashed the functions degrade to evenly-spaced time candidates rather
 * than returning nothing.
 */

import { hammingDistance, hashBitCount } from './similarity';

/**
 * One sampled frame: a seek offset and, when decodable, its perceptual hash.
 * @interface SampledFrame
 * @property {number} atSeconds - Offset of the frame in the media.
 * @property {string} [hash] - Hex perceptual hash, when the frame was sampled.
 */
export interface SampledFrame {
  atSeconds: number;
  hash?: string;
}

/**
 * A detected scene change: the offset where a new scene begins.
 * @interface SceneBoundary
 * @property {number} atSeconds - Boundary offset in seconds.
 * @property {number} change - Normalized change magnitude in `[0, 1]`.
 */
export interface SceneBoundary {
  atSeconds: number;
  change: number;
}

/**
 * A suggested highlight span.
 * @interface HighlightSpan
 * @property {number} start - Start offset in seconds.
 * @property {number} end - End offset in seconds.
 * @property {number} score - Relative interestingness in `[0, 1]`.
 * @property {string} reason - Why the span was picked.
 */
export interface HighlightSpan {
  start: number;
  end: number;
  score: number;
  reason: string;
}

/**
 * A suggested thumbnail frame.
 * @interface ThumbnailCandidate
 * @property {number} atSeconds - Frame offset in seconds.
 * @property {number} score - Distinctiveness in `[0, 1]`.
 * @property {string} reason - Why the frame was picked.
 */
export interface ThumbnailCandidate {
  atSeconds: number;
  score: number;
  reason: string;
}

/**
 * The full frame analysis.
 * @interface HighlightReport
 * @property {'hash' | 'time'} method - Whether frame hashes drove the result.
 * @property {number} framesSampled - Number of frames with a usable hash.
 * @property {SceneBoundary[]} scenes - Detected scene boundaries (by time).
 * @property {HighlightSpan[]} highlights - Ranked highlight spans (by time).
 * @property {ThumbnailCandidate[]} thumbnails - Suggested thumbnail frames.
 * @property {string[]} notes - Caveats for the caller.
 */
export interface HighlightReport {
  method: 'hash' | 'time';
  framesSampled: number;
  scenes: SceneBoundary[];
  highlights: HighlightSpan[];
  thumbnails: ThumbnailCandidate[];
  notes: string[];
}

/**
 * Tuning for {@link analyzeFrames}.
 * @interface FrameAnalysisOptions
 * @property {number} [durationSeconds] - Media duration; defaults to the last frame.
 * @property {number} [sceneThreshold] - Change fraction that opens a scene (default 0.15).
 * @property {number} [maxHighlights] - Maximum highlight spans (default 5).
 * @property {number} [maxThumbnails] - Maximum thumbnail frames (default 6).
 */
export interface FrameAnalysisOptions {
  durationSeconds?: number;
  sceneThreshold?: number;
  maxHighlights?: number;
  maxThumbnails?: number;
}

/** Normalized change between two hashes: differing bits over total bits. */
function normalizedDistance(a: string, b: string): number {
  const bits = Math.max(1, hashBitCount(a));
  return Math.min(1, hammingDistance(a, b) / bits);
}

/**
 * Orders frames by offset, dropping non-finite timestamps.
 * @param {SampledFrame[]} frames - The frames to sort.
 * @returns {SampledFrame[]} A new, ordered array.
 */
function orderedFrames(frames: SampledFrame[]): SampledFrame[] {
  return [...(frames ?? [])].filter((frame) => Number.isFinite(frame?.atSeconds)).sort((a, b) => a.atSeconds - b.atSeconds);
}

/**
 * Detects scene boundaries: offsets where the frame differs from its predecessor
 * by at least `threshold` of its hash bits. Frames without hashes are skipped.
 * @param {SampledFrame[]} frames - The sampled frames.
 * @param {number} [threshold] - Change fraction that opens a scene (default 0.15).
 * @returns {SceneBoundary[]} Boundaries in ascending time order.
 */
export function detectScenes(frames: SampledFrame[], threshold = 0.15): SceneBoundary[] {
  const ordered = orderedFrames(frames);
  const boundaries: SceneBoundary[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!previous.hash || !current.hash) continue;
    const change = normalizedDistance(previous.hash, current.hash);
    if (change >= threshold) boundaries.push({ atSeconds: current.atSeconds, change: Number(change.toFixed(4)) });
  }
  return boundaries;
}

/**
 * Derives highlight spans from scene boundaries: each boundary opens a span that
 * runs to the next boundary (or the end). Spans are ranked by the change that
 * opened them, the top `maxHighlights` are kept, and the result is returned in
 * time order. With no usable boundaries the whole clip is offered as one span.
 * @param {SampledFrame[]} frames - The sampled frames.
 * @param {FrameAnalysisOptions} [options] - Tuning.
 * @returns {HighlightSpan[]} Ranked, time-ordered spans.
 */
export function detectHighlights(frames: SampledFrame[], options: FrameAnalysisOptions = {}): HighlightSpan[] {
  const ordered = orderedFrames(frames);
  const duration = options.durationSeconds ?? (ordered.length > 0 ? ordered[ordered.length - 1].atSeconds : 0);
  const maxHighlights = Math.max(1, options.maxHighlights ?? 5);
  const boundaries = detectScenes(ordered, options.sceneThreshold);
  if (boundaries.length === 0) {
    if (duration <= 0) return [];
    return [{ start: 0, end: duration, score: 0.5, reason: 'No scene changes detected; offering the full clip.' }];
  }
  const spans: HighlightSpan[] = boundaries.map((boundary, index) => {
    const end = index + 1 < boundaries.length ? boundaries[index + 1].atSeconds : duration;
    return {
      start: boundary.atSeconds,
      end: Math.max(boundary.atSeconds, end),
      score: boundary.change,
      reason: `Scene change of ${(boundary.change * 100).toFixed(0)}% at ${boundary.atSeconds.toFixed(1)}s.`,
    };
  });
  const top = [...spans].sort((a, b) => b.score - a.score || a.start - b.start).slice(0, maxHighlights);
  return top.sort((a, b) => a.start - b.start);
}

/**
 * Selects thumbnail candidates by greedy farthest-point sampling: the first
 * frame is the average-hash centroid proxy (the frame whose hash is closest to
 * the rest), then each subsequent pick maximizes its minimum distance to the
 * already-chosen frames. Deterministic; ties break by timestamp. Without hashes,
 * evenly spaced offsets are returned instead.
 * @param {SampledFrame[]} frames - The sampled frames.
 * @param {number} [count] - Desired candidate count (default 6).
 * @returns {ThumbnailCandidate[]} Chosen frames, in ascending time order.
 */
export function selectThumbnailCandidates(frames: SampledFrame[], count = 6): ThumbnailCandidate[] {
  const hashed = orderedFrames(frames).filter((frame) => Boolean(frame.hash));
  const wanted = Math.max(1, count);
  if (hashed.length === 0) {
    const ordered = orderedFrames(frames);
    if (ordered.length === 0) return [];
    const step = Math.max(1, Math.floor(ordered.length / wanted));
    const picks: ThumbnailCandidate[] = [];
    for (let index = 0; index < ordered.length && picks.length < wanted; index += step) {
      picks.push({ atSeconds: ordered[index].atSeconds, score: 0, reason: 'Evenly spaced (no frame hashes available).' });
    }
    return picks;
  }
  const pick = (frame: SampledFrame, score: number, reason: string): ThumbnailCandidate => ({
    atSeconds: frame.atSeconds,
    score: Number(score.toFixed(4)),
    reason,
  });
  const distanceToSet = (frame: SampledFrame, chosen: SampledFrame[]): number => {
    let min = 1;
    for (const other of chosen) {
      min = Math.min(min, normalizedDistance(frame.hash as string, other.hash as string));
    }
    return min;
  };
  const chosen: SampledFrame[] = [];
  // Seed with the frame whose average distance to all others is greatest
  // (the most visually central frame is the least useful thumbnail seed).
  let seed = hashed[0];
  let seedScore = -1;
  for (const frame of hashed) {
    let total = 0;
    for (const other of hashed) {
      if (other === frame) continue;
      total += normalizedDistance(frame.hash as string, other.hash as string);
    }
    const average = total / Math.max(1, hashed.length - 1);
    if (average > seedScore) {
      seedScore = average;
      seed = frame;
    }
  }
  chosen.push(seed);
  const candidates: ThumbnailCandidate[] = [pick(seed, 1, 'Opening candidate (most distinct frame).')];
  while (chosen.length < Math.min(wanted, hashed.length)) {
    let best: SampledFrame | undefined;
    let bestDistance = -1;
    for (const frame of hashed) {
      if (chosen.includes(frame)) continue;
      const distance = distanceToSet(frame, chosen);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = frame;
      }
    }
    if (!best || bestDistance <= 0) break;
    chosen.push(best);
    candidates.push(pick(best, bestDistance, `Distinct from the other picks (${(bestDistance * 100).toFixed(0)}% different).`));
  }
  return candidates.sort((a, b) => a.atSeconds - b.atSeconds);
}

/**
 * Runs the full frame analysis: scene boundaries, highlight spans, and thumbnail
 * candidates, with caveats attached.
 * @param {SampledFrame[]} frames - The sampled frames.
 * @param {FrameAnalysisOptions} [options] - Tuning.
 * @returns {HighlightReport} The combined report.
 */
export function analyzeFrames(frames: SampledFrame[], options: FrameAnalysisOptions = {}): HighlightReport {
  const ordered = orderedFrames(frames);
  const hashed = ordered.filter((frame) => Boolean(frame.hash));
  const method: 'hash' | 'time' = hashed.length > 0 ? 'hash' : 'time';
  const notes: string[] = [];
  if (hashed.length === 0) notes.push('No frames could be hashed; scenes and highlights fall back to time-based candidates.');
  else if (hashed.length < ordered.length) notes.push(`${ordered.length - hashed.length} frame(s) could not be sampled and were ignored.`);
  notes.push('Frames are sampled, not every frame; short scenes between samples may be missed.');
  return {
    method,
    framesSampled: hashed.length,
    scenes: detectScenes(ordered, options.sceneThreshold),
    highlights: detectHighlights(ordered, options),
    thumbnails: selectThumbnailCandidates(ordered, options.maxThumbnails),
    notes,
  };
}
