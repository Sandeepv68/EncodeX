import { describe, it, expect } from 'vitest';
import { buildRemuxPlan, buildAndValidateRemuxPlan } from '../remux-utils';
import { ErrorCode } from '../errors';

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
  const streams = [
    { index: 0, type: 'video', codec: 'h264' },
    { index: 1, type: 'audio', codec: 'aac' },
    { index: 2, type: 'subtitle', codec: 'subrip' },
  ] as const;

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
