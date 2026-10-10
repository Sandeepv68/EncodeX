/**
 * @fileoverview Transcript primitives for the media-intelligence layer
 * (roadmap 2.0, R4). A transcript is the deterministic, model-independent
 * representation every downstream feature (subtitles, chapters, search,
 * summary, translation) speaks, so those features stay testable without a
 * speech-to-text runtime.
 *
 * Nothing here calls a model: a {@link Transcript} is produced by an STT
 * adapter (see `stt.ts`) or supplied directly, and all further processing is
 * pure code (roadmap §7.3).
 */

/**
 * One timed span of speech.
 * @interface TranscriptSegment
 * @property {number} start - Start offset in seconds.
 * @property {number} end - End offset in seconds (>= start).
 * @property {string} text - The spoken text.
 * @property {string} [speaker] - Optional speaker label when diarization is available.
 */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

/**
 * A full transcription of one media file.
 * @interface Transcript
 * @property {string} [language] - Detected/declared language (BCP-47 or ISO-639-1).
 * @property {number} durationSeconds - Length of the covered media.
 * @property {TranscriptSegment[]} segments - Ordered, non-overlapping segments.
 * @property {string} engine - Identifier of the engine that produced it (e.g. `whisper.cpp`).
 */
export interface Transcript {
  language?: string;
  durationSeconds: number;
  segments: TranscriptSegment[];
  engine: string;
}

/**
 * Collapses whitespace and trims a segment's text.
 * @param {string} text - Raw text.
 * @returns {string} Normalized text.
 */
export function normalizeSegmentText(text: string): string {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Duration of one segment in seconds (never negative).
 * @param {TranscriptSegment} segment - The segment.
 * @returns {number} Duration in seconds.
 */
export function segmentDuration(segment: TranscriptSegment): number {
  return Math.max(0, segment.end - segment.start);
}

/**
 * Flattens every segment into one plain-text string, single-spaced.
 * @param {Transcript} transcript - The transcript.
 * @returns {string} The joined text.
 */
export function transcriptText(transcript: Transcript): string {
  return transcript.segments
    .map((segment) => normalizeSegmentText(segment.text))
    .filter(Boolean)
    .join(' ');
}

/**
 * Counts words across the whole transcript using whitespace splitting.
 * @param {Transcript} transcript - The transcript.
 * @returns {number} Word count.
 */
export function transcriptWordCount(transcript: Transcript): number {
  return transcriptText(transcript)
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/**
 * Sorts segments by start time and clamps each to a non-negative, ordered span.
 * Used to harden engine output before it reaches a formatter.
 * @param {TranscriptSegment[]} segments - Possibly unordered segments.
 * @returns {TranscriptSegment[]} Ordered, sanitized segments.
 */
export function normalizeSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return [...(segments ?? [])]
    .map((segment) => ({
      start: Math.max(0, Number(segment.start) || 0),
      end: Math.max(0, Number(segment.end) || 0),
      text: normalizeSegmentText(segment.text),
      ...(segment.speaker ? { speaker: segment.speaker } : {}),
    }))
    .map((segment) => ({ ...segment, end: Math.max(segment.start, segment.end) }))
    .filter((segment) => segment.text.length > 0)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Builds a {@link Transcript} from raw segments, normalizing and ordering them.
 * @param {TranscriptSegment[]} segments - Raw segments.
 * @param {object} meta - Engine/language/duration metadata.
 * @param {string} meta.engine - Engine identifier.
 * @param {number} [meta.durationSeconds] - Media duration; defaults to the last segment end.
 * @param {string} [meta.language] - Language tag.
 * @returns {Transcript} The normalized transcript.
 */
export function buildTranscript(
  segments: TranscriptSegment[],
  meta: { engine: string; durationSeconds?: number; language?: string },
): Transcript {
  const normalized = normalizeSegments(segments);
  const lastEnd = normalized.length > 0 ? normalized[normalized.length - 1].end : 0;
  return {
    engine: meta.engine,
    durationSeconds: Math.max(0, meta.durationSeconds ?? lastEnd),
    segments: normalized,
    ...(meta.language ? { language: meta.language } : {}),
  };
}
