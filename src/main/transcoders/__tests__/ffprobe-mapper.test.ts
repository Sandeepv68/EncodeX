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

  it('maps extended video/audio metadata and tags', () => {
    const data: ProbeData = {
      streams: [
        {
          index: 0,
          codec_type: 'video',
          codec_name: 'hevc',
          codec_long_name: 'H.265 / HEVC',
          codec_tag_string: 'hvc1',
          profile: 'Main 10',
          level: 120,
          width: 3840,
          height: 2160,
          pix_fmt: 'yuv420p10le',
          display_aspect_ratio: '16:9',
          color_range: 'tv',
          color_space: 'bt2020nc',
          color_transfer: 'smpte2084',
          color_primaries: 'bt2020',
          field_order: 'progressive',
          r_frame_rate: '60000/1001',
          avg_frame_rate: '50/1',
          bits_per_raw_sample: 10,
          bit_rate: '25000000',
          duration: 60,
          start_time: 0.5,
          nb_frames: 3000,
          tags: { title: 'Clip', encoder: 'libx265' },
          disposition: { default: 1, forced: 1, dub: 0 },
        },
        {
          index: 1,
          codec_type: 'audio',
          codec_name: 'aac',
          sample_fmt: 'fltp',
          sample_rate: 48000,
          channels: 2,
          channel_layout: 'stereo',
          bits_per_sample: 32,
          bit_rate: 128000,
          duration: 60,
          tags: { language: 'eng', title: 'Commentary' },
        },
      ],
      format: {
        filename: 'movie.mkv',
        format_name: 'matroska',
        format_long_name: 'Matroska / WebM',
        size: 150000000,
        duration: 60,
        bit_rate: 20000000,
        start_time: 0.5,
        probe_score: 100,
        tags: { encoder: 'libx265', creation_time: '2024-01-01T00:00:00Z' },
      },
    };
    const info = mapFfprobeData(data, 'fallback.mkv');
    expect(info.formatLong).toBe('Matroska / WebM');
    expect(info.startTime).toBe(0.5);
    expect(info.probeScore).toBe(100);
    expect(info.tags).toEqual({ encoder: 'libx265', creation_time: '2024-01-01T00:00:00Z' });
    expect(info.streams[0]).toMatchObject({
      codecTag: 'hvc1',
      profile: 'Main 10',
      level: 120,
      displayAspectRatio: '16:9',
      colorRange: 'tv',
      colorSpace: 'bt2020nc',
      colorTransfer: 'smpte2084',
      colorPrimaries: 'bt2020',
      fieldOrder: 'progressive',
      avgFrameRate: '50.00',
      bitDepth: 10,
      startTime: 0.5,
      frameCount: 3000,
      title: 'Clip',
      disposition: ['default', 'forced'],
      tags: { title: 'Clip', encoder: 'libx265' },
    });
    expect(info.streams[1]).toMatchObject({
      sampleFormat: 'fltp',
      channelLayout: 'stereo',
      bitsPerSample: 32,
      title: 'Commentary',
      language: 'eng',
    });
  });

  it('omits optional metadata when absent', () => {
    const info = mapFfprobeData({ streams: [{ codec_type: 'video', codec_name: 'h264' }], format: { format_name: 'mp4' } }, 'fallback.mp4');
    expect(info.formatLong).toBeUndefined();
    expect(info.probeScore).toBeUndefined();
    expect(info.tags).toBeUndefined();
    expect(info.streams[0].displayAspectRatio).toBeUndefined();
    expect(info.streams[0].disposition).toBeUndefined();
    expect(info.streams[0].tags).toBeUndefined();
  });
});
