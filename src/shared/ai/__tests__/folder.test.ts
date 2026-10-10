/**
 * @fileoverview Unit tests for {@link summarizeLibrary} and {@link libraryRow}.
 */

import { describe, it, expect } from 'vitest';
import { summarizeLibrary, libraryRow } from '../folder';

describe('libraryRow', () => {
  it('derives signed savings fields', () => {
    const row = libraryRow('C:/a.mp4', 1000, 400);
    expect(row.savingsBytes).toBe(600);
    expect(row.savingsPercent).toBe(60);
    expect(row.targetBytes).toBeUndefined();
  });

  it('reports growth as a negative saving', () => {
    const row = libraryRow('C:/a.mp4', 1000, 1200);
    expect(row.savingsBytes).toBe(-200);
    expect(row.savingsPercent).toBe(-20);
  });

  it('guards against a zero-size source', () => {
    expect(libraryRow('C:/a.mp4', 0, 0).savingsPercent).toBe(0);
  });
});

describe('summarizeLibrary', () => {
  it('sums the projected totals across usable rows', () => {
    const summary = summarizeLibrary([libraryRow('C:/a.mp4', 1000, 400), libraryRow('C:/b.mp4', 2000, 1000)]);
    expect(summary.fileCount).toBe(2);
    expect(summary.analyzedCount).toBe(2);
    expect(summary.errorCount).toBe(0);
    expect(summary.totalSourceBytes).toBe(3000);
    expect(summary.totalEstimatedBytes).toBe(1400);
    expect(summary.totalSavingsBytes).toBe(1600);
    expect(summary.savingsPercent).toBe(53);
    expect(summary.isEstimated).toBe(true);
  });

  it('excludes errored rows from the totals and notes them', () => {
    const summary = summarizeLibrary([libraryRow('C:/a.mp4', 1000, 400), { ...libraryRow('C:/bad.mov', 0, 0), error: 'probe failed' }]);
    expect(summary.errorCount).toBe(1);
    expect(summary.analyzedCount).toBe(1);
    expect(summary.totalSourceBytes).toBe(1000);
    expect(summary.notes.join(' ')).toContain('could not be projected');
  });

  it('reports the five largest savers, tie-broken by path', () => {
    const rows = [
      libraryRow('C:/f.mp4', 100, 90),
      libraryRow('C:/a.mp4', 1000, 100),
      libraryRow('C:/b.mp4', 1000, 100),
      libraryRow('C:/c.mp4', 500, 100),
      libraryRow('C:/d.mp4', 400, 100),
      libraryRow('C:/e.mp4', 300, 100),
    ];
    const summary = summarizeLibrary(rows);
    expect(summary.largest).toHaveLength(5);
    expect(summary.largest[0].savingsBytes).toBe(900);
    expect(summary.largest[0].input).toBe('C:/a.mp4');
    expect(summary.largest[1].input).toBe('C:/b.mp4');
  });

  it('notes when nothing can be projected or nothing would be saved', () => {
    const empty = summarizeLibrary([{ ...libraryRow('C:/a.mp4', 0, 0), error: 'x' }]);
    expect(empty.notes.join(' ')).toContain('nothing to save');
    const growing = summarizeLibrary([libraryRow('C:/a.mp4', 1000, 1500)]);
    expect(growing.notes.join(' ')).toContain('not projected to reduce');
  });
});
