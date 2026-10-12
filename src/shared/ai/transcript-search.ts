/**
 * @fileoverview Deterministic transcript search (roadmap 2.0, F14). Locates the
 * spoken passages that best answer a query so an assistant can propose a clip.
 * Token-overlap scoring is pure code; the same query over the same transcript
 * always yields the same matches (roadmap §7.3).
 */

import { normalizeSegmentText } from './transcript';
import { tokenize } from './text';
import type { TranscriptSegment } from './transcript';

/**
 * One matched segment.
 * @interface TranscriptMatch
 * @property {number} start - Start offset in seconds.
 * @property {number} end - End offset in seconds.
 * @property {string} text - The segment text.
 * @property {number} score - Relevance score in `(0, 1]`.
 */
export interface TranscriptMatch {
  start: number;
  end: number;
  text: string;
  score: number;
}

/**
 * The result of a transcript search.
 * @interface TranscriptSearchResult
 * @property {string} query - The original query.
 * @property {TranscriptMatch[]} matches - Ranked matches (best first).
 * @property {{ start: number; end: number }} [bestRange] - Span covering the best passage.
 */
export interface TranscriptSearchResult {
  query: string;
  matches: TranscriptMatch[];
  bestRange?: { start: number; end: number };
}

/**
 * Options for {@link searchTranscript}.
 * @interface TranscriptSearchOptions
 * @property {number} [maxMatches] - Maximum matches to return (default 10).
 * @property {number} [minScore] - Discard matches below this score (default 0.34).
 * @property {number} [context] - Extend `bestRange` by this many seconds on each side (default 0).
 */
export interface TranscriptSearchOptions {
  maxMatches?: number;
  minScore?: number;
  context?: number;
}

/**
 * Scores one segment against a query's content tokens.
 * @param {string} text - Segment text.
 * @param {string[]} queryTokens - The query content tokens.
 * @returns {number} Score in `[0, 1]`.
 */
function scoreSegment(text: string, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const haystack = tokenize(text);
  const haySet = new Set(haystack);
  const present = queryTokens.filter((token) => haySet.has(token)).length;
  const overlap = present / queryTokens.length;
  const phrase = text.toLowerCase().includes(queryTokens.join(' ')) ? 1 : 0;
  return Math.min(1, overlap * 0.75 + phrase * 0.25);
}

/**
 * Searches a transcript for the passages matching `query`.
 * @param {TranscriptSegment[]} segments - Ordered transcript segments.
 * @param {string} query - The natural-language query.
 * @param {TranscriptSearchOptions} [options] - Tuning options.
 * @returns {TranscriptSearchResult} Ranked matches and the best passage span.
 */
export function searchTranscript(
  segments: TranscriptSegment[],
  query: string,
  options: TranscriptSearchOptions = {},
): TranscriptSearchResult {
  const maxMatches = options.maxMatches ?? 10;
  const minScore = options.minScore ?? 0.34;
  const context = Math.max(0, options.context ?? 0);
  const queryTokens = [...new Set(tokenize(query).filter((token) => token.length > 1))];
  const allMatches: TranscriptMatch[] = [];
  for (const segment of segments ?? []) {
    const text = normalizeSegmentText(segment.text);
    if (!text) continue;
    const score = scoreSegment(text, queryTokens);
    if (score >= minScore) {
      allMatches.push({ start: segment.start, end: segment.end, text, score });
    }
  }
  const matches = allMatches.sort((a, b) => b.score - a.score || a.start - b.start).slice(0, maxMatches);
  if (matches.length === 0) return { query, matches };
  const ordered = [...matches].sort((a, b) => a.start - b.start);
  const bestRange = {
    start: Math.max(0, ordered[0].start - context),
    end: ordered[ordered.length - 1].end + context,
  };
  return { query, matches, bestRange };
}
