/**
 * @fileoverview String manipulation helpers for the renderer.
 */

/**
 * A single segment of text, flagged as highlighted when it matched the query.
 * @interface HighlightSegment
 * @property {string} text - The segment's text content.
 * @property {boolean} highlight - True when the segment is a query match.
 */
export interface HighlightSegment {
  text: string;
  highlight: boolean;
}

/**
 * Splits `text` into alternating non-match and match segments for the given
 * case-insensitive `query`, mirroring the behavior of the former inline
 * HighlightText component. Every occurrence of the query is reported as a
 * highlighted segment; with an empty query the whole text is a single
 * non-highlighted segment.
 * @param {string} text - The text to split.
 * @param {string} query - The case-insensitive search query ('' disables highlighting).
 * @returns {HighlightSegment[]} The segments in original order.
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  if (!query) return [{ text, highlight: false }];
  const lower = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  let idx = lower.indexOf(lowerQuery, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) segments.push({ text: text.slice(lastIndex, idx), highlight: false });
    segments.push({ text: text.slice(idx, idx + query.length), highlight: true });
    lastIndex = idx + query.length;
    idx = lower.indexOf(lowerQuery, lastIndex);
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), highlight: false });
  return segments;
}
