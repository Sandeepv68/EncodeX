import { describe, it, expect } from 'vitest';
import { FESTIVAL_ORDER, FESTIVAL_WINDOW_RADIUS, getActiveFestival, getFestivalDate, easterDate } from '../easter-egg-dates';
import type { FestivalId } from '../easter-egg-dates';

function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe('FESTIVAL_ORDER', () => {
  it('lists every festival exactly once', () => {
    const expected: FestivalId[] = ['diwali', 'christmas', 'easter', 'holi', 'halloween', 'july4th', 'new_year'];
    expect(FESTIVAL_ORDER).toEqual(expected);
    expect(new Set(FESTIVAL_ORDER).size).toBe(FESTIVAL_ORDER.length);
  });

  it('uses a 3-day radius for the centered window', () => {
    expect(FESTIVAL_WINDOW_RADIUS).toBe(3);
  });
});

describe('easterDate', () => {
  it('computes well-known Gregorian Easter dates', () => {
    expect(easterDate(2026)).toEqual(d(2026, 4, 5));
    expect(easterDate(2027)).toEqual(d(2027, 3, 28));
    expect(easterDate(2030)).toEqual(d(2030, 4, 21));
    expect(easterDate(2024)).toEqual(d(2024, 3, 31));
    expect(easterDate(2000)).toEqual(d(2000, 4, 23));
  });
});

describe('getFestivalDate', () => {
  it('resolves fixed-date festivals', () => {
    expect(getFestivalDate('christmas', 2026)).toEqual(d(2026, 12, 25));
    expect(getFestivalDate('new_year', 2026)).toEqual(d(2026, 1, 1));
    expect(getFestivalDate('halloween', 2026)).toEqual(d(2026, 10, 31));
    expect(getFestivalDate('july4th', 2026)).toEqual(d(2026, 7, 4));
  });

  it('resolves Easter algorithmically', () => {
    expect(getFestivalDate('easter', 2026)).toEqual(d(2026, 4, 5));
  });

  it('looks up lunar festivals from the per-year table', () => {
    expect(getFestivalDate('diwali', 2026)).toEqual(d(2026, 11, 8));
    expect(getFestivalDate('holi', 2027)).toEqual(d(2027, 3, 22));
  });

  it('returns null for lunar festivals outside the table', () => {
    expect(getFestivalDate('diwali', 2020)).toBeNull();
    expect(getFestivalDate('holi', 2036)).toBeNull();
  });
});

describe('getActiveFestival fixed-date windows', () => {
  it('is active only within the centered window around Christmas', () => {
    expect(getActiveFestival(d(2026, 12, 22))).toBe('christmas');
    expect(getActiveFestival(d(2026, 12, 25))).toBe('christmas');
    expect(getActiveFestival(d(2026, 12, 28))).toBe('christmas');
    expect(getActiveFestival(d(2026, 12, 21))).toBeNull();
  });

  it('is active only within the centered window around July 4th', () => {
    expect(getActiveFestival(d(2026, 7, 1))).toBe('july4th');
    expect(getActiveFestival(d(2026, 7, 4))).toBe('july4th');
    expect(getActiveFestival(d(2026, 7, 7))).toBe('july4th');
    expect(getActiveFestival(d(2026, 7, 8))).toBeNull();
  });

  it('is active only within the centered window around Halloween', () => {
    expect(getActiveFestival(d(2026, 10, 28))).toBe('halloween');
    expect(getActiveFestival(d(2026, 10, 31))).toBe('halloween');
    expect(getActiveFestival(d(2026, 11, 3))).toBe('halloween');
    expect(getActiveFestival(d(2026, 11, 4))).toBeNull();
  });

  it('spans the year boundary for New Year', () => {
    expect(getActiveFestival(d(2026, 12, 29))).toBe('new_year');
    expect(getActiveFestival(d(2027, 1, 1))).toBe('new_year');
    expect(getActiveFestival(d(2027, 1, 4))).toBe('new_year');
    expect(getActiveFestival(d(2027, 1, 5))).toBeNull();
  });

  it('ignores the time of day inside a window', () => {
    expect(getActiveFestival(new Date(2026, 11, 25, 23, 59))).toBe('christmas');
  });
});

describe('getActiveFestival lunar and computed windows', () => {
  it('is active around the Diwali table date', () => {
    expect(getActiveFestival(d(2026, 11, 5))).toBe('diwali');
    expect(getActiveFestival(d(2026, 11, 8))).toBe('diwali');
    expect(getActiveFestival(d(2026, 11, 11))).toBe('diwali');
    expect(getActiveFestival(d(2026, 11, 4))).toBeNull();
  });

  it('is active around the Holi table date', () => {
    expect(getActiveFestival(d(2027, 3, 19))).toBe('holi');
    expect(getActiveFestival(d(2027, 3, 22))).toBe('holi');
    expect(getActiveFestival(d(2027, 3, 24))).toBe('holi');
    expect(getActiveFestival(d(2027, 3, 18))).toBeNull();
  });

  it('is active around the computed Easter date', () => {
    expect(getActiveFestival(d(2026, 4, 2))).toBe('easter');
    expect(getActiveFestival(d(2026, 4, 5))).toBe('easter');
    expect(getActiveFestival(d(2026, 4, 8))).toBe('easter');
    expect(getActiveFestival(d(2026, 4, 1))).toBeNull();
  });

  it('resolves a missing lunar year to no festival', () => {
    expect(getActiveFestival(d(2020, 11, 8))).toBeNull();
  });
});

describe('getActiveFestival overlap priority', () => {
  it('lets the config-first festival win when windows overlap', () => {
    // Easter 2027 (Mar 28) window [Mar 25, Mar 31] overlaps Holi 2027
    // (Mar 22) window [Mar 19, Mar 25] on Mar 25; Easter precedes Holi.
    expect(getActiveFestival(d(2027, 3, 25))).toBe('easter');
    expect(getActiveFestival(d(2027, 3, 24))).toBe('holi');
  });
});
