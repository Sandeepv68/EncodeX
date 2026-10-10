/**
 * @fileoverview Unit tests for subtitle translation helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  extractJsonArray,
  getTranslationProvider,
  normalizeTranslationSegments,
  parseTranslatedLines,
  TRANSLATION_PROVIDERS,
} from '../translate';
import type { TranscriptSegment } from '../transcript';

const SOURCE: TranscriptSegment[] = [
  { start: 0, end: 2, text: 'Hello' },
  { start: 2, end: 4, text: 'World' },
];

describe('translation provider descriptors', () => {
  it('declares egress posture', () => {
    expect(TRANSLATION_PROVIDERS[0].id).toBe('local');
    expect(TRANSLATION_PROVIDERS[0].dataEgress).toBe('none');
    expect(getTranslationProvider('openai')?.dataEgress).toBe('metadata');
    expect(getTranslationProvider('nope')).toBeUndefined();
  });
});

describe('extractJsonArray', () => {
  it('extracts a balanced array ignoring brackets in strings', () => {
    expect(extractJsonArray('prefix ["a]b","c"] suffix')).toBe('["a]b","c"]');
    expect(extractJsonArray('none')).toBeUndefined();
  });
});

describe('parseTranslatedLines', () => {
  it('parses an aligned string array', () => {
    expect(parseTranslatedLines('["Bonjour","Monde"]', 2)).toEqual(['Bonjour', 'Monde']);
  });

  it('pads short arrays and truncates long ones', () => {
    expect(parseTranslatedLines('["only"]', 2)).toEqual(['only', '']);
    expect(parseTranslatedLines('["a","b","c"]', 2)).toEqual(['a', 'b']);
  });

  it('returns undefined when there is no array', () => {
    expect(parseTranslatedLines('no json here', 2)).toBeUndefined();
  });
});

describe('normalizeTranslationSegments', () => {
  it('reattaches translations to source timings and falls back on gaps', () => {
    const translated = normalizeTranslationSegments(SOURCE, ['Bonjour', '']);
    expect(translated).toEqual([
      { start: 0, end: 2, text: 'Bonjour' },
      { start: 2, end: 4, text: 'World' },
    ]);
  });
});
