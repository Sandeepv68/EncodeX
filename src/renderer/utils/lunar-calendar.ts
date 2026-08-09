/**
 * @fileoverview Astronomical fallback dates for the lunar-calendar festivals
 * (Diwali, Holi) in the seasonal easter-egg feature.
 *
 * Diwali and Holi follow the Hindu lunisolar calendar, which cannot be
 * expressed with a fixed rule on the Gregorian calendar. The main easter-egg
 * module ({@link ../easter-egg-dates}) uses curated per-year dates for 2026-2035.
 * For any other year this module computes an approximate date from the
 * positions of the Sun and Moon using a truncated version of Meeus' lunar
 * theory (the moon is modelled with its ~20 largest periodic terms).
 *
 * The rules, validated against the curated 2026-2035 tables and well-known
 * years (Diwali 2019-2025, Holi 2019-2025):
 *  - Diwali is celebrated on the Amavasya (new moon) of the Hindu month of
 *    Kartika, i.e. the new moon whose sidereal longitude of the Sun is in
 *    Libra [180, 210). The civil date is the syzygy's UT calendar date shifted
 *    by -6 hours, approximating the Amavasya tithi day in India.
 *  - Holi is the day of colour play following the Phalguna Purnima (full
 *    moon), i.e. the first full moon after the new moon whose sidereal Sun is
 *    in Pisces [300, 330). The civil date is the syzygy's UT calendar date
 *    shifted by +18 hours, approximating the day after the Purnima tithi day.
 *
 * Panchangs themselves disagree by one day on lunar festival dates (sunrise
 * vs. pradosh conventions, regional almanacs), so the computed dates are
 * expected to be within one day of any given panchang. This is purely a
 * fallback; the curated table always wins when present.
 */

/**
 * A calendar date as month/day numbers, month is 1-based.
 * @typedef {Object} LunarDate
 * @property {number} month - Month of the year (1-12).
 * @property {number} day - Day of the month (1-31).
 */
export interface LunarDate {
  month: number;
  day: number;
}

/**
 * The sidereal epoch offset (ayanamsa) in degrees used to convert the Sun's
 * tropical longitude into the sidereal longitude that defines the Hindu
 * zodiac. Calibrated to 24.2 so the sidereal-sign selection reproduces the
 * curated 2026-2035 festival dates.
 * @const {number} AYANAMSA
 */
const AYANAMSA = 24.2;

/**
 * Sidereal Sun longitude range of the Kartika month (Libra), in degrees.
 * Diwali is the Amavasya (new moon) of Kartika.
 * @const {number} KARTIKA_MIN
 * @const {number} KARTIKA_MAX
 */
const KARTIKA_MIN = 180;
const KARTIKA_MAX = 210;

/**
 * Sidereal Sun longitude range of the Phalguna month (Pisces), in degrees.
 * Holi is the colour-play day following the Phalguna Purnima.
 * @const {number} PHALGUNA_MIN
 * @const {number} PHALGUNA_MAX
 */
const PHALGUNA_MIN = 300;
const PHALGUNA_MAX = 330;

/**
 * Hour offsets (UTC) applied to the syzygy instant before taking its calendar
 * date. -6h lands Diwali on the Indian Amavasya tithi day; +18h lands Holi on
 * the day after the Purnima tithi day. Both were tuned against the curated
 * 2026-2035 tables.
 * @const {number} DIWALI_OFFSET_HOURS
 * @const {number} HOLI_OFFSET_HOURS
 */
const DIWALI_OFFSET_HOURS = -6;
const HOLI_OFFSET_HOURS = 18;

/**
 * Julian Day of the Unix epoch (1970-01-01T00:00:00Z).
 * @const {number} UNIX_EPOCH_JD
 */
const UNIX_EPOCH_JD = 2440587.5;

/**
 * Julian day number for 0h UT of a Gregorian date (adapted from Meeus' formula
 * for the Julian calendar transition).
 * @param {number} year - Gregorian year.
 * @param {number} month - Month (1-12).
 * @param {number} day - Day of the month.
 * @returns {number} The Julian day number at 0h UT.
 */
function julianDay(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const yy = year + 4800 - a;
  const mm = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  return jdn - 0.5;
}

/**
 * Normalises an angle to [0, 360).
 * @param {number} deg - Angle in degrees.
 * @returns {number} The angle wrapped into [0, 360).
 */
function norm(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Apparent ecliptic longitude of the Sun (degrees, referred to the true
 * equinox of the date) using the low-accuracy Meeus algorithm.
 * @param {number} jde - Julian Ephemeris Day.
 * @returns {number} Solar longitude in [0, 360).
 */
function sunLongitude(jde: number): number {
  const T = (jde - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin((M * Math.PI) / 180) +
    (0.019993 - 0.000101 * T) * Math.sin((2 * M * Math.PI) / 180) +
    0.000289 * Math.sin((3 * M * Math.PI) / 180);
  const omega = 125.04 - 1934.136 * T;
  return norm(L0 + C - 0.00569 - 0.00478 * Math.sin((omega * Math.PI) / 180));
}

/**
 * Ecliptic longitude of the Moon (degrees, referred to the mean equinox of the
 * date) using the truncated Meeus series (largest 20 periodic terms).
 * @param {number} jde - Julian Ephemeris Day.
 * @returns {number} Lunar longitude in [0, 360).
 */
function moonLongitude(jde: number): number {
  const T = (jde - 2451545.0) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + Math.pow(T, 3) / 538841 - Math.pow(T, 4) / 65194000;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + Math.pow(T, 3) / 545868 - Math.pow(T, 4) / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + Math.pow(T, 3) / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + Math.pow(T, 3) / 69699 - Math.pow(T, 4) / 14712000;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T - Math.pow(T, 3) / 3526000 + Math.pow(T, 4) / 863310000;
  const e = 1 - 0.002516 * T - 0.0000074 * T * T;
  const sin = (a: number, b: number) => b * Math.sin((a * Math.PI) / 180);
  let lon = Lp;
  lon += sin(Mp, 6.288774);
  lon += sin(2 * D - Mp, 1.274027);
  lon += sin(2 * D, 0.658314);
  lon += sin(2 * Mp, 0.213618);
  lon -= sin(M, 0.185116 * e);
  lon -= sin(2 * F, 0.114332);
  lon += sin(2 * D - 2 * Mp, 0.058793);
  lon += sin(2 * D - M - Mp, 0.057066 * e);
  lon += sin(2 * D + Mp, 0.053322);
  lon += sin(2 * D - M, 0.045758 * e);
  lon -= sin(M - Mp, 0.040923);
  lon -= sin(D, 0.03472);
  lon -= sin(M + Mp, 0.030383 * e);
  lon += sin(2 * D - 2 * F, 0.015327);
  lon -= sin(2 * F + Mp, 0.012528);
  lon += sin(2 * F - Mp, 0.01098);
  lon += sin(4 * D - Mp, 0.010675);
  lon += sin(3 * Mp, 0.010034);
  lon += sin(4 * D - 2 * Mp, 0.008548);
  lon -= sin(119.75 + 131.849 * T, 0.000233);
  return norm(lon);
}

/**
 * The Sun-Moon elongation (phase angle) in [0, 360); 0 is new moon, 180 is
 * full moon.
 * @param {number} jde - Julian Ephemeris Day.
 * @returns {number} Elongation in degrees.
 */
function elongation(jde: number): number {
  return norm(moonLongitude(jde) - sunLongitude(jde));
}

/**
 * Sidereal longitude of the Sun for the given ayanamsa.
 * @param {number} jde - Julian Ephemeris Day.
 * @returns {number} Sidereal solar longitude in degrees.
 */
function siderealSun(jde: number): number {
  return norm(sunLongitude(jde) - AYANAMSA);
}

/**
 * A detected syzygy: the exact Julian Ephemeris Day and the sidereal longitude
 * of the Sun at that instant.
 * @typedef {Object} Syzygy
 * @property {number} jde - Julian Ephemeris Day of the syzygy.
 * @property {number} siderealSun - Sidereal solar longitude at the syzygy.
 */
interface Syzygy {
  jde: number;
  siderealSun: number;
}

/**
 * Finds the exact instants of new or full moons in a calendar-month window by
 * scanning daily elongations and linearly interpolating the crossing.
 * @param {number} year - The year to search.
 * @param {'new' | 'full'} phase - Which syzygy to detect.
 * @param {number} fromMonth - First month to scan (1-based, inclusive).
 * @param {number} toMonth - Last month to scan (1-based, inclusive).
 * @returns {Syzygy[]} The detected syzygies in chronological order.
 */
function findSyzygies(year: number, phase: 'new' | 'full', fromMonth: number, toMonth: number): Syzygy[] {
  const out: Syzygy[] = [];
  const start = julianDay(year, fromMonth, 1);
  const stop = julianDay(year, toMonth + 1, 1);
  for (let i = 0; i < Math.round(stop - start); i++) {
    const jd0 = start + i;
    const e1 = elongation(jd0);
    const e2 = elongation(jd0 + 1);
    let jde = 0;
    if (phase === 'new' && e1 > e2) {
      jde = jd0 + (360 - e1) / (360 - e1 + e2);
    } else if (phase === 'full' && e1 < 180 && e2 > 180) {
      jde = jd0 + (180 - e1) / (e2 - e1);
    } else {
      continue;
    }
    out.push({ jde, siderealSun: siderealSun(jde) });
  }
  return out;
}

/**
 * Converts a Julian Ephemeris Day plus an hour offset into a UTC calendar
 * date. Independent of the host timezone.
 * @param {number} jde - Julian Ephemeris Day.
 * @param {number} offsetHours - Hours to shift before taking the date.
 * @returns {LunarDate} The UTC calendar date.
 */
function syzygyDate(jde: number, offsetHours: number): LunarDate {
  const d = new Date(Math.round((jde - UNIX_EPOCH_JD + offsetHours / 24) * 86400000));
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Computes the approximate date of Diwali for a year: the Amavasya (new moon)
 * of Kartika, whose sidereal solar longitude is in Libra [180, 210).
 * @param {number} year - The Gregorian year.
 * @returns {LunarDate | null} The computed Diwali date, or null if it cannot
 * be determined.
 */
export function diwaliDate(year: number): LunarDate | null {
  const newMoons = findSyzygies(year, 'new', 9, 12);
  const kartika = newMoons.filter((s) => s.siderealSun >= KARTIKA_MIN && s.siderealSun < KARTIKA_MAX).at(-1);
  return kartika ? syzygyDate(kartika.jde, DIWALI_OFFSET_HOURS) : null;
}

/**
 * Computes the approximate date of Holi for a year: the colour-play day that
 * follows the Purnima (full moon) of Phalguna, the first full moon after the
 * new moon whose sidereal solar longitude is in Pisces [300, 330).
 * @param {number} year - The Gregorian year.
 * @returns {LunarDate | null} The computed Holi date, or null if it cannot be
 * determined.
 */
export function holiDate(year: number): LunarDate | null {
  const newMoons = findSyzygies(year, 'new', 1, 4);
  const phalgunaAmavasya = newMoons.filter((s) => s.siderealSun >= PHALGUNA_MIN && s.siderealSun < PHALGUNA_MAX).at(-1);
  if (!phalgunaAmavasya) return null;
  const fullMoons = findSyzygies(year, 'full', 1, 4);
  const phalgunaPurnima = fullMoons.find((f) => f.jde > phalgunaAmavasya.jde);
  return phalgunaPurnima ? syzygyDate(phalgunaPurnima.jde, HOLI_OFFSET_HOURS) : null;
}
