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
    expect(args).toEqual(['-i', 'in.mp4', '-c', 'copy', '-map_chapters', '0', '-y', 'out.mp4']);
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
    expect(args).toEqual(['-i', 'in.mp4', '-c', 'copy', '-map_chapters', '0', '-an', '-y', 'out.mp4']);
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
    expect(args).toEqual(['-i', 'in.mp4', '-c', 'copy', '-map_chapters', '0', '-y', 'out.mp4']);
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
    expect(args).toEqual(['-i', 'in.mp4', '-c', 'copy', '-metadata:s:v', 'rotate=90', '-map_chapters', '0', '-y', 'out.mp4']);
  });

  it('does not write rotation metadata for unsupported containers', () => {
    const args = buildFfmpegArgs('in.webm', 'out.webm', { copy: true, rotate: '90' });
    expect(args).toEqual(['-i', 'in.webm', '-c', 'copy', '-map_chapters', '0', '-y', 'out.webm']);
  });

  it('does not write rotation metadata when mirroring is requested', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { copy: true, rotate: '90', flipH: true });
    expect(args).not.toContain('-metadata:s:v');
  });

  it('merges user video filters after scale and rotation', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', {
      scale: '1280x720',
      rotate: '90',
      videoFilters: ['fps=30', 'eq=brightness=0.1'],
    });
    expect(args[args.indexOf('-vf') + 1]).toBe('scale=1280x720,transpose=1,fps=30,eq=brightness=0.1');
  });

  it('emits a single -vf flag when only user filters are present', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { videoFilters: ['yadif=1', 'hqdn3d=4'] });
    expect(args).toEqual(['-i', 'in.mp4', '-vf', 'yadif=1,hqdn3d=4', '-y', 'out.mp4']);
  });

  it('ignores video filters in copy mode without emitting a chain', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', { copy: true, videoFilters: ['fps=30'], rotate: '90' });
    expect(args).toEqual(['-i', 'in.mp4', '-c', 'copy', '-metadata:s:v', 'rotate=90', '-map_chapters', '0', '-y', 'out.mp4']);
    expect(args).not.toContain('-vf');
  });

  it('drops invalid filter entries while keeping scale and rotation', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', {
      scale: '1280x720',
      rotate: '90',
      videoFilters: ['fps=30', 'fps=30;rm -rf /'],
    });
    const chainIndex = args.indexOf('-vf');
    expect(chainIndex).toBeGreaterThan(-1);
    expect(args[chainIndex + 1]).toBe('scale=1280x720,transpose=1,fps=30');
  });

  it('emits -map specs for primary and additional inputs before copying', () => {
    const args = buildFfmpegArgs('in.mkv', 'out.mkv', {
      copy: true,
      map: ['0:v:0', '0:a:1'],
      additionalInputs: [{ path: 'subs.srt', map: ['1:0'] }],
      copyChapters: false,
    });
    expect(args.slice(0, 6)).toEqual(['-i', 'in.mkv', '-i', 'subs.srt', '-map', '0:v:0']);
    expect(args).toEqual([
      '-i',
      'in.mkv',
      '-i',
      'subs.srt',
      '-map',
      '0:v:0',
      '-map',
      '0:a:1',
      '-map',
      '1:0',
      '-c',
      'copy',
      '-y',
      'out.mkv',
    ]);
  });

  it('emits -itsoffset before the -i it modifies and shifts the chapters input index', () => {
    const args = buildFfmpegArgs('in.mkv', 'out.mkv', {
      copy: true,
      map: ['0:v:0', '1:a:0'],
      additionalInputs: [
        { path: 'newsong.m4a', map: ['1:0'], codec: 'copy', syncOffsetSeconds: 2 },
        { path: 'subs.srt', map: ['2:0'] },
      ],
      chaptersFile: 'chapters.txt',
    });
    expect(args).toEqual([
      '-i',
      'in.mkv',
      '-itsoffset',
      '2',
      '-i',
      'newsong.m4a',
      '-i',
      'subs.srt',
      '-i',
      'chapters.txt',
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-map',
      '1:0',
      '-map',
      '2:0',
      '-c',
      'copy',
      '-map_chapters',
      '3',
      '-y',
      'out.mkv',
    ]);
  });

  it('emits -c:s after -c copy for a subtitle conversion in copy mode', () => {
    const args = buildFfmpegArgs('in.mkv', 'out.mp4', {
      copy: true,
      map: ['0:v:0', '0:a:0', '0:s:0'],
      subtitleCodec: 'mov_text',
      copyChapters: false,
    });
    const i = args.indexOf('-c:s');
    expect(args[i - 2]).toBe('-c');
    expect(args[i - 1]).toBe('copy');
    expect(args[i + 1]).toBe('mov_text');
    expect(args).toContain('-map');
  });

  it('emits -c:s for subtitle conversions in re-encode (demux) mode', () => {
    const args = buildFfmpegArgs('in.mkv', 'out.srt', {
      copy: false,
      map: ['0:s:0'],
      subtitleCodec: 'srt',
      video: false,
      audio: false,
    });
    expect(args).toEqual(['-i', 'in.mkv', '-map', '0:s:0', '-c:s', 'srt', '-an', '-vn', '-y', 'out.srt']);
  });

  it('attaches a cover image for MKV/WebM with metadata mimetype', () => {
    const args = buildFfmpegArgs('in.mkv', 'out.mkv', {
      copy: true,
      additionalInputs: [{ path: 'cover.jpg', map: [], attachment: true }],
      copyChapters: false,
    });
    expect(args).toContain('-attach');
    expect(args[args.indexOf('-attach') + 1]).toBe('cover.jpg');
    expect(args).toContain('-metadata:s:t');
    expect(args[args.indexOf('-metadata:s:t') + 1]).toBe('mimetype=image/jpeg');
  });

  it('applies attached_pic disposition to the output video stream for MP4 covers', () => {
    const args = buildFfmpegArgs('in.mp4', 'out.mp4', {
      copy: true,
      map: ['0:v:0', '0:a:0'],
      additionalInputs: [{ path: 'cover.jpg', map: ['1:0'], disposition: 'attached_pic' }],
      copyChapters: false,
    });
    expect(args[args.indexOf('-disposition:v:1')]).toBe('-disposition:v:1');
    expect(args[args.indexOf('-disposition:v:1') + 1]).toBe('attached_pic');
  });

  it('skips chapters entirely when copyChapters is false and no chapters file exists', () => {
    const args = buildFfmpegArgs('in.mkv', 'out.mkv', { copy: true, copyChapters: false });
    expect(args).not.toContain('-map_chapters');
    expect(args).toEqual(['-i', 'in.mkv', '-c', 'copy', '-y', 'out.mkv']);
  });
});
