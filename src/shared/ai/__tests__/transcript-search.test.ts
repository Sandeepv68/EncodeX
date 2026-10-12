/**
 * @fileoverview Unit tests for transcript search.
 */

import { describe, it, expect } from 'vitest';
import { buildTranscript } from '../transcript';
import { searchTranscript } from '../transcript-search';

const TRANSCRIPT = buildTranscript(
  [
    { start: 0, end: 5, text: 'Hello and welcome to the channel' },
    { start: 5, end: 10, text: 'Today we talk about React hooks' },
    { start: 10, end: 15, text: 'Use the useState hook to track state' },
    { start: 15, end: 20, text: 'The useEffect hook runs side effects' },
    { start: 20, end: 25, text: 'Thanks for watching' },
  ],
  { engine: 'test' },
);

describe('searchTranscript', () => {
  it('ranks the phrase match highest', () => {
    const result = searchTranscript(TRANSCRIPT.segments, 'React hooks');
    expect(result.matches[0].text).toContain('React hooks');
    expect(result.matches[0].score).toBe(1);
  });

  it('finds a single term across segments and spans the best range', () => {
    const result = searchTranscript(TRANSCRIPT.segments, 'hook');
    expect(result.matches).toHaveLength(2);
    expect(result.bestRange).toEqual({ start: 10, end: 20 });
  });

  it('applies context padding to the best range', () => {
    const result = searchTranscript(TRANSCRIPT.segments, 'useState', { context: 3 });
    expect(result.bestRange).toEqual({ start: 7, end: 18 });
  });

  it('returns no matches and no range for an unrelated query', () => {
    const result = searchTranscript(TRANSCRIPT.segments, 'quantum chromodynamics');
    expect(result.matches).toEqual([]);
    expect(result.bestRange).toBeUndefined();
  });

  it('caps the number of matches', () => {
    const result = searchTranscript(TRANSCRIPT.segments, 'hook', { maxMatches: 1 });
    expect(result.matches).toHaveLength(1);
  });
});
