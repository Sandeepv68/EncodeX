import { describe, it, expect } from 'vitest';
import {
  formatSize,
  formatBytes,
  formatDuration,
  formatClockTime,
  timeToSeconds,
  formatBitrate,
  formatSampleRate,
  formatStreamSummary,
} from '../formatters';

describe('formatSize', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatSize(1024 ** 3)).toBe('1.0 GB');
  });

  it('formats terabytes', () => {
    expect(formatSize(1024 ** 4)).toBe('1.0 TB');
    expect(formatSize(5 * 1024 ** 4)).toBe('5.0 TB');
  });
});

describe('formatDuration', () => {
  it('formats seconds with two decimals', () => {
    expect(formatDuration(0)).toBe('0.00s');
    expect(formatDuration(1.234)).toBe('1.23s');
    expect(formatDuration(90)).toBe('90.00s');
  });
});

describe('formatBytes', () => {
  it('guards negative and non-finite inputs', () => {
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B');
  });

  it('formats valid byte counts like formatSize', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('formatClockTime', () => {
  it('formats whole seconds without milliseconds', () => {
    expect(formatClockTime(3905)).toBe('01:05:05');
    expect(formatClockTime(0)).toBe('00:00:00');
  });

  it('includes milliseconds padded to 3 digits when present', () => {
    expect(formatClockTime(3.25)).toBe('00:00:03.250');
    expect(formatClockTime(3.062)).toBe('00:00:03.062');
  });

  it('clamps negative inputs to zero', () => {
    expect(formatClockTime(-5)).toBe('00:00:00');
  });

  it('always shows milliseconds with alwaysShowMs', () => {
    expect(formatClockTime(3, { alwaysShowMs: true })).toBe('00:00:03.000');
    expect(formatClockTime(3.25, { alwaysShowMs: true })).toBe('00:00:03.250');
  });
});

describe('timeToSeconds', () => {
  it('parses a plain number of seconds', () => {
    expect(timeToSeconds('42.5')).toBe(42.5);
    expect(timeToSeconds('0')).toBe(0);
  });

  it('parses HH:MM:SS and HH:MM:SS.mmm', () => {
    expect(timeToSeconds('01:02:03')).toBe(3723);
    expect(timeToSeconds('01:02:03.500')).toBe(3723.5);
    expect(timeToSeconds('00:00:59')).toBe(59);
  });

  it('returns null for empty or invalid input', () => {
    expect(timeToSeconds('')).toBe(null);
    expect(timeToSeconds('   ')).toBe(null);
    expect(timeToSeconds('abc')).toBe(null);
    expect(timeToSeconds('1:2')).toBe(null);
  });
});

describe('formatBitrate', () => {
  it('keeps pre-formatted bitrate strings', () => {
    expect(formatBitrate('128k')).toBe('128k');
    expect(formatBitrate('2000kbps')).toBe('2000kbps');
  });

  it('converts raw bits per second to kbps', () => {
    expect(formatBitrate('800000')).toBe('800 kbps');
  });

  it('converts raw bits per second to Mbps when large', () => {
    expect(formatBitrate('20000000')).toBe('20.0 Mbps');
  });
});

describe('formatSampleRate', () => {
  it('formats values in kHz', () => {
    expect(formatSampleRate(48000)).toBe('48 kHz');
    expect(formatSampleRate(44100)).toBe('44 kHz');
  });

  it('rounds fractional kilohertz', () => {
    expect(formatSampleRate(96000)).toBe('96 kHz');
    expect(formatSampleRate(22050)).toBe('22 kHz');
  });

  it('returns an empty string for invalid values', () => {
    expect(formatSampleRate(null)).toBe('');
    expect(formatSampleRate(undefined)).toBe('');
    expect(formatSampleRate(0)).toBe('');
    expect(formatSampleRate(-1)).toBe('');
  });
});

describe('formatStreamSummary', () => {
  it('formats a video stream with name, codec, resolution, frame rate, and bitrate', () => {
    expect(
      formatStreamSummary({
        index: 0,
        type: 'video',
        codec: 'h264',
        title: 'Main Video',
        width: 1920,
        height: 1080,
        frameRate: '29.97',
        bitrate: '4500000',
      }),
    ).toBe('Main Video · h264 · 1920×1080 · 29.97 fps · 4.5 Mbps');
  });

  it('omits the title when absent', () => {
    expect(formatStreamSummary({ index: 0, type: 'video', codec: 'hevc', width: 3840, height: 2160, bitrate: '12000k' })).toBe(
      'hevc · 3840×2160 · 12000k',
    );
  });

  it('formats an audio stream with codec, channel layout, sample rate, and bitrate', () => {
    expect(
      formatStreamSummary({
        index: 1,
        type: 'audio',
        codec: 'aac',
        title: 'Commentary',
        channels: 2,
        channelLayout: 'stereo',
        sampleRate: 48000,
        bitrate: '128000',
      }),
    ).toBe('Commentary · aac · stereo · 48 kHz · 128 kbps');
  });
});
