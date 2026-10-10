/**
 * @fileoverview Unit tests for the AI layer's numeric helpers.
 */

import { describe, it, expect } from 'vitest';
import { parseBitrateKbps, toSeconds, formatBytesHuman, parseResolution } from '../units';

describe('parseBitrateKbps', () => {
  it('parses bare kbps and unit-suffixed values', () => {
    expect(parseBitrateKbps('2000k')).toBe(2000);
    expect(parseBitrateKbps('8M')).toBe(8000);
    expect(parseBitrateKbps('192')).toBe(192);
    expect(parseBitrateKbps(4500)).toBe(4500);
  });

  it('rejects unusable values', () => {
    expect(parseBitrateKbps('')).toBeUndefined();
    expect(parseBitrateKbps('fast')).toBeUndefined();
    expect(parseBitrateKbps('0')).toBeUndefined();
    expect(parseBitrateKbps('-5')).toBeUndefined();
    expect(parseBitrateKbps(undefined)).toBeUndefined();
    expect(parseBitrateKbps(null)).toBeUndefined();
  });
});

describe('toSeconds', () => {
  it('converts numeric seconds and clock strings', () => {
    expect(toSeconds('90')).toBe(90);
    expect(toSeconds(90)).toBe(90);
    expect(toSeconds('00:01:30')).toBe(90);
    expect(toSeconds('1:02:05')).toBe(3725);
  });

  it('rejects malformed or negative values', () => {
    expect(toSeconds('')).toBeUndefined();
    expect(toSeconds('abc')).toBeUndefined();
    expect(toSeconds('1:x:00')).toBeUndefined();
    expect(toSeconds(-3)).toBeUndefined();
  });
});

describe('formatBytesHuman', () => {
  it('formats binary units', () => {
    expect(formatBytesHuman(1572864)).toBe('1.5 MB');
    expect(formatBytesHuman(0)).toBe('0 B');
    expect(formatBytesHuman(1024)).toBe('1.0 KB');
    expect(formatBytesHuman(Number.NaN)).toBe('0 B');
  });
});

describe('parseResolution', () => {
  it('parses WxH strings', () => {
    expect(parseResolution('1920x1080')).toEqual({ width: 1920, height: 1080 });
    expect(parseResolution('640 X 480')).toEqual({ width: 640, height: 480 });
  });

  it('rejects non-resolution strings', () => {
    expect(parseResolution('1080p')).toBeUndefined();
    expect(parseResolution(undefined)).toBeUndefined();
  });
});
