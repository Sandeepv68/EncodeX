/**
 * @fileoverview Unit tests for the `demux` CLI subcommand helpers
 * (cli-demux.ts): kind-filter resolution, media-preference → options mapping,
 * target composition (output naming, re-encode flags), and the per-target
 * `ConversionOptions`.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  buildDemuxCliTargets,
  demuxMediaPreferences,
  demuxTargetOptions,
  inputStem,
  resolveDemuxKinds,
  selectDemuxStreams,
} from '../cli-demux';
import { CliExitError } from '../cli-options';
import { CLI_EXIT_USAGE } from '../../../shared/constants';
import { ERROR_MESSAGES, ErrorCode } from '../../../shared/errors';
import { buildFfmpegArgs } from '../../transcoders/ffmpeg-utils';
import type { MediaStreamInfo } from '../../../shared/types';

const SOURCE = path.join(path.sep === '\\' ? 'C:\\media' : '/media', 'movie.mkv');

/**
 * Builds a probed stream list.
 * @param {Array<{type: string; codec: string; disposition?: string}>} defs - Stream definitions.
 * @returns {MediaStreamInfo[]} Probed streams.
 */
function streams(defs: Array<{ type: string; codec: string; disposition?: string }>): MediaStreamInfo[] {
  return defs.map((def, index) => ({ index, ...def })) as MediaStreamInfo[];
}

const SOURCE_STREAMS = streams([
  { type: 'video', codec: 'h264' },
  { type: 'audio', codec: 'aac' },
  { type: 'audio', codec: 'aac' },
  { type: 'subtitle', codec: 'subrip' },
]);

describe('inputStem', () => {
  it('strips the directory and extension', () => {
    expect(inputStem(SOURCE)).toBe('movie');
    expect(inputStem(path.join('/a/b', 'my.film.part2.mkv'))).toBe('my.film.part2');
  });
});

describe('resolveDemuxKinds', () => {
  it('defaults to every kind', () => {
    expect(resolveDemuxKinds({})).toEqual(['video', 'audio', 'subtitle']);
    expect(resolveDemuxKinds({ all: true, audio: true })).toEqual(['video', 'audio', 'subtitle']);
  });

  it('honors the individual kind filters', () => {
    expect(resolveDemuxKinds({ audio: true })).toEqual(['audio']);
    expect(resolveDemuxKinds({ video: true, subtitles: true })).toEqual(['video', 'subtitle']);
  });
});

describe('demuxMediaPreferences', () => {
  it('passes through the per-kind conversion requests', () => {
    expect(demuxMediaPreferences({ videoContainer: '.MP4', audioCodec: 'MP3', subtitleFormat: 'ASS' })).toEqual({
      videoContainer: 'mp4',
      audioCodec: 'mp3',
      subtitleCodec: 'ass',
    });
  });

  it('treats copy and empty values as "no conversion"', () => {
    expect(demuxMediaPreferences({ videoContainer: 'copy', audioCodec: 'copy', subtitleFormat: 'copy' })).toEqual({});
    expect(demuxMediaPreferences({})).toEqual({});
  });

  it('normalizes and expands --video-filters into a single ordered chain', () => {
    expect(demuxMediaPreferences({ videoFilters: [' fps=30, hue=s=0 ', 'framerate.60'] })).toEqual({
      videoFilters: ['fps=30', 'hue=s=0', 'fps=60'],
    });
  });

  it('omits videoFilters when no chain is given or every chain is blank', () => {
    expect(demuxMediaPreferences({}).videoFilters).toBeUndefined();
    expect(demuxMediaPreferences({ videoFilters: [] }).videoFilters).toBeUndefined();
    expect(demuxMediaPreferences({ videoFilters: ['  ', ''] }).videoFilters).toBeUndefined();
  });
});

describe('selectDemuxStreams', () => {
  it('keeps only the requested kinds', () => {
    expect(selectDemuxStreams(SOURCE_STREAMS, ['audio'])).toHaveLength(2);
    expect(selectDemuxStreams(SOURCE_STREAMS, ['subtitle'])[0].codec).toBe('subrip');
  });

  it('drops cover-art video streams', () => {
    const withCover = streams([
      { type: 'video', codec: 'mjpeg', disposition: 'attached_pic' },
      { type: 'video', codec: 'h264' },
    ]);
    expect(selectDemuxStreams(withCover, ['video'])).toHaveLength(1);
  });
});

describe('buildDemuxCliTargets', () => {
  it('builds one target per selected stream next to the input', () => {
    const { targets, warnings } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, {});

    expect(targets.map((t) => t.output)).toEqual([
      path.join(path.dirname(SOURCE), 'movie.video.mp4'),
      path.join(path.dirname(SOURCE), 'movie.audio_0.m4a'),
      path.join(path.dirname(SOURCE), 'movie.audio_1.m4a'),
      path.join(path.dirname(SOURCE), 'movie.subtitle_0.srt'),
    ]);
    expect(targets.every((t) => t.copy)).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('resolves outputs into --output-dir', () => {
    const { targets } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { outputDir: path.join(path.dirname(SOURCE), 'parts'), audio: true });
    expect(targets.map((t) => t.output)).toEqual([
      path.join(path.dirname(SOURCE), 'parts', 'movie.audio_0.m4a'),
      path.join(path.dirname(SOURCE), 'parts', 'movie.audio_1.m4a'),
    ]);
  });

  it('re-encodes audio into the requested encoder and extension', () => {
    const { targets } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { audio: true, audioCodec: 'mp3' });
    expect(targets[0]).toMatchObject({ copy: false, codec: 'mp3' });
    expect(targets[0].output.endsWith('movie.audio_0.mp3')).toBe(true);
  });

  it('re-encodes video when the requested container differs from the codec default', () => {
    const { targets } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { video: true, videoContainer: 'mkv' });
    expect(targets[0]).toMatchObject({ copy: false, codec: 'libx264', container: 'mkv' });
    expect(targets[0].output.endsWith('movie.video.mkv')).toBe(true);
  });

  it('keeps video as a copy when the requested container matches the codec default', () => {
    const { targets } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { video: true, videoContainer: 'mp4' });
    expect(targets[0].copy).toBe(true);
  });

  it('warns and stays on copy for bitmap subtitles that cannot be converted', () => {
    const bitmap = streams([
      { type: 'video', codec: 'h264' },
      { type: 'subtitle', codec: 'dvd_subtitle' },
    ]);
    const { targets, warnings } = buildDemuxCliTargets(SOURCE, bitmap, { subtitles: true, subtitleFormat: 'srt' });

    expect(targets[0].copy).toBe(true);
    expect(targets[0].output.endsWith('.mks')).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('bitmapSubtitleWarning');
  });

  it('rejects a kind filter that matches no stream', () => {
    expect(() => buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { subtitles: false, audio: false, video: true, all: false })).not.toThrow();
    expect(() => buildDemuxCliTargets(SOURCE, [], { audio: true })).toThrow(CliExitError);
  });

  it('carries the filter chain onto a re-encoding video target', () => {
    const { targets } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, {
      video: true,
      videoContainer: 'webm',
      videoFilters: ['fps=30', 'hue=s=0'],
    });
    expect(targets[0].copy).toBe(false);
    expect(targets[0].videoFilters).toEqual(['fps=30', 'hue=s=0']);
  });

  it('rejects filters when the video target stays a stream copy', () => {
    expect(() => buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { video: true, videoFilters: ['fps=30'] })).toThrow(/--video-filters/);
  });

  it('rejects filters when no video stream is selected at all', () => {
    expect(() => buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { audio: true, videoFilters: ['fps=30'] })).toThrow(/--video-filters/);
  });

  it('rejects filters with the FILTERS_REQUIRE_RE_ENCODE message and the usage exit code', () => {
    try {
      buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { video: true, videoFilters: ['fps=30'] });
      expect.unreachable('expected a CliExitError');
    } catch (err) {
      expect(err).toBeInstanceOf(CliExitError);
      expect((err as CliExitError).message).toContain(ERROR_MESSAGES[ErrorCode.FILTERS_REQUIRE_RE_ENCODE]);
      expect((err as CliExitError).exitCode).toBe(CLI_EXIT_USAGE);
    }
  });

  it('rejects an invalid filter chain before building any target', () => {
    expect(() =>
      buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { video: true, videoContainer: 'webm', videoFilters: ['fps=30;rm -rf /'] }),
    ).toThrow(CliExitError);
  });

  it('accepts filters on a re-encoding video target without a warning', () => {
    const { warnings } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, {
      video: true,
      videoContainer: 'webm',
      videoFilters: ['fps=30'],
    });
    expect(warnings.some((w) => w.code === 'filtersIgnoredCopy')).toBe(false);
  });
});

describe('demuxTargetOptions', () => {
  it('stream-copies a video target with an -an guard', () => {
    const { targets } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { video: true });
    const options = demuxTargetOptions(targets[0]);

    expect(options).toMatchObject({ copy: true, map: ['0:v:0'], video: true, audio: false });
    expect(options.extraArgs).toBeUndefined();
    const args = buildFfmpegArgs(SOURCE, targets[0].output, options);
    expect(args).toContain('-an');
    expect(args).toContain('copy');
  });

  it('adds -vn and the audio encoder for a converting audio target', () => {
    const { targets } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { audio: true, audioCodec: 'flac' });
    const options = demuxTargetOptions(targets[0]);

    expect(options.extraArgs).toEqual(['-c:a', 'flac']);
    const args = buildFfmpegArgs(SOURCE, targets[0].output, options);
    expect(args).toContain('-vn');
    expect(args.slice(args.indexOf('-c:a'), args.indexOf('-c:a') + 2)).toEqual(['-c:a', 'flac']);
  });

  it('adds -vn/-an and the subtitle encoder for a converting subtitle target', () => {
    const { targets } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, { subtitles: true, subtitleFormat: 'ass' });
    const options = demuxTargetOptions(targets[0]);

    expect(options).toMatchObject({ copy: false, map: ['0:s:0'], video: false, audio: false });
    expect(options.extraArgs).toEqual(['-c:s', 'ass']);
    const args = buildFfmpegArgs(SOURCE, targets[0].output, options);
    expect(args).toContain('-vn');
    expect(args).toContain('-an');
  });

  it('puts the filter chain on the video options of a re-encoded video target', () => {
    const { targets } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, {
      video: true,
      videoContainer: 'webm',
      videoFilters: ['fps=30', 'hue=s=0'],
    });
    const options = demuxTargetOptions(targets[0]);

    expect(options.videoFilters).toEqual(['fps=30', 'hue=s=0']);
    const args = buildFfmpegArgs(SOURCE, targets[0].output, options);
    const vfIndex = args.indexOf('-vf');
    expect(vfIndex).toBeGreaterThan(-1);
    expect(args[vfIndex + 1]).toBe('fps=30,hue=s=0');
  });

  it('never sets videoFilters on audio or subtitle target options', () => {
    const { targets } = buildDemuxCliTargets(SOURCE, SOURCE_STREAMS, {
      video: true,
      videoContainer: 'webm',
      audio: true,
      audioCodec: 'mp3',
      subtitles: true,
      videoFilters: ['fps=30'],
    });
    const audioTarget = targets.find((t) => t.kind === 'audio');
    const subtitleTarget = targets.find((t) => t.kind === 'subtitle');
    expect(demuxTargetOptions(audioTarget!).videoFilters).toBeUndefined();
    expect(demuxTargetOptions(subtitleTarget!).videoFilters).toBeUndefined();
  });
});
