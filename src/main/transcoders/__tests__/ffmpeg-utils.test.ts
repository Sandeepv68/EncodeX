import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FFMPEG_FLAGS } from '../../../shared/transcoder-constants';
import type { ConversionOptions } from '../../../shared/types';

const { existsSyncMock } = vi.hoisted(() => ({ existsSyncMock: vi.fn() }));

vi.mock('fs', () => ({
  default: { existsSync: existsSyncMock },
  existsSync: existsSyncMock,
}));

vi.mock('ffmpeg-static', () => ({ default: 'C:/static/ffmpeg.exe' }));

import { getFfmpegPath, getFfprobePath, buildFfmpegArgs } from '../ffmpeg-utils';

describe('getFfmpegPath', () => {
  beforeEach(() => {
    existsSyncMock.mockReset();
  });

  it('returns the static ffmpeg path when it exists', () => {
    existsSyncMock.mockReturnValue(true);
    expect(getFfmpegPath()).toBe('C:/static/ffmpeg.exe');
  });

  it('falls back to the system ffmpeg when the static path is missing', () => {
    existsSyncMock.mockReturnValue(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getFfmpegPath()).toBe('ffmpeg');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'), expect.stringContaining('ffmpeg-static not found'));
    warnSpy.mockRestore();
  });
});

describe('getFfprobePath', () => {
  it('returns a non-empty path (static or fallback)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = getFfprobePath();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    warnSpy.mockRestore();
  });
});

describe('buildFfmpegArgs', () => {
  it('builds copy-mode args', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { copy: true });
    expect(args).toEqual(['-i', 'in.mp4', '-c', 'copy', '-y', 'out.mp4']);
  });

  it('builds args for every provided option', () => {
    const options: ConversionOptions = {
      videoCodec: 'libx265',
      audioCodec: 'aac',
      videoBitrate: '1000k',
      audioBitrate: '192k',
      qscale: 23,
      scale: '1280x720',
      pixelFormat: 'yuv420p',
      startTime: '10',
      endTime: '20',
      duration: '30',
    };
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', options);
    expect(args).toEqual([
      FFMPEG_FLAGS.INPUT,
      'in.mp4',
      FFMPEG_FLAGS.VIDEO_CODEC,
      'libx265',
      FFMPEG_FLAGS.AUDIO_CODEC,
      'aac',
      FFMPEG_FLAGS.VIDEO_BITRATE,
      '1000k',
      FFMPEG_FLAGS.AUDIO_BITRATE,
      '192k',
      FFMPEG_FLAGS.QSCALE,
      '23',
      FFMPEG_FLAGS.VIDEO_FILTER,
      `${FFMPEG_FLAGS.SCALE}1280x720`,
      FFMPEG_FLAGS.PIX_FMT,
      'yuv420p',
      FFMPEG_FLAGS.START,
      '10',
      FFMPEG_FLAGS.END,
      '20',
      FFMPEG_FLAGS.DURATION,
      '30',
      FFMPEG_FLAGS.OVERWRITE,
      'out.mp4',
    ]);
  });

  it('builds minimal args with no options', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', {});
    expect(args).toEqual(['-i', 'in.mp4', '-y', 'out.mp4']);
  });

  it('adds -an when audio is disabled', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { copy: true, audio: false });
    expect(args).toEqual(['-i', 'in.mp4', '-c', 'copy', '-an', '-y', 'out.mp4']);
  });

  it('does not add -an when audio is enabled or unspecified', () => {
    expect(buildFfmpegArgs('in.mp4', 'out.mp4', { copy: true })).not.toContain('-an');
    expect(buildFfmpegArgs('in.mp4', 'out.mp4', { copy: true, audio: true })).not.toContain('-an');
  });

  it('prepends hardware acceleration flags for hardware video codecs', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { videoCodec: 'h264_nvenc' });
    expect(args.slice(0, 6)).toEqual(['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda', '-i', 'in.mp4']);
    expect(args).toContain('-vcodec');
    expect(args).toContain('h264_nvenc');
  });

  it('does not add hardware acceleration flags in copy mode', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { copy: true, videoCodec: 'h264_nvenc' });
    expect(args).toEqual(['-i', 'in.mp4', '-c', 'copy', '-y', 'out.mp4']);
  });

  it('does not add hardware acceleration flags when hardware acceleration is disabled', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { videoCodec: 'h264_nvenc', hardwareAcceleration: false });
    expect(args).toEqual(['-i', 'in.mp4', '-vcodec', 'h264_nvenc', '-y', 'out.mp4']);
  });

  it('does not add hardware acceleration flags in encode-only mode', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { videoCodec: 'h264_nvenc', hardwareAcceleration: true, hwaccelMode: 'encode' });
    expect(args).toEqual(['-i', 'in.mp4', '-vcodec', 'h264_nvenc', '-y', 'out.mp4']);
  });

  it('adds hardware acceleration flags when enabled with automatic mode', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { videoCodec: 'h264_nvenc', hardwareAcceleration: true, hwaccelMode: 'auto' });
    expect(args.slice(0, 6)).toEqual(['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda', '-i', 'in.mp4']);
    expect(args).toContain('h264_nvenc');
  });

  it('merges rotation into the scale video filter chain', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { scale: '1280x720', rotate: '90' });
    expect(args).toEqual(['-i', 'in.mp4', '-vf', 'scale=1280x720,transpose=1', '-y', 'out.mp4']);
  });

  it('builds a single -vf flag for rotation without scale', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { rotate: '270' });
    expect(args).toEqual(['-i', 'in.mp4', '-vf', 'transpose=2', '-y', 'out.mp4']);
  });

  it('rotates 180 degrees with a double transpose', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { rotate: '180' });
    expect(args).toContain('-vf');
    expect(args[args.indexOf('-vf') + 1]).toBe('transpose=2,transpose=2');
  });

  it('appends mirror filters after rotation', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { rotate: '90', flipH: true });
    expect(args[args.indexOf('-vf') + 1]).toBe('transpose=1,hflip');
    const both = buildFfmpegArgs('in.mp4', 'out.mp4', { flipH: true, flipV: true });
    expect(both[both.indexOf('-vf') + 1]).toBe('hflip,vflip');
  });

  it('writes rotation metadata in copy mode for supported containers', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { copy: true, rotate: '90' });
    expect(args).toEqual(['-i', 'in.mp4', '-c', 'copy', '-metadata:s:v', 'rotate=90', '-y', 'out.mp4']);
  });

  it('does not write rotation metadata for unsupported containers', () => {
    const args = buildFfmpegArgs('in.webm', 'out.webm', { copy: true, rotate: '90' });
    expect(args).toEqual(['-i', 'in.webm', '-c', 'copy', '-y', 'out.webm']);
  });

  it('does not write rotation metadata when mirroring is requested', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { copy: true, rotate: '90', flipH: true });
    expect(args).not.toContain('-metadata:s:v');
  });
});
