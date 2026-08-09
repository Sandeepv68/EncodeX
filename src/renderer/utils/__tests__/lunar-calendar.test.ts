import { describe, it, expect } from 'vitest';
import { diwaliDate, holiDate } from '../lunar-calendar';
import type { LunarDate } from '../lunar-calendar';

/** Well-known, mainstream panchang dates used to ground-truth the algorithm. */
const KNOWN_DIWALI: ReadonlyArray<[number, number, number]> = [
  [2019, 10, 27],
  [2020, 11, 14],
  [2021, 11, 4],
  [2024, 11, 1],
  [2025, 10, 21],
];
const KNOWN_HOLI: ReadonlyArray<[number, number, number]> = [
  [2019, 3, 21],
  [2020, 3, 10],
  [2021, 3, 29],
  [2023, 3, 8],
];

/** The curated table in easter-egg-dates.ts, as [year, month, day]. */
const TABLE_DIWALI: ReadonlyArray<[number, number, number]> = [
  [2026, 11, 8],
  [2027, 10, 29],
  [2028, 10, 17],
  [2029, 11, 5],
  [2030, 10, 26],
  [2031, 11, 14],
  [2032, 11, 2],
  [2033, 10, 22],
  [2034, 11, 10],
  [2035, 10, 30],
];
const TABLE_HOLI: ReadonlyArray<[number, number, number]> = [
  [2026, 3, 4],
  [2027, 3, 22],
  [2028, 3, 11],
  [2029, 3, 1],
  [2030, 3, 20],
  [2031, 3, 9],
  [2032, 3, 27],
  [2033, 3, 16],
  [2034, 3, 5],
  [2035, 3, 24],
];

function sameDate(actual: LunarDate | null, year: number, month: number, day: number): boolean {
  return actual !== null && actual.month === month && actual.day === day;
}

function dayDiff(year: number, m1: number, d1: number, m2: number, d2: number): number {
  return Math.round((Date.UTC(year, m2 - 1, d2) - Date.UTC(year, m1 - 1, d1)) / 86400000);
}

describe('diwaliDate', () => {
  it('matches known Diwali dates', () => {
    for (const [year, month, day] of KNOWN_DIWALI) {
      expect(sameDate(diwaliDate(year), year, month, day), `${year}`).toBe(true);
    }
  });

  it('stays within one day of the curated table for 2026-2035', () => {
    for (const [year, month, day] of TABLE_DIWALI) {
      const computed = diwaliDate(year);
      expect(computed, `${year}`).not.toBeNull();
      expect(Math.abs(dayDiff(year, computed!.month, computed!.day, month, day)), `${year}`).toBeLessThanOrEqual(1);
    }
  });

  it('resolves every year in a wide range', () => {
    for (let year = 2000; year <= 2050; year++) {
      const computed = diwaliDate(year);
      expect(computed, `${year}`).not.toBeNull();
      expect(computed!.month).toBeGreaterThanOrEqual(10);
      expect(computed!.month).toBeLessThanOrEqual(12);
    }
  });
});

describe('holiDate', () => {
  it('matches known Holi dates', () => {
    for (const [year, month, day] of KNOWN_HOLI) {
      expect(sameDate(holiDate(year), year, month, day), `${year}`).toBe(true);
    }
  });

  it('stays within one day of the curated table for 2026-2035', () => {
    for (const [year, month, day] of TABLE_HOLI) {
      const computed = holiDate(year);
      expect(computed, `${year}`).not.toBeNull();
      expect(Math.abs(dayDiff(year, computed!.month, computed!.day, month, day)), `${year}`).toBeLessThanOrEqual(1);
    }
  });

  it('resolves every year in a wide range', () => {
    for (let year = 2000; year <= 2050; year++) {
      const computed = holiDate(year);
      expect(computed, `${year}`).not.toBeNull();
      expect(computed!.month).toBeGreaterThanOrEqual(2);
      expect(computed!.month).toBeLessThanOrEqual(4);
    }
  });
});
