/**
 * @fileoverview Unit tests for the frame-analysis primitives (F16/F18).
 */

import { describe, it, expect } from 'vitest';
import { analyzeFrames, detectHighlights, detectScenes, selectThumbnailCandidates, type SampledFrame } from '../highlight';

const A = '0000000000000000';
const B = '00000000ffffffff';
const C = 'ffffffffffffffff';

describe('detectScenes', () => {
  it('marks offsets where the frame change crosses the threshold', () => {
    const frames: SampledFrame[] = [
      { atSeconds: 0, hash: A },
      { atSeconds: 1, hash: A },
      { atSeconds: 2, hash: B },
      { atSeconds: 3, hash: B },
      { atSeconds: 4, hash: C },
      { atSeconds: 5, hash: C },
    ];
    const scenes = detectScenes(frames);
    expect(scenes.map((scene) => scene.atSeconds)).toEqual([2, 4]);
    expect(scenes[0].change).toBeCloseTo(0.5, 4);
  });

  it('ignores frames without hashes and small changes', () => {
    const frames: SampledFrame[] = [{ atSeconds: 0, hash: A }, { atSeconds: 1 }, { atSeconds: 2, hash: '0000000000000001' }];
    expect(detectScenes(frames)).toEqual([]);
  });

  it('orders unordered frames', () => {
    const frames: SampledFrame[] = [
      { atSeconds: 2, hash: B },
      { atSeconds: 0, hash: A },
      { atSeconds: 1, hash: A },
    ];
    expect(detectScenes(frames).map((scene) => scene.atSeconds)).toEqual([2]);
  });
});

describe('detectHighlights', () => {
  it('opens a span per scene boundary and ranks by change', () => {
    const frames: SampledFrame[] = [
      { atSeconds: 0, hash: A },
      { atSeconds: 1, hash: A },
      { atSeconds: 2, hash: B },
      { atSeconds: 3, hash: B },
      { atSeconds: 4, hash: C },
      { atSeconds: 5, hash: C },
    ];
    const highlights = detectHighlights(frames, { durationSeconds: 6 });
    expect(highlights.map((span) => [span.start, span.end])).toEqual([
      [2, 4],
      [4, 6],
    ]);
  });

  it('falls back to one full-clip span when nothing changes', () => {
    const highlights = detectHighlights(
      [
        { atSeconds: 0, hash: A },
        { atSeconds: 5, hash: A },
      ],
      { durationSeconds: 5 },
    );
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({ start: 0, end: 5 });
  });

  it('returns no spans when the duration is unknown', () => {
    expect(detectHighlights([])).toEqual([]);
  });

  it('honours maxHighlights', () => {
    const frames: SampledFrame[] = [
      { atSeconds: 0, hash: A },
      { atSeconds: 1, hash: B },
      { atSeconds: 2, hash: A },
      { atSeconds: 3, hash: B },
    ];
    expect(detectHighlights(frames, { durationSeconds: 4, maxHighlights: 1 })).toHaveLength(1);
  });
});

describe('selectThumbnailCandidates', () => {
  it('picks distinct frames by hash and returns them in time order', () => {
    const frames: SampledFrame[] = [
      { atSeconds: 0, hash: A },
      { atSeconds: 1, hash: A },
      { atSeconds: 2, hash: B },
      { atSeconds: 3, hash: C },
      { atSeconds: 4, hash: C },
    ];
    const picks = selectThumbnailCandidates(frames, 3);
    expect(picks).toHaveLength(3);
    const times = picks.map((pick) => pick.atSeconds);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(new Set(times).size).toBe(3);
  });

  it('falls back to evenly spaced timestamps without hashes', () => {
    const frames: SampledFrame[] = Array.from({ length: 10 }, (_, index) => ({ atSeconds: index }));
    const picks = selectThumbnailCandidates(frames, 3);
    expect(picks).toHaveLength(3);
    expect(picks.every((pick) => pick.reason.includes('Evenly spaced'))).toBe(true);
  });

  it('returns nothing for an empty frame list', () => {
    expect(selectThumbnailCandidates([], 4)).toEqual([]);
  });
});

describe('analyzeFrames', () => {
  it('reports the hash method when frames were hashed', () => {
    const report = analyzeFrames([
      { atSeconds: 0, hash: A },
      { atSeconds: 1, hash: C },
    ]);
    expect(report.method).toBe('hash');
    expect(report.framesSampled).toBe(2);
    expect(report.notes.some((note) => note.includes('sampled'))).toBe(true);
  });

  it('reports the time method and a caveat without hashes', () => {
    const report = analyzeFrames([{ atSeconds: 0 }, { atSeconds: 10 }]);
    expect(report.method).toBe('time');
    expect(report.framesSampled).toBe(0);
    expect(report.notes.some((note) => note.includes('No frames could be hashed'))).toBe(true);
  });
});
