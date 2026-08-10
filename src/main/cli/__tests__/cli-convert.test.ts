/**
 * @fileoverview Unit tests for the `convert` CLI subcommand helpers
 * (cli-convert.ts): ConversionOptions construction from raw flags and output
 * path derivation. runConvert itself is covered via the CLI integration tests.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { buildConversionOptions, resolveOutputPath } from '../cli-convert';

describe('buildConversionOptions', () => {
  it('returns empty options for empty flags', () => {
    expect(buildConversionOptions({})).toEqual({});
  });

  it('maps codec, bitrate, pixel format, and scale flags', () => {
    const options = buildConversionOptions({
      videoCodec: 'libx264',
      audioCodec: 'aac',
      bitrateVideo: '2000k',
      bitrateAudio: '192k',
      pixFmt: 'yuv420p',
      scale: '1920x1080',
    });
    expect(options).toEqual({
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '2000k',
      audioBitrate: '192k',
      pixelFormat: 'yuv420p',
      scale: '1920x1080',
    });
  });

  it('sets boolean flags only for explicit false values', () => {
    expect(buildConversionOptions({ copy: true, audio: false, video: false }).copy).toBe(true);
    expect(buildConversionOptions({ copy: true, audio: false, video: false }).audio).toBe(false);
    expect(buildConversionOptions({ copy: true, audio: false, video: false }).video).toBe(false);
    expect(buildConversionOptions({}).audio).toBeUndefined();
    expect(buildConversionOptions({}).video).toBeUndefined();
  });

  it('maps qscale when in range and drops out-of-range values', () => {
    expect(buildConversionOptions({ qscale: '23' }).qscale).toBe(23);
    expect(buildConversionOptions({ qscale: '1' }).qscale).toBe(1);
    expect(buildConversionOptions({ qscale: '31' }).qscale).toBe(31);
    expect(buildConversionOptions({ qscale: '0' }).qscale).toBeUndefined();
    expect(buildConversionOptions({ qscale: '32' }).qscale).toBeUndefined();
    expect(buildConversionOptions({ qscale: 'abc' }).qscale).toBeUndefined();
  });

  it('maps trim and duration times', () => {
    const options = buildConversionOptions({ startTime: '00:00:10', endTime: '00:01:00', duration: '120' });
    expect(options.startTime).toBe('00:00:10');
    expect(options.endTime).toBe('00:01:00');
    expect(options.duration).toBe('120');
  });

  it('maps hardware acceleration flags', () => {
    expect(buildConversionOptions({ hwaccel: true }).hardwareAcceleration).toBe(true);
    expect(buildConversionOptions({ hwaccelMode: 'auto' }).hwaccelMode).toBe('auto');
  });

  it('ignores unknown codec values rather than throwing', () => {
    expect(() => buildConversionOptions({ videoCodec: 'bogus-codec' })).not.toThrow();
  });
});

describe('resolveOutputPath', () => {
  it('derives a _converted output with a container extension for known codecs', () => {
    const output = resolveOutputPath('/a/b/clip.mkv', { videoCodec: 'libx264' }, { videoCodec: 'libx264' });
    expect(output).toBe(path.join('/a/b', 'clip_converted.mp4'));
  });

  it('keeps the input extension for unknown codecs', () => {
    const output = resolveOutputPath('/a/b/clip.mkv', { videoCodec: 'bogus' }, { videoCodec: 'bogus' });
    expect(output).toBe(path.join('/a/b', 'clip_converted.mkv'));
  });

  it('keeps the input extension in copy mode', () => {
    const output = resolveOutputPath('/a/b/clip.mkv', { copy: true }, { copy: true });
    expect(output).toBe(path.join('/a/b', 'clip_converted.mkv'));
  });

  it('keeps the input extension when video is disabled (audio-only)', () => {
    const output = resolveOutputPath('/a/b/clip.mkv', { video: false }, { video: false });
    expect(output).toBe(path.join('/a/b', 'clip_converted.mkv'));
  });
});
