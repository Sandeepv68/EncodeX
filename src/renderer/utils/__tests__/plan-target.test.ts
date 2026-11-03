/**
 * @fileoverview Unit tests for the Copilot target-summary presentation helpers.
 */

import { describe, it, expect } from 'vitest';
import { codecDisplayName, containerDisplayName, formatTargetBitrate, formatTargetResolution } from '../plan-target';

describe('codecDisplayName', () => {
  it('maps encoder names to friendly codec labels', () => {
    expect(codecDisplayName('libx264')).toBe('H.264');
    expect(codecDisplayName('libx265')).toBe('H.265 / HEVC');
    expect(codecDisplayName('libvpx-vp9')).toBe('VP9');
    expect(codecDisplayName('aac')).toBe('AAC');
  });

  it('passes unknown codecs through unchanged', () => {
    expect(codecDisplayName('custom_enc')).toBe('custom_enc');
    expect(codecDisplayName('  libopus  ')).toBe('Opus');
  });

  it('returns undefined for missing or empty codecs', () => {
    expect(codecDisplayName(undefined)).toBeUndefined();
    expect(codecDisplayName('   ')).toBeUndefined();
  });
});

describe('formatTargetResolution', () => {
  it('formats pixel dimensions with a multiplication sign', () => {
    expect(formatTargetResolution('1280x720')).toBe('1280×720');
    expect(formatTargetResolution('1920*1080')).toBe('1920×1080');
    expect(formatTargetResolution('3840×2160')).toBe('3840×2160');
  });

  it('keeps percentage scales', () => {
    expect(formatTargetResolution('50%')).toBe('50%');
  });

  it('keeps unrecognised scales visible', () => {
    expect(formatTargetResolution('iw/2:-2')).toBe('iw/2:-2');
  });

  it('returns undefined when no scale is set', () => {
    expect(formatTargetResolution(undefined)).toBeUndefined();
    expect(formatTargetResolution('  ')).toBeUndefined();
  });
});

describe('formatTargetBitrate', () => {
  it('formats kbps values', () => {
    expect(formatTargetBitrate('128k')).toBe('128 kbps');
    expect(formatTargetBitrate(320)).toBe('320 kbps');
    expect(formatTargetBitrate('192kbps')).toBe('192 kbps');
  });

  it('formats megabit values', () => {
    expect(formatTargetBitrate('8M')).toBe('8.0 Mbps');
    expect(formatTargetBitrate(3085)).toBe('3.1 Mbps');
    expect(formatTargetBitrate(15000)).toBe('15 Mbps');
  });

  it('returns undefined for missing or invalid values', () => {
    expect(formatTargetBitrate(undefined)).toBeUndefined();
    expect(formatTargetBitrate('')).toBeUndefined();
    expect(formatTargetBitrate('N/A')).toBeUndefined();
    expect(formatTargetBitrate(0)).toBeUndefined();
    expect(formatTargetBitrate(Number.NaN)).toBeUndefined();
  });
});

describe('containerDisplayName', () => {
  it('derives an uppercase container from the output extension', () => {
    expect(containerDisplayName('/out/movie.mp4', 'mkv')).toBe('MP4');
    expect(containerDisplayName('C:\\out\\clip.MKV')).toBe('MKV');
  });

  it('falls back to the profile container without an extension', () => {
    expect(containerDisplayName('/out/movie', 'webm')).toBe('WEBM');
  });

  it('returns undefined when neither is known', () => {
    expect(containerDisplayName(undefined, undefined)).toBeUndefined();
  });
});
