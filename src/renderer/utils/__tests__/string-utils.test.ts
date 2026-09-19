import { describe, it, expect } from 'vitest';
import { highlightSegments } from '../string-utils';

describe('highlightSegments', () => {
  it('returns a single non-highlighted segment with an empty query', () => {
    expect(highlightSegments('Profile A', '')).toEqual([{ text: 'Profile A', highlight: false }]);
  });

  it('returns a single non-highlighted segment when there is no match', () => {
    expect(highlightSegments('Profile A', 'zzz')).toEqual([{ text: 'Profile A', highlight: false }]);
  });

  it('splits around a single match', () => {
    expect(highlightSegments('Movie Profile', 'Profile')).toEqual([
      { text: 'Movie ', highlight: false },
      { text: 'Profile', highlight: true },
    ]);
  });

  it('matches case-insensitively and preserves the original casing', () => {
    expect(highlightSegments('MOVIE profile', 'profile')).toEqual([
      { text: 'MOVIE ', highlight: false },
      { text: 'profile', highlight: true },
    ]);
  });

  it('highlights every occurrence', () => {
    expect(highlightSegments('aaXbbXccX', 'X')).toEqual([
      { text: 'aa', highlight: false },
      { text: 'X', highlight: true },
      { text: 'bb', highlight: false },
      { text: 'X', highlight: true },
      { text: 'cc', highlight: false },
      { text: 'X', highlight: true },
    ]);
  });

  it('highlights adjacent repeats', () => {
    expect(highlightSegments('XXyy', 'X')).toEqual([
      { text: 'X', highlight: true },
      { text: 'X', highlight: true },
      { text: 'yy', highlight: false },
    ]);
  });
});
