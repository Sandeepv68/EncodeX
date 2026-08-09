/**
 * @fileoverview Pure date logic for the seasonal Dashboard easter-egg logos.
 *
 * Decides which festival logo (if any) should replace the default app icon on
 * a given day. Each festival is active for a centered 7-day window
 * (`festival date - 3` through `festival date + 3`, inclusive). The module is
 * side-effect free and only depends on the host clock through the `Date`
 * passed in by the caller, which keeps it fully unit-testable.
 *
 * Festival dates are resolved three ways:
 *  - Fixed calendar dates (Christmas, Halloween, July 4th, New Year).
 *  - Easter, via the Gregorian computus algorithm (Meeus).
 *  - Diwali and Holi, which follow the Hindu lunar calendar, via a per-year
 *    table. Years missing from the table are skipped so the feature degrades
 *    gracefully instead of guessing.
 *
 * When two festival windows overlap, the festival that appears first in
 * {@link FESTIVAL_ORDER} wins.
 */

/**
 * Identifier for every festival that has a seasonal logo.
 * @typedef {('diwali'|'christmas'|'easter'|'holi'|'halloween'|'july4th'|'new_year')} FestivalId
 */
export type FestivalId = 'diwali' | 'christmas' | 'easter' | 'holi' | 'halloween' | 'july4th' | 'new_year';

/**
 * A calendar date as month/day numbers, month is 1-based.
 * @typedef {Object} CalendarDate
 * @property {number} month - Month of the year (1-12).
 * @property {number} day - Day of the month (1-31).
 */
interface CalendarDate {
  month: number;
  day: number;
}

/**
 * Half-width of the active window around each festival date, in days.
 * The full window is `2 * FESTIVAL_WINDOW_RADIUS + 1` days wide.
 * @const {number} FESTIVAL_WINDOW_RADIUS
 */
export const FESTIVAL_WINDOW_RADIUS = 3;

/**
 * Priority order for the festivals; on an overlap the earliest entry wins.
 * Mirrors the order the easter-egg logos were introduced.
 * @const {readonly FestivalId[]} FESTIVAL_ORDER
 */
export const FESTIVAL_ORDER: readonly FestivalId[] = ['diwali', 'christmas', 'easter', 'holi', 'halloween', 'july4th', 'new_year'];

/**
 * Fixed (same-day-every-year) festival dates.
 * @const {Readonly<Partial<Record<FestivalId, CalendarDate>>>} FIXED_FESTIVAL_DATES
 */
const FIXED_FESTIVAL_DATES: Readonly<Partial<Record<FestivalId, CalendarDate>>> = {
  christmas: { month: 12, day: 25 },
  halloween: { month: 10, day: 31 },
  july4th: { month: 7, day: 4 },
  new_year: { month: 1, day: 1 },
};

/**
 * Per-year dates for lunar-calendar festivals. Keys are years, values are the
 * main festival day. Missing years are skipped.
 * @const {Readonly<Partial<Record<FestivalId, Readonly<Record<number, CalendarDate>>>>>} LUNAR_FESTIVAL_DATES
 */
const LUNAR_FESTIVAL_DATES: Readonly<Partial<Record<FestivalId, Readonly<Record<number, CalendarDate>>>>> = {
  diwali: {
    2026: { month: 11, day: 8 },
    2027: { month: 10, day: 29 },
    2028: { month: 10, day: 17 },
    2029: { month: 11, day: 5 },
    2030: { month: 10, day: 26 },
    2031: { month: 11, day: 14 },
    2032: { month: 11, day: 2 },
    2033: { month: 10, day: 22 },
    2034: { month: 11, day: 10 },
    2035: { month: 10, day: 30 },
  },
  holi: {
    2026: { month: 3, day: 4 },
    2027: { month: 3, day: 22 },
    2028: { month: 3, day: 11 },
    2029: { month: 3, day: 1 },
    2030: { month: 3, day: 20 },
    2031: { month: 3, day: 9 },
    2032: { month: 3, day: 27 },
    2033: { month: 3, day: 16 },
    2034: { month: 3, day: 5 },
    2035: { month: 3, day: 24 },
  },
};

/**
 * Computes Easter Sunday for a Gregorian calendar year using the Anonymous
 * Gregorian computus algorithm (Meeus). Valid for years 1583 and later.
 * @param {number} year - The Gregorian year.
 * @returns {Date} The date of Easter Sunday in that year (local midnight).
 */
export function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Resolves the date a festival falls on for a given year.
 * Fixed-date festivals use the calendar, Easter is computed, and lunar
 * festivals are looked up in {@link LUNAR_FESTIVAL_DATES}.
 * @param {FestivalId} id - The festival to resolve.
 * @param {number} year - The Gregorian year.
 * @returns {Date | null} The festival date, or null when it cannot be resolved
 * for that year (e.g. a lunar festival outside the lookup table).
 */
export function getFestivalDate(id: FestivalId, year: number): Date | null {
  const fixed = FIXED_FESTIVAL_DATES[id];
  if (fixed) return new Date(year, fixed.month - 1, fixed.day);
  if (id === 'easter') return easterDate(year);
  const lunar = LUNAR_FESTIVAL_DATES[id]?.[year];
  return lunar ? new Date(year, lunar.month - 1, lunar.day) : null;
}

/**
 * Converts a date to a whole-day number so window comparisons ignore the time
 * of day and are unaffected by DST transitions.
 * @param {Date} date - The date to normalize.
 * @returns {number} The number of days since the Unix epoch (UTC).
 */
function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

/**
 * Returns the festival whose logo should replace the default app icon for the
 * given date, or null when no festival is active.
 *
 * Every festival window is checked for the surrounding years `Y-1`, `Y`, and
 * `Y+1` (where `Y` is the date's year) so windows that cross the year boundary
 * — such as New Year's Dec 29 - Jan 4 window — resolve correctly. The first
 * match in {@link FESTIVAL_ORDER} wins.
 * @param {Date} date - The date to evaluate.
 * @returns {FestivalId | null} The active festival, or null.
 */
export function getActiveFestival(date: Date): FestivalId | null {
  const day = dayNumber(date);
  const year = date.getFullYear();
  for (const id of FESTIVAL_ORDER) {
    for (const y of [year - 1, year, year + 1]) {
      const festival = getFestivalDate(id, y);
      if (festival && Math.abs(dayNumber(festival) - day) <= FESTIVAL_WINDOW_RADIUS) {
        return id;
      }
    }
  }
  return null;
}
