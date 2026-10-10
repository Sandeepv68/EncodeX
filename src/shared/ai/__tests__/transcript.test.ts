/**
 * @fileoverview Unit tests for transcript primitives.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTranscript,
  normalizeSegmentText,
  normalizeSegments,
  segmentDuration,
  transcriptText,
  transcriptWordCount,
} from '../transcript';

describe('transcript primitives', () => {
  it('normalizes and orders segments, clamping negative and inverted spans', () => {
    const segments = normalizeSegments([
      { start: 5, end: 7, text: '  second   line ' },
      { start: -1, end: 2, text: 'first' },
      { start: 10, end: 8, text: '' },
    ]);
    expect(segments).toEqual([
      { start: 0, end: 2, text: 'first' },
      { start: 5, end: 7, text: 'second line' },
    ]);
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeSegmentText('  a\n\tb  ')).toBe('a b');
  });

  it('computes segment duration without going negative', () => {
    expect(segmentDuration({ start: 10, end: 4, text: 'x' })).toBe(0);
    expect(segmentDuration({ start: 1, end: 4, text: 'x' })).toBe(3);
  });

  it('flattens text and counts words', () => {
    const transcript = buildTranscript(
      [
        { start: 0, end: 1, text: 'Hello world' },
        { start: 1, end: 2, text: 'again, hello!' },
      ],
      { engine: 'test' },
    );
    expect(transcriptText(transcript)).toBe('Hello world again, hello!');
    expect(transcriptWordCount(transcript)).toBe(4);
    expect(transcript.durationSeconds).toBe(2);
    expect(transcript.engine).toBe('test');
  });

  it('carries the language through when provided', () => {
    const transcript = buildTranscript([{ start: 0, end: 1, text: 'hola' }], { engine: 'test', language: 'es' });
    expect(transcript.language).toBe('es');
  });
});
