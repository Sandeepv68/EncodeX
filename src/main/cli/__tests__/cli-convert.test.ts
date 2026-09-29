/**
 * @fileoverview Unit tests for the `convert` CLI subcommand helpers
 * (cli-convert.ts): ConversionOptions construction from raw flags and output
 * path derivation. runConvert itself is covered via the CLI integration tests.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { buildConversionOptions, resolveOutputPath, resolveCliVideoFilters } from '../cli-convert';
import { CliExitError } from '../cli-options';
import { CLI_EXIT_USAGE } from '../../../shared/constants';

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

  it('maps a comma-joined filter chain into ordered videoFilters entries', () => {
    const options = buildConversionOptions({ filters: 'fps=30, eq=brightness=0.1' });
    expect(options.videoFilters).toEqual(['fps=30', 'eq=brightness=0.1']);
  });

  it('expands curated presets into their default filter expressions', () => {
    const options = buildConversionOptions({ presets: ['grayscale', 'crop'] });
    expect(options.videoFilters).toEqual(['hue=s=0', 'crop=in_w:in_h']);
  });

  it('orders presets before the custom chain in the built options', () => {
    const options = buildConversionOptions({ presets: ['grayscale'], filters: 'fps=30' });
    expect(options.videoFilters).toEqual(['hue=s=0', 'fps=30']);
  });

  it('omits videoFilters when no filter flags are provided', () => {
    expect(buildConversionOptions({ videoCodec: 'libx264' }).videoFilters).toBeUndefined();
  });

  it('rejects an invalid filter chain with the usage exit code', () => {
    expect(() => buildConversionOptions({ filters: 'fps=30;rm -rf /' })).toThrowError(
      expect.objectContaining({ name: 'CliExitError', exitCode: CLI_EXIT_USAGE }),
    );
  });

  it('rejects filters combined with lossless copy', () => {
    try {
      buildConversionOptions({ filters: 'fps=30', copy: true });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(CliExitError);
      expect((err as CliExitError).exitCode).toBe(CLI_EXIT_USAGE);
    }
  });

  it('rejects an unknown preset id with the usage exit code', () => {
    expect(() => buildConversionOptions({ presets: ['nope'] })).toThrowError(expect.objectContaining({ exitCode: CLI_EXIT_USAGE }));
  });
});

describe('resolveCliVideoFilters', () => {
  it('returns an empty list for no filter flags', () => {
    expect(resolveCliVideoFilters({})).toEqual([]);
  });

  it('splits and trims a comma-joined chain', () => {
    expect(resolveCliVideoFilters({ filters: ' fps=30 , eq=brightness=0.1 ' })).toEqual(['fps=30', 'eq=brightness=0.1']);
  });

  it('throws a usage error for unknown preset ids', () => {
    expect(() => resolveCliVideoFilters({ presets: ['blurr'] })).toThrowError(expect.objectContaining({ exitCode: CLI_EXIT_USAGE }));
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
