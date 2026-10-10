/**
 * @fileoverview Unit tests for extractive summarization.
 */

import { describe, it, expect } from 'vitest';
import { buildTranscript } from '../transcript';
import { summarizeTranscript } from '../summarize';

const TRANSCRIPT = buildTranscript(
  [
    { start: 0, end: 5, text: 'The bread recipe needs flour water and yeast' },
    { start: 5, end: 10, text: 'Bread baking requires patience and a warm oven' },
    { start: 10, end: 15, text: 'Flour and water make the dough for bread' },
    { start: 15, end: 20, text: 'The weather today is completely unrelated' },
  ],
  { engine: 'test', durationSeconds: 20 },
);

describe('summarizeTranscript', () => {
  it('selects the most on-topic sentences, preserving order', () => {
    const result = summarizeTranscript(TRANSCRIPT, { maxSentences: 2 });
    expect(result.summary).toHaveLength(2);
    expect(result.sentenceCount).toBe(4);
    expect(result.summary.join(' ')).toContain('bread');
  });

  it('reports the most frequent words as topics', () => {
    const result = summarizeTranscript(TRANSCRIPT);
    expect(result.topics).toContain('bread');
    expect(result.topics).toContain('flour');
    expect(result.topics.length).toBeLessThanOrEqual(8);
  });

  it('reports source stats', () => {
    const result = summarizeTranscript(TRANSCRIPT);
    expect(result.durationSeconds).toBe(20);
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it('handles an empty transcript', () => {
    const result = summarizeTranscript(buildTranscript([], { engine: 'test' }));
    expect(result.summary).toEqual([]);
    expect(result.topics).toEqual([]);
  });
});
