import { describe, it, expect } from 'vitest';
import { buildConversionOptions, resolveOutputPath } from '../conversion-options';
import { ErrorCode } from '../../shared/errors';

describe('buildConversionOptions', () => {
  it('maps every supported field onto ConversionOptions', () => {
    const options = buildConversionOptions({
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '2000k',
      audioBitrate: '192k',
      qscale: 23,
      pixelFormat: 'yuv420p',
      scale: '1280x720',
      keepAspectRatio: true,
      rotate: '90',
      flipH: true,
      flipV: true,
      startTime: '00:00:05',
      endTime: '00:00:15',
      duration: '10',
      copy: false,
      audio: false,
      video: false,
      hardwareAcceleration: true,
      hwaccelMode: 'encode',
      extraArgs: ['-movflags', '+faststart'],
    });
    expect(options).toEqual({
      audio: false,
      video: false,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      qscale: 23,
      videoBitrate: '2000k',
      audioBitrate: '192k',
      pixelFormat: 'yuv420p',
      scale: '1280x720',
      keepAspectRatio: true,
      rotate: '90',
      flipH: true,
      flipV: true,
      startTime: '00:00:05',
      endTime: '00:00:15',
      duration: '10',
      hardwareAcceleration: true,
      hwaccelMode: 'encode',
      extraArgs: ['-movflags', '+faststart'],
    });
  });

  it('clamps out-of-range qscale instead of applying it', () => {
    expect(buildConversionOptions({ qscale: 0 }).qscale).toBeUndefined();
    expect(buildConversionOptions({ qscale: 32 }).qscale).toBeUndefined();
    expect(buildConversionOptions({ qscale: 1 }).qscale).toBe(1);
    expect(buildConversionOptions({ qscale: 31 }).qscale).toBe(31);
  });

  it('drops undefined and falsy values (copy/audio/video defaults)', () => {
    const options = buildConversionOptions({});
    expect(options).toEqual({});
    const withCopy = buildConversionOptions({ copy: true, audio: false });
    expect(withCopy).toEqual({ copy: true, audio: false });
  });

  it('merges presets then the comma chain then the explicit array into videoFilters', () => {
    const options = buildConversionOptions({
      presets: ['grayscale', 'crop'],
      filters: 'fps=30, eq=brightness=0.1',
      videoFilters: ['unsharp=5:5:0.5:5:5:0'],
    });
    expect(options.videoFilters).toEqual(['hue=s=0', 'crop=in_w:in_h', 'fps=30', 'eq=brightness=0.1', 'unsharp=5:5:0.5:5:5:0']);
  });

  it('carries a bare videoFilters array and omits the key when none are given', () => {
    expect(buildConversionOptions({ videoFilters: ['hqdn3d'] }).videoFilters).toEqual(['hqdn3d']);
    expect(buildConversionOptions({}).videoFilters).toBeUndefined();
  });

  it('does not allow filters to be combined with lossless copy', () => {
    let error: unknown;
    try {
      buildConversionOptions({ copy: true, filters: 'fps=30' });
    } catch (e) {
      error = e;
    }
    expect((error as { code: string }).code).toBe(ErrorCode.FILTERS_REQUIRE_RE_ENCODE);
  });

  it('rejects an unknown preset id', () => {
    let error: unknown;
    try {
      buildConversionOptions({ presets: ['not-a-preset'] });
    } catch (e) {
      error = e;
    }
    expect((error as { code: string }).code).toBe(ErrorCode.INVALID_VIDEO_FILTERS);
  });

  it('rejects an invalid filter entry', () => {
    let error: unknown;
    try {
      buildConversionOptions({ filters: 'fps=30;rm -rf /' });
    } catch (e) {
      error = e;
    }
    const appErr = error as { code: string; detail?: string };
    expect(appErr.code).toBe(ErrorCode.INVALID_VIDEO_FILTERS);
    expect(appErr.detail).toMatch(/Invalid video filter chain/);
  });

  it('treats extraArgs as independent from the filter chain', () => {
    const options = buildConversionOptions({ filters: 'fps=30', extraArgs: ['-movflags', '+faststart'] });
    expect(options.videoFilters).toEqual(['fps=30']);
    expect(options.extraArgs).toEqual(['-movflags', '+faststart']);
  });
});

describe('resolveOutputPath', () => {
  const input = 'C:\\media\\clip.mp4';

  it('uses the fallback container extension and _converted suffix when no codec is set', () => {
    // Mirrors the CLI: an unset codec classifies as 'other' -> mkv.
    const path = resolveOutputPath(input, {}, {});
    expect(path.toLowerCase()).toBe('c:\\media\\clip_converted.mkv');
  });

  it('switches the extension to the video codec suggestion', () => {
    const path = resolveOutputPath(input, { videoCodec: 'libvpx-vp9' }, { videoCodec: 'libvpx-vp9' });
    expect(path.toLowerCase()).toBe('c:\\media\\clip_converted.webm');
  });

  it('keeps the input extension in copy mode and when video is disabled', () => {
    const copyPath = resolveOutputPath(input, {}, { copy: true });
    expect(copyPath.toLowerCase()).toBe('c:\\media\\clip_converted.mp4');
    const noVideoPath = resolveOutputPath(input, {}, { video: false });
    expect(noVideoPath.toLowerCase()).toBe('c:\\media\\clip_converted.mp4');
  });
});
