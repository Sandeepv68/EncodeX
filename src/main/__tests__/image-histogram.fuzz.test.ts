/**
 * @fileoverview Byte-level fuzz tests for `computeHistogram` (Phase 2).
 *
 * `computeHistogram` is pure, so it can be fuzzed hard and fast without ffmpeg.
 * It is also the one place a *truncated* ffmpeg decode becomes a `NaN` that the
 * renderer then draws, because `decodeImageHistogram` derives `width`/`height`
 * from the filter chain while the byte count comes from whatever ffmpeg managed
 * to emit before dying. Those two can disagree.
 *
 * The property that matters: every one of the 256 bins in all four channels is
 * a finite non-negative integer, for *any* buffer/dimension pair - including
 * buffers too short to cover the stated dimensions.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { computeHistogram } from '../image-info';
import { HISTOGRAM_BINS } from '../../shared/constants';

/**
 * Asserts the invariant a consumer relies on: 256 finite integer bins.
 *
 * Deliberately collects violations and throws once rather than calling
 * `expect()` per bin: at 1024 bins x 2000 runs that is over a million
 * assertion frames, which turns a fast pure fuzz into a 30 s test.
 */
function expectSoundHistogram(hist: ReturnType<typeof computeHistogram>, label: string): void {
  /** @type {string[]} */
  const bad: string[] = [];
  for (const channel of ['r', 'g', 'b', 'luma'] as const) {
    const bins = hist[channel] as unknown as Record<string, unknown>;
    if (bins.length !== HISTOGRAM_BINS) bad.push(`${channel}.length=${bins.length}`);
    for (let i = 0; i < HISTOGRAM_BINS; i++) {
      const value = bins[i];
      if (!Number.isInteger(value) || (value as number) < 0) bad.push(`${channel}[${i}]=${String(value)}`);
    }
    // A short buffer used to write NaN to the *string* key "undefined", which
    // array iteration and .some(Number.isNaN) both cannot see.
    for (const key of Object.keys(bins)) {
      if (!/^\d+$/.test(key)) bad.push(`${channel} non-index key ${JSON.stringify(key)}=${String(bins[key])}`);
    }
  }
  if (bad.length > 0) throw new Error(`${label}: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ` (+${bad.length - 5} more)` : ''}`);
}

function sumOf(hist: ReturnType<typeof computeHistogram>): number {
  const total = (channel: 'r' | 'g' | 'b' | 'luma') => (hist[channel] as unknown as number[]).reduce((a: number, b: number) => a + b, 0);
  return total('r') + total('g') + total('b') + total('luma');
}

describe('computeHistogram byte-level fuzz', () => {
  it('stays sound for 2000 random buffers with matching dimensions', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 4096 }),
        fc.integer({ min: 0, max: 64 }),
        fc.integer({ min: 0, max: 64 }),
        (bytes, w, h) => {
          const pixels = w * h;
          const needed = pixels * 3;
          // Only claim dimensions the buffer can actually cover.
          if (needed > bytes.length) return true;
          const hist = computeHistogram(Buffer.from(bytes), w, h);
          expectSoundHistogram(hist, `w=${w} h=${h} len=${bytes.length}`);
          // Every pixel contributes one count to each of the 4 channels.
          expect(sumOf(hist)).toBe(pixels * 4);
          return true;
        },
      ),
      { seed: 12345, numRuns: 2000 },
    );
  });

  it('stays sound for 2000 random buffers with dimensions that OVERSTATE the data', () => {
    // The real corruption: ffmpeg reports 1920x1080 but emitted 400 bytes.
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 512 }),
        fc.integer({ min: 1, max: 4000 }),
        fc.integer({ min: 1, max: 4000 }),
        (bytes, w, h) => {
          const hist = computeHistogram(Buffer.from(bytes), w, h);
          expectSoundHistogram(hist, `short: w=${w} h=${h} len=${bytes.length}`);
          // Must never claim more pixels than the buffer holds.
          expect(sumOf(hist)).toBeLessThanOrEqual(bytes.length * 4);
          return true;
        },
      ),
      { seed: 12345, numRuns: 2000 },
    );
  });

  it('stays sound for absurd dimensions without hanging or allocating', () => {
    // A 60k x 60k PNG is the plan's named case. Reading past the end must not
    // turn into a 10.8-billion-iteration loop over undefined bytes.
    for (const [w, h] of [
      [60_000, 60_000],
      [Number.MAX_SAFE_INTEGER, 1],
      [1, Number.MAX_SAFE_INTEGER],
      [2 ** 31, 2 ** 31],
    ] as [number, number][]) {
      const hist = computeHistogram(Buffer.alloc(16), w, h);
      expectSoundHistogram(hist, `absurd ${w}x${h}`);
      expect(sumOf(hist)).toBeLessThanOrEqual(16 * 4);
    }
  });

  it('handles zero, negative and non-finite dimensions without producing NaN', () => {
    for (const [w, h] of [
      [0, 0],
      [-1, 10],
      [10, -1],
      [Number.NaN, 5],
      [Number.POSITIVE_INFINITY, 5],
      [1.5, 2.5],
    ] as [number, number][]) {
      const hist = computeHistogram(Buffer.from([1, 2, 3, 4, 5, 6]), w, h);
      expectSoundHistogram(hist, `dims ${w}x${h}`);
    }
  });

  it('never throws for an empty buffer or a detached-like zero-length buffer', () => {
    for (const buf of [Buffer.alloc(0), Buffer.alloc(1), Buffer.alloc(2)]) {
      expect(() => computeHistogram(buf, 1, 1)).not.toThrow();
      expectSoundHistogram(computeHistogram(buf, 1, 1), `len=${buf.length}`);
    }
  });

  it('counts a known image exactly', () => {
    // 4 pixels: two pure red, two pure blue. Guards against the fix silently
    // zeroing everything.
    const pixels = Buffer.from([255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255]);
    const hist = computeHistogram(pixels, 2, 2);
    expect(hist.r[255]).toBe(2);
    expect(hist.b[255]).toBe(2);
    expect(hist.g[0]).toBe(4);
    expect(sumOf(hist)).toBe(16);
    expectSoundHistogram(hist, 'known');
  });

  it('counts every byte value into its own bin for a full sweep', () => {
    // One pixel per possible value in R only; G and B held at 0.
    const bytes: number[] = [];
    for (let v = 0; v < 256; v++) bytes.push(v, 0, 0);
    const hist = computeHistogram(Buffer.from(bytes), 256, 1);
    for (let v = 0; v < 256; v++) expect(hist.r[v]).toBe(1);
    expect(hist.g[0]).toBe(256);
    expect(sumOf(hist)).toBe(256 * 4);
  });

  it('keeps the luma bin index inside 0..255 for all-white and all-black frames', () => {
    expectSoundHistogram(computeHistogram(Buffer.alloc(3 * 16, 255), 4, 4), 'white');
    expectSoundHistogram(computeHistogram(Buffer.alloc(3 * 16, 0), 4, 4), 'black');
    const white = computeHistogram(Buffer.alloc(3 * 16, 255), 4, 4);
    expect(white.luma[255]).toBe(16);
  });
});
