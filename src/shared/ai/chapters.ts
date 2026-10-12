/**
 * @fileoverview Deterministic automatic chaptering (roadmap 2.0, F13).
 * Segments a transcript into topical chapters using speech pauses and a target
 * chapter length, then titles each chapter from its most salient keywords.
 * Pure code, deterministic for a given transcript + options (roadmap §7.3).
 */

import { keywordsFor, titleCase, wordFrequencies } from './text';
import { normalizeSegmentText } from './transcript';
import type { Transcript, TranscriptSegment } from './transcript';

/**
 * A generated chapter.
 * @interface Chapter
 * @property {number} start - Start offset in seconds.
 * @property {number} end - End offset in seconds.
 * @property {string} title - Generated title.
 */
export interface Chapter {
  start: number;
  end: number;
  title: string;
}

/**
 * Tuning for {@link generateChapters}.
 * @interface ChapterOptions
 * @property {number} [minChapterSeconds] - Shortest allowed chapter before a pause can split (default 45).
 * @property {number} [maxChapterSeconds] - Hard cap that forces a split even without a pause (default 300).
 * @property {number} [gapSeconds] - Silence gap that marks a topic boundary (default 2.5).
 * @property {number} [maxChapters] - Upper bound; extra chapters are merged (default 20).
 * @property {number} [maxKeywords] - Keywords per title (default 4).
 */
export interface ChapterOptions {
  minChapterSeconds?: number;
  maxChapterSeconds?: number;
  gapSeconds?: number;
  maxChapters?: number;
  maxKeywords?: number;
}

/**
 * Splits ordered segments into raw chapter spans by pause + length heuristics.
 * @param {TranscriptSegment[]} segments - Ordered segments.
 * @param {Required<ChapterOptions>} options - Resolved options.
 * @returns {Array<{ start: number; end: number; segments: TranscriptSegment[] }>} Raw spans.
 */
function segmentIntoChapters(
  segments: TranscriptSegment[],
  options: Required<ChapterOptions>,
): Array<{ start: number; end: number; segments: TranscriptSegment[] }> {
  const spans: Array<{ start: number; end: number; segments: TranscriptSegment[] }> = [];
  let current: TranscriptSegment[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (current.length > 0) {
      const previous = current[current.length - 1];
      const elapsed = segment.start - current[0].start;
      const gap = segment.start - previous.end;
      const longEnough = elapsed >= options.minChapterSeconds;
      const atCap = elapsed >= options.maxChapterSeconds;
      if ((longEnough && gap >= options.gapSeconds) || atCap) {
        spans.push({ start: current[0].start, end: previous.end, segments: current });
        current = [];
      }
    }
    current.push(segment);
  }
  if (current.length > 0) {
    spans.push({ start: current[0].start, end: current[current.length - 1].end, segments: current });
  }
  return spans;
}

/**
 * Merges the shortest adjacent pair until the span count is within `maxChapters`.
 * @param {Array<{ start: number; end: number; segments: TranscriptSegment[] }>} spans - Raw spans.
 * @param {number} maxChapters - Upper bound.
 * @returns {Array<{ start: number; end: number; segments: TranscriptSegment[] }>} Reduced spans.
 */
function mergeToLimit(
  spans: Array<{ start: number; end: number; segments: TranscriptSegment[] }>,
  maxChapters: number,
): Array<{ start: number; end: number; segments: TranscriptSegment[] }> {
  const result = [...spans];
  while (result.length > Math.max(1, maxChapters)) {
    let mergeAt = 0;
    let shortest = Number.POSITIVE_INFINITY;
    for (let index = 0; index < result.length - 1; index += 1) {
      const span = result[index].end - result[index].start + (result[index + 1].end - result[index + 1].start);
      if (span < shortest) {
        shortest = span;
        mergeAt = index;
      }
    }
    const merged = {
      start: result[mergeAt].start,
      end: result[mergeAt + 1].end,
      segments: [...result[mergeAt].segments, ...result[mergeAt + 1].segments],
    };
    result.splice(mergeAt, 2, merged);
  }
  return result;
}

/**
 * Generates chapters from a transcript.
 * @param {Transcript} transcript - The transcript.
 * @param {ChapterOptions} [options] - Tuning options.
 * @returns {Chapter[]} Ordered chapters with generated titles.
 */
export function generateChapters(transcript: Transcript, options: ChapterOptions = {}): Chapter[] {
  const resolved: Required<ChapterOptions> = {
    minChapterSeconds: options.minChapterSeconds ?? 45,
    maxChapterSeconds: options.maxChapterSeconds ?? 300,
    gapSeconds: options.gapSeconds ?? 2.5,
    maxChapters: options.maxChapters ?? 20,
    maxKeywords: options.maxKeywords ?? 4,
  };
  const segments = transcript.segments ?? [];
  if (segments.length === 0) return [];
  const spans = mergeToLimit(segmentIntoChapters(segments, resolved), resolved.maxChapters);
  const texts = spans.map((span) => span.segments.map((segment) => normalizeSegmentText(segment.text)).join(' '));
  const frequencies = wordFrequencies(texts);
  return spans.map((span, index) => {
    const keywords = keywordsFor(texts[index], frequencies, resolved.maxKeywords);
    const title = titleCase(keywords) || `Chapter ${index + 1}`;
    return { start: span.start, end: span.end, title };
  });
}

/**
 * Formats a chapter offset as a YouTube-style timestamp (`M:SS` / `H:MM:SS`).
 * @param {number} seconds - Offset in seconds.
 * @returns {string} The timestamp.
 */
export function chapterTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours > 0 ? `${hours}:` : ''}${mm}:${String(secs).padStart(2, '0')}`;
}

/**
 * Renders chapters as a YouTube description timestamp list.
 * @param {Chapter[]} chapters - The chapters.
 * @returns {string} One `timestamp Title` line per chapter.
 */
export function chaptersToYouTube(chapters: Chapter[]): string {
  return chapters.map((chapter) => `${chapterTimestamp(chapter.start)} ${chapter.title}`).join('\n');
}

/**
 * Renders chapters as an FFmpeg `;FFMETADATA1` chapter sidecar. Each chapter
 * runs until the next chapter's start; the last runs until `totalSeconds`.
 * @param {Chapter[]} chapters - The chapters.
 * @param {number} totalSeconds - Total media duration in seconds.
 * @returns {string} The FFmpeg metadata document.
 */
export function chaptersToFfmpeg(chapters: Chapter[], totalSeconds: number): string {
  const lines = [';FFMETADATA1'];
  chapters.forEach((chapter, index) => {
    const end = index + 1 < chapters.length ? chapters[index + 1].start : Math.max(chapter.end, totalSeconds);
    lines.push(
      '[CHAPTER]',
      'TIMEBASE=1/1000',
      `START=${Math.round(chapter.start * 1000)}`,
      `END=${Math.round(end * 1000)}`,
      `title=${chapter.title}`,
    );
  });
  return `${lines.join('\n')}\n`;
}
