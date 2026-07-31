import { describe, it, expect } from 'vitest';
import { parseRatio, mapFfprobeData } from '../ffprobe-mapper';
import type { ProbeData } from '../ffprobe-mapper';

describe('parseRatio', () => {
  it('parses simple fractions', () => {
    expect(parseRatio('25/1')).toBe('25.00');
    expect(parseRatio('30000/1001')).toBe('29.97');
  });

  it('returns the ratio unchanged when malformed or den is zero', () => {
    expect(parseRatio('unknown')).toBe('unknown');
    expect(parseRatio('0/0')).toBe('0/0');
  });
});

describe('mapFfprobeData', () => {
  it('maps stream and format fields', () => {
    const data: ProbeData = {
      streams: [
        {
          index: 1,
          codec_type: 'video',
          codec_name: 'h264',
          codec_long_name: 'H.264 / AVC',
          width: 1920,
          height: 1080,
          pix_fmt: 'yuv420p',
          r_frame_rate: '30000/1001',
          bit_rate: 1000000,
          duration: 10.5,
        },
        {
          codec_type: 'audio',
          codec_name: 'aac',
          sample_rate: 48000,
          channels: 2,
          bit_rate: '128000',
          tags: { language: 'eng' },
        },
      ],
      format: {
        filename: 'video.mp4',
        format_name: 'mp4',
        size: 2000000,
        duration: '12.34',
        bit_rate: 800000,
      },
    };
    const info = mapFfprobeData(data, 'fallback.mp4');
    expect(info.file).toBe('video.mp4');
    expect(info.format).toBe('mp4');
    expect(info.size).toBe(2000000);
    expect(info.duration).toBe(12.34);
    expect(info.bitrate).toBe('800000');
    expect(info.streams).toHaveLength(2);
    expect(info.streams[0]).toMatchObject({
      index: 1,
      type: 'video',
      codec: 'h264',
      codecLong: 'H.264 / AVC',
      width: 1920,
      height: 1080,
      pixelFormat: 'yuv420p',
      frameRate: '29.97',
      bitrate: '1000000',
      duration: 10.5,
    });
    expect(info.streams[1]).toMatchObject({
      index: 0,
      type: 'audio',
      codec: 'aac',
      sampleRate: 48000,
      channels: 2,
      bitrate: '128000',
      language: 'eng',
    });
  });

  it('uses the fallback file and defaults when data is empty', () => {
    const info = mapFfprobeData({}, 'fallback.mp4');
    expect(info.file).toBe('fallback.mp4');
    expect(info.format).toBe('unknown');
    expect(info.size).toBe(0);
    expect(info.duration).toBe(0);
    expect(info.bitrate).toBe('N/A');
    expect(info.streams).toEqual([]);
  });

  it('falls back to defaults for sparse stream entries', () => {
    const info = mapFfprobeData({ streams: [{}] }, 'fallback.mp4');
    expect(info.streams[0]).toMatchObject({ index: 0, type: 'video', codec: 'unknown' });
    expect(info.streams[0].frameRate).toBeUndefined();
  });
});
