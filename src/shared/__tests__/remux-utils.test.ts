import { describe, it, expect } from 'vitest';
import { buildRemuxPlan, buildAndValidateRemuxPlan, buildPrimaryStreamMaps } from '../remux-utils';
import { ErrorCode } from '../errors';
import { ATTACHED_PIC_DISPOSITION } from '../transcoder-constants';
import type { MediaStreamInfo } from '../types';

/**
 * Builds a minimal MediaStreamInfo.
 * @param {Partial<MediaStreamInfo>} overrides - Fields to set on the fixture.
 * @returns {MediaStreamInfo} A stream the mapper accepts.
 */
function stream(overrides: Partial<MediaStreamInfo>): MediaStreamInfo {
  return { index: 0, type: 'video', codec: 'h264', ...overrides };
}

describe('buildPrimaryStreamMaps', () => {
  it('maps each stream to its per-type ordinal', () => {
    const maps = buildPrimaryStreamMaps([
      stream({ index: 0, type: 'video' }),
      stream({ index: 1, type: 'audio', codec: 'aac' }),
      stream({ index: 2, type: 'video' }),
    ]);
    expect(maps).toEqual(['0:v:0', '0:a:0', '0:v:1']);
  });

  it('drops attached_pic cover art and closes the ordinal gap', () => {
    const maps = buildPrimaryStreamMaps([
      stream({ index: 0, type: 'video' }),
      stream({ index: 1, type: 'video', disposition: [ATTACHED_PIC_DISPOSITION] }),
      stream({ index: 2, type: 'audio', codec: 'aac' }),
    ]);
    // The cover art must not appear, and the second real video must be v:1,
    // not v:2 - a gap would emit an "index out of range" FFmpeg error.
    expect(maps).toEqual(['0:v:0', '0:a:0']);
  });

  it('keeps streams whose disposition is default or forced_default', () => {
    const maps = buildPrimaryStreamMaps([
      stream({ index: 0, type: 'video', disposition: ['default'] }),
      stream({ index: 1, type: 'audio', codec: 'aac', disposition: ['forced_default'] }),
    ]);
    expect(maps).toEqual(['0:v:0', '0:a:0']);
  });

  it('skips cover art wherever it sits in the stream order', () => {
    const maps = buildPrimaryStreamMaps([
      stream({ index: 0, type: 'video', disposition: [ATTACHED_PIC_DISPOSITION] }),
      stream({ index: 1, type: 'video', disposition: ['default'] }),
    ]);
    // The kept stream carries a disposition of its own, so this also fails if
    // the skip test ever degrades into "skip anything with a disposition".
    expect(maps).toEqual(['0:v:0']);
  });

  it('does not let cover art consume an audio ordinal', () => {
    const maps = buildPrimaryStreamMaps([
      stream({ index: 0, type: 'audio', codec: 'aac' }),
      stream({ index: 1, type: 'audio', codec: 'aac', disposition: [ATTACHED_PIC_DISPOSITION] }),
      stream({ index: 2, type: 'audio', codec: 'aac' }),
    ]);
    expect(maps).toEqual(['0:a:0', '0:a:1']);
  });

  it('omits subtitles only when includeSubtitles is false', () => {
    const streams = [stream({ index: 0, type: 'video' }), stream({ index: 1, type: 'subtitle', codec: 'subrip' })];
    expect(buildPrimaryStreamMaps(streams)).toEqual(['0:v:0', '0:s:0']);
    expect(buildPrimaryStreamMaps(streams, false)).toEqual(['0:v:0']);
  });
});

describe('buildRemuxPlan', () => {
  it('derives the output path from the container', () => {
    const plan = buildRemuxPlan({ input: '/in/movie.anything', container: 'mkv' });
    expect(plan.output).toBe('/in/movie.mkv');
    expect(plan.output).not.toBe('/in/movie.anything');
  });

  it('keeps copy mode and empty maps by default', () => {
    const plan = buildRemuxPlan({ input: 'movie.mkv', container: 'mp4' });
    expect(plan.options.copy).toBe(true);
    expect(plan.options.map).toEqual([]);
    expect(plan.options.extraArgs).toEqual([]);
  });

  it('defaults copyChapters to true when no chapters file is given', () => {
    const plan = buildRemuxPlan({ input: 'movie.mkv', container: 'mp4' });
    expect(plan.options.copyChapters).toBe(true);
  });

  it('favors a chaptersFile over copyChapters', () => {
    const plan = buildRemuxPlan({ input: 'movie.mkv', container: 'mkv', chaptersFile: 'chapters.txt' });
    expect(plan.options.chaptersFile).toBe('chapters.txt');
    expect(plan.options.copyChapters).toBeUndefined();
  });

  it('honors copyChapters false', () => {
    const plan = buildRemuxPlan({ input: 'movie.mkv', container: 'mkv', copyChapters: false });
    expect(plan.options.copyChapters).toBe(false);
  });

  it('applies the re-read sync trick and strips primary audio maps', () => {
    const plan = buildRemuxPlan({
      input: 'in.mkv',
      container: 'mkv',
      maps: ['0:v:0', '0:a:0', '0:a:1'],
      audioSyncSeconds: 1.5,
    });
    expect(plan.options.map).toEqual(['0:v:0']);
    expect(plan.options.additionalInputs).toEqual([{ path: 'in.mkv', map: ['1:a:0', '1:a:1'], syncOffsetSeconds: 1.5 }]);
    expect(plan.options.extraArgs).toEqual(['-c:a', 'copy']);
  });

  it('indexes the re-read entry past attachments and added inputs', () => {
    const plan = buildRemuxPlan({
      input: 'in.mkv',
      container: 'mkv',
      maps: ['0:v:0', '0:a:0'],
      additionalInputs: [
        { path: 'cover.jpg', map: [], attachment: true },
        { path: 'subs.srt', map: ['2:0'] },
      ],
      audioSyncSeconds: -0.4,
    });
    const reRead = plan.options.additionalInputs?.[plan.options.additionalInputs.length - 1];
    expect(reRead).toEqual({ path: 'in.mkv', map: ['2:a:0'], syncOffsetSeconds: -0.4 });
  });

  it('omits the re-read when no primary audio is mapped', () => {
    const plan = buildRemuxPlan({
      input: 'in.mkv',
      container: 'mkv',
      maps: ['0:v:0'],
      audioSyncSeconds: 2,
    });
    expect(plan.options.additionalInputs).toEqual([]);
    expect(plan.options.extraArgs).toEqual([]);
    expect(plan.options.map).toEqual(['0:v:0']);
  });

  it('turns a stream copy into a re-encode when a filter chain is given', () => {
    const plan = buildRemuxPlan({ input: 'movie.mkv', container: 'mkv', videoFilters: ['fps=30', 'hue=s=0'] });
    expect(plan.options.copy).toBe(false);
    expect(plan.options.videoFilters).toEqual(['fps=30', 'hue=s=0']);
  });

  it('stays a lossless copy for an empty filter chain', () => {
    const plan = buildRemuxPlan({ input: 'movie.mkv', container: 'mkv', videoFilters: [] });
    expect(plan.options.copy).toBe(true);
    expect(plan.options.videoFilters ?? []).toEqual([]);
  });
});

describe('buildAndValidateRemuxPlan', () => {
  const streams: MediaStreamInfo[] = [
    { index: 0, type: 'video', codec: 'h264' },
    { index: 1, type: 'audio', codec: 'aac' },
    { index: 2, type: 'subtitle', codec: 'subrip' },
  ];

  function capturedError(fn: () => unknown): { code?: string; message?: string } {
    try {
      fn();
    } catch (err) {
      return err as { code?: string; message?: string };
    }
    return {};
  }

  it('rejects a video codec the container cannot hold', () => {
    const err = capturedError(() => buildAndValidateRemuxPlan({ input: 'movie.webm', container: 'webm', maps: ['0:v:0'] }, streams));
    expect(err.code).toBe(ErrorCode.INCOMPATIBLE_CONTAINER);
  });

  it('rejects a subtitle codec the container cannot store', () => {
    const err = capturedError(() => buildAndValidateRemuxPlan({ input: 'movie.ts', container: 'webm', maps: ['0:s:0'] }, streams));
    expect(err.code).toBe(ErrorCode.INCOMPATIBLE_CONTAINER);
  });

  it('passes clean remuxes and returns warnings', () => {
    const result = buildAndValidateRemuxPlan({ input: 'movie.mkv', container: 'mp4', maps: ['0:v:0', '0:a:0', '0:s:0'] }, streams);
    expect(result.output).toBe('movie.mp4');
    expect(result.options.map).toEqual(['0:v:0', '0:a:0', '0:s:0']);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('reports filters_force_reencode once a filter chain forces a re-encode', () => {
    const result = buildAndValidateRemuxPlan(
      { input: 'movie.mkv', container: 'mkv', maps: ['0:v:0', '0:a:0'], videoFilters: ['fps=30'] },
      streams,
    );
    expect(result.warnings.some((w) => w.code === 'filters_force_reencode')).toBe(true);
    expect(result.options.copy).toBe(false);
  });

  it('does not report filters_force_reencode for a lossless copy', () => {
    const result = buildAndValidateRemuxPlan({ input: 'movie.mkv', container: 'mkv', maps: ['0:v:0', '0:a:0'] }, streams);
    expect(result.warnings.some((w) => w.code === 'filters_force_reencode')).toBe(false);
  });
});
