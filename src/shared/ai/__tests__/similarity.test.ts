/**
 * @fileoverview Unit tests for perceptual-hash similarity.
 */

import { describe, it, expect } from 'vitest';
import {
  averageHash,
  clusterSignatures,
  compareSignatures,
  differenceHash,
  hammingDistance,
  hashBitCount,
  hashSimilarity,
} from '../similarity';
import type { MediaSignature } from '../similarity';

const BLACK = new Array(64).fill(0);
const HALF = [...new Array(32).fill(0), ...new Array(32).fill(255)];

describe('perceptual hashes', () => {
  it('produces all-zero bits for a uniform frame', () => {
    expect(averageHash(BLACK, 8, 8)).toBe('0000000000000000');
  });

  it('produces a split hash for a half-bright frame', () => {
    expect(averageHash(HALF, 8, 8)).toBe('00000000ffffffff');
  });

  it('throws when the pixel buffer is too small', () => {
    expect(() => averageHash([0, 0], 8, 8)).toThrow(RangeError);
    expect(() => differenceHash([0, 0], 8, 8)).toThrow(RangeError);
  });

  it('computes difference hashes deterministically', () => {
    const a = differenceHash(HALF, 8, 8);
    expect(a).toBe(differenceHash(HALF, 8, 8));
    expect(hashBitCount(a)).toBe(56);
  });
});

describe('hash distance', () => {
  it('measures bit distance and similarity', () => {
    expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0);
    expect(hammingDistance('0000000000000000', 'ffffffffffffffff')).toBe(64);
    expect(hashSimilarity('0000000000000000', '0000000000000000')).toBe(1);
    expect(hashSimilarity('0000000000000000', 'ffffffffffffffff')).toBe(0);
  });
});

describe('compareSignatures', () => {
  it('flags identical metadata as a duplicate', () => {
    const base: MediaSignature = { file: 'a.mp4', durationSeconds: 10, width: 1920, height: 1080, sizeBytes: 1000 };
    const report = compareSignatures(base, [{ ...base, file: 'b.mp4' }]);
    expect(report.method).toBe('metadata');
    expect(report.matches).toHaveLength(1);
    expect(report.matches[0].label).toBe('duplicate');
    expect(report.matches[0].similarity).toBe(1);
  });

  it('excludes dissimilar files below the threshold', () => {
    const base: MediaSignature = { file: 'a.mp4', durationSeconds: 10, width: 1920, height: 1080, sizeBytes: 1000 };
    const report = compareSignatures(base, [{ file: 'b.mp4', durationSeconds: 100, width: 640, height: 480, sizeBytes: 10 }]);
    expect(report.matches).toHaveLength(0);
  });

  it('uses hashes when both sides carry one', () => {
    const base: MediaSignature = { file: 'a.mp4', durationSeconds: 10, sizeBytes: 1000, hash: '0000000000000000' };
    const report = compareSignatures(base, [{ file: 'b.mp4', durationSeconds: 10, sizeBytes: 1000, hash: '0000000000000000' }]);
    expect(report.method).toBe('hash');
    expect(report.matches[0].hashDistance).toBe(0);
    expect(report.matches[0].findings).toContain('sampled frames are identical');
  });

  it('notes same content with a different file size', () => {
    const base: MediaSignature = { file: 'a.mp4', durationSeconds: 10, sizeBytes: 1000000, hash: '0000000000000000' };
    const report = compareSignatures(base, [{ file: 'b.mp4', durationSeconds: 10, sizeBytes: 2000000, hash: '0000000000000000' }]);
    expect(report.matches[0].findings).toContain('same content, different file size (likely a re-encode)');
  });
});

describe('clusterSignatures', () => {
  it('groups mutually-similar files and leaves outliers alone', () => {
    const signatures: MediaSignature[] = [
      { file: 'a.mp4', durationSeconds: 10, width: 1920, height: 1080, sizeBytes: 1000, hash: '0000000000000000' },
      { file: 'b.mp4', durationSeconds: 10, width: 1920, height: 1080, sizeBytes: 1000, hash: '0000000000000000' },
      { file: 'c.mp4', durationSeconds: 10, width: 1920, height: 1080, sizeBytes: 1000, hash: 'ffffffffffffffff' },
    ];
    const report = clusterSignatures(signatures);
    expect(report.method).toBe('hash');
    expect(report.compared).toBe(3);
    expect(report.clusters).toHaveLength(1);
    expect(report.clusters[0].files).toEqual(['a.mp4', 'b.mp4']);
    expect(report.clusters[0].label).toBe('duplicate');
  });
});
