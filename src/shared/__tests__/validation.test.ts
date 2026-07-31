import { describe, it, expect } from 'vitest';
import { isValidTime, isValidScale, isValidBitrate, isInRange } from '../validation';

describe('isValidTime', () => {
  it('rejects empty or whitespace values', () => {
    expect(isValidTime('')).toBe(false);
    expect(isValidTime('   ')).toBe(false);
  });

  it('accepts non-negative numeric values', () => {
    expect(isValidTime('0')).toBe(true);
    expect(isValidTime('120')).toBe(true);
    expect(isValidTime('12.5')).toBe(true);
    expect(isValidTime('-1')).toBe(false);
  });

  it('accepts hh:mm:ss and hh:mm:ss.mmm formats', () => {
    expect(isValidTime('00:00:00')).toBe(true);
    expect(isValidTime('1:02:03')).toBe(true);
    expect(isValidTime('12:34:56.789')).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isValidTime('1:00')).toBe(false);
    expect(isValidTime('abc')).toBe(false);
    expect(isValidTime('1:02:03:04')).toBe(false);
  });
});

describe('isValidScale', () => {
  it('rejects empty or whitespace values', () => {
    expect(isValidScale('')).toBe(false);
    expect(isValidScale('  ')).toBe(false);
  });

  it('accepts percentages between 1 and 999', () => {
    expect(isValidScale('1%')).toBe(true);
    expect(isValidScale('50%')).toBe(true);
    expect(isValidScale('999%')).toBe(true);
    expect(isValidScale('0%')).toBe(false);
    expect(isValidScale('1000%')).toBe(false);
  });

  it('accepts width:height and widthxheight forms', () => {
    expect(isValidScale('1280:720')).toBe(true);
    expect(isValidScale('1280x720')).toBe(true);
    expect(isValidScale('-2:720')).toBe(true);
    expect(isValidScale('1280:-2')).toBe(true);
  });

  it('accepts positive numeric scales', () => {
    expect(isValidScale('2')).toBe(true);
    expect(isValidScale('2.5')).toBe(true);
  });

  it('rejects zero, negative and fractional-only numeric scales', () => {
    expect(isValidScale('0')).toBe(false);
    expect(isValidScale('0.5')).toBe(false);
    expect(isValidScale('-2')).toBe(false);
  });

  it('rejects junk values', () => {
    expect(isValidScale('abc')).toBe(false);
    expect(isValidScale('50px')).toBe(false);
  });
});

describe('isValidBitrate', () => {
  it('rejects empty or whitespace values', () => {
    expect(isValidBitrate('')).toBe(false);
    expect(isValidBitrate('  ')).toBe(false);
  });

  it('accepts digits with optional K/M suffix', () => {
    expect(isValidBitrate('1000')).toBe(true);
    expect(isValidBitrate('1000k')).toBe(true);
    expect(isValidBitrate('1000K')).toBe(true);
    expect(isValidBitrate('2M')).toBe(true);
    expect(isValidBitrate('1m')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isValidBitrate('abc')).toBe(false);
    expect(isValidBitrate('1000kbps')).toBe(false);
    expect(isValidBitrate('-1')).toBe(false);
  });
});

describe('isInRange', () => {
  it('accepts in-range values inclusive of bounds', () => {
    expect(isInRange(5, 0, 10)).toBe(true);
    expect(isInRange(0, 0, 10)).toBe(true);
    expect(isInRange(10, 0, 10)).toBe(true);
  });

  it('rejects out-of-range and non-finite values', () => {
    expect(isInRange(11, 0, 10)).toBe(false);
    expect(isInRange(-1, 0, 10)).toBe(false);
    expect(isInRange(NaN, 0, 10)).toBe(false);
    expect(isInRange(Infinity, 0, 10)).toBe(false);
  });
});
