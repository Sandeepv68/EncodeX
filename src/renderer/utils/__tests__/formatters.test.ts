import { describe, it, expect } from 'vitest';
import { formatSize, formatDuration, formatBitrate, formatStreamSummary } from '../formatters';

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
