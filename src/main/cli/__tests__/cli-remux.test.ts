/**
 * @fileoverview Unit tests for the `remux` CLI subcommand helpers
 * (cli-remux.ts): container resolution, stream selection, added-input
 * composition (index accounting, subtitle codecs, `--set-sync` binding),
 * cover-art handling, chapters, and the audio-sync re-read plan.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  buildAddedInputs,
  buildRemuxCliPlan,
  buildThumbnailInput,
  createRemuxAddCollector,
  defaultSubtitleCodec,
  parseAddedSubtitle,
  parseSyncSeconds,
  resolveRemuxContainer,
  resolveRemuxMaps,
  type RemuxAddToken,
} from '../cli-remux';
import { CliExitError } from '../cli-options';
import { CLI_EXIT_USAGE } from '../../../shared/constants';
import { buildFfmpegArgs } from '../../transcoders/ffmpeg-utils';
import { isAppError, ErrorCode } from '../../../shared/errors';
import type { MediaStreamInfo } from '../../../shared/types';

const SOURCE = path.join(path.sep === '\\' ? 'C:\\media' : '/media', 'movie.mkv');

/**
 * Builds a minimal probed stream list.
 * @param {Partial<MediaStreamInfo>[]} overrides - Per-stream overrides.
 * @returns {MediaStreamInfo[]} Probed streams.
 */
function streams(...overrides: Array<Partial<MediaStreamInfo>>): MediaStreamInfo[] {
  return overrides.map((override, index) => ({
    index,
    type: 'video',
    codec: 'h264',
    ...override,
  })) as MediaStreamInfo[];
}

const DEFAULT_STREAMS = streams(
  { type: 'video', codec: 'h264' },
  { type: 'audio', codec: 'aac' },
  { type: 'subtitle', codec: 'subrip' },
  { type: 'subtitle', codec: 'subrip' },
);

describe('resolveRemuxContainer', () => {
  it('prefers the explicit format flag', () => {
    expect(resolveRemuxContainer(SOURCE, { format: 'mp4' })).toBe('mp4');
  });

  it('falls back to the output extension, then the input extension', () => {
    expect(resolveRemuxContainer(SOURCE, { output: '/out/final.mov' })).toBe('mov');
    expect(resolveRemuxContainer(SOURCE, {})).toBe('mkv');
  });

  it('normalizes a leading dot and casing', () => {
    expect(resolveRemuxContainer(SOURCE, { format: '.MP4' })).toBe('mp4');
  });

  it('rejects a container-less input with a usage error', () => {
    expect(() => resolveRemuxContainer(path.join('/media', 'stream'), {})).toThrow(CliExitError);
  });
});

describe('parseSyncSeconds', () => {
  it('accepts signed decimal seconds', () => {
    expect(parseSyncSeconds('0.5', '--audio-sync')).toBe(0.5);
    expect(parseSyncSeconds('-1.25', '--set-sync')).toBe(-1.25);
  });

  it('rejects non-numeric values with a usage error', () => {
    try {
      parseSyncSeconds('soon', '--set-sync');
      expect.unreachable('expected a CliExitError');
    } catch (err) {
      expect(err).toBeInstanceOf(CliExitError);
      expect((err as CliExitError).exitCode).toBe(CLI_EXIT_USAGE);
    }
  });
});

describe('parseAddedSubtitle', () => {
  it('returns the path when no codec suffix is present', () => {
    expect(parseAddedSubtitle(path.join('/subs', 'a.srt'))).toEqual({ file: path.join('/subs', 'a.srt') });
  });

  it('splits a trailing ::codec suffix', () => {
    expect(parseAddedSubtitle('/subs/a.ass::ass')).toEqual({ file: '/subs/a.ass', codec: 'ass' });
  });

  it('keeps Windows drive letters intact', () => {
    expect(parseAddedSubtitle('C:\\subs\\a.srt::srt')).toEqual({ file: 'C:\\subs\\a.srt', codec: 'srt' });
  });

  it('rejects an empty path or empty codec', () => {
    expect(() => parseAddedSubtitle('::srt')).toThrow(/missing a file path/);
    expect(() => parseAddedSubtitle('/subs/a.srt::')).toThrow(/empty codec/);
  });
});

describe('createRemuxAddCollector', () => {
  it('records add and set-sync occurrences in command-line order', () => {
    const collector = createRemuxAddCollector();
    collector.collect('subtitle')('/subs/a.srt');
    collector.collect('setSync')('0.4');
    collector.collect('audio')('/audio/b.m4a');

    expect(collector.tokens()).toEqual([
      { kind: 'subtitle', value: '/subs/a.srt', order: 0 },
      { kind: 'setSync', value: '0.4', order: 1 },
      { kind: 'audio', value: '/audio/b.m4a', order: 2 },
    ]);
  });
});

describe('buildAddedInputs', () => {
  const token = (kind: RemuxAddToken['kind'], value: string, order: number): RemuxAddToken => ({ kind, value, order });

  it('assigns input indices in command-line order and copies added audio', () => {
    const inputs = buildAddedInputs(
      [token('subtitle', '/subs/a.srt', 0), token('subtitle', '/subs/b.srt::ass', 1), token('audio', '/audio/c.m4a', 2)],
      'mkv',
    );

    expect(inputs).toEqual([
      { path: '/subs/a.srt', map: ['1:0'], codec: 'subrip' },
      { path: '/subs/b.srt', map: ['2:0'], codec: 'ass' },
      { path: '/audio/c.m4a', map: ['3:0'], codec: 'copy' },
    ]);
  });

  it('uses the container default subtitle codec and honors --subtitle-codec', () => {
    expect(buildAddedInputs([token('subtitle', '/subs/a.srt', 0)], 'mp4')).toEqual([
      { path: '/subs/a.srt', map: ['1:0'], codec: 'mov_text' },
    ]);
    expect(buildAddedInputs([token('subtitle', '/subs/a.srt', 0)], 'mkv', 'ass')).toEqual([
      { path: '/subs/a.srt', map: ['1:0'], codec: 'ass' },
    ]);
  });

  it('binds --set-sync to the preceding add input', () => {
    const inputs = buildAddedInputs(
      [token('subtitle', '/subs/a.srt', 0), token('setSync', '0.5', 1), token('audio', '/audio/b.m4a', 2), token('setSync', '-0.25', 3)],
      'mkv',
    );

    expect(inputs[0].syncOffsetSeconds).toBe(0.5);
    expect(inputs[1].syncOffsetSeconds).toBe(-0.25);
  });

  it('rejects --set-sync with no preceding add input', () => {
    expect(() => buildAddedInputs([token('setSync', '0.5', 0)], 'mkv')).toThrow(/must follow/);
  });
});

describe('buildThumbnailInput', () => {
  it('attaches the picture for MKV/WebM without consuming an input index', () => {
    expect(buildThumbnailInput('/art/cover.jpg', 'mkv', 3)).toEqual({ path: '/art/cover.jpg', map: [], attachment: true });
  });

  it('maps the picture with an attached_pic disposition for MP4/MOV', () => {
    expect(buildThumbnailInput('/art/cover.jpg', 'mp4', 3)).toEqual({
      path: '/art/cover.jpg',
      map: ['3:0'],
      disposition: 'attached_pic',
    });
  });

  it('rejects containers that cannot store cover art', () => {
    expect(() => buildThumbnailInput('/art/cover.jpg', 'avi', 1)).toThrow(/cannot store cover art/);
  });
});

describe('resolveRemuxMaps', () => {
  it('selects every source stream by default', () => {
    expect(resolveRemuxMaps(DEFAULT_STREAMS, {})).toEqual(['0:v:0', '0:a:0', '0:s:0', '0:s:1']);
  });

  it('drops subtitle streams for --no-subtitles', () => {
    expect(resolveRemuxMaps(DEFAULT_STREAMS, { subtitles: false })).toEqual(['0:v:0', '0:a:0']);
  });

  it('skips existing cover-art streams in the default selection', () => {
    const withCover = streams({ type: 'video', codec: 'mjpeg', disposition: 'attached_pic' }, { type: 'video', codec: 'h264' });
    expect(resolveRemuxMaps(withCover, {})).toEqual(['0:v:0']);
  });

  it('passes explicit --map specs through', () => {
    expect(resolveRemuxMaps(DEFAULT_STREAMS, { map: [' 0:v:0 ', '0:a:1'] })).toEqual(['0:v:0', '0:a:1']);
  });
});

describe('defaultSubtitleCodec', () => {
  it('returns the container default and falls back to subrip', () => {
    expect(defaultSubtitleCodec('mp4')).toBe('mov_text');
    expect(defaultSubtitleCodec('mkv')).toBe('subrip');
    expect(defaultSubtitleCodec('avi')).toBe('subrip');
  });
});

describe('buildRemuxCliPlan', () => {
  it('builds a copy-mode plan with every source stream mapped', () => {
    const plan = buildRemuxCliPlan(SOURCE, { format: 'mp4' }, DEFAULT_STREAMS);

    expect(plan.container).toBe('mp4');
    expect(plan.output).toBe(path.join(path.dirname(SOURCE), 'movie.mp4'));
    expect(plan.options.copy).toBe(true);
    expect(plan.options.map).toEqual(['0:v:0', '0:a:0', '0:s:0', '0:s:1']);
    expect(plan.options.copyChapters).toBe(true);
  });

  it('honors an explicit output path', () => {
    const plan = buildRemuxCliPlan(SOURCE, { output: '/out/final.mkv', format: 'mkv' }, DEFAULT_STREAMS);
    expect(plan.output).toBe('/out/final.mkv');
  });

  it('appends the thumbnail after the added inputs and shifts its input index', () => {
    const plan = buildRemuxCliPlan(
      SOURCE,
      {
        format: 'mp4',
        addTokens: [
          { kind: 'subtitle', value: '/subs/a.srt', order: 0 },
          { kind: 'audio', value: '/audio/b.m4a', order: 1 },
        ],
        thumbnail: '/art/cover.jpg',
      },
      DEFAULT_STREAMS,
    );

    expect(plan.options.additionalInputs).toHaveLength(3);
    expect(plan.options.additionalInputs?.[2]).toEqual({ path: '/art/cover.jpg', map: ['3:0'], disposition: 'attached_pic' });
  });

  it('imports a chapters file and maps it after every added input', () => {
    const plan = buildRemuxCliPlan(
      SOURCE,
      { format: 'mkv', addTokens: [{ kind: 'audio', value: '/audio/b.m4a', order: 0 }], chapters: '/meta/ch.ffmeta' },
      DEFAULT_STREAMS,
    );

    expect(plan.options.chaptersFile).toBe('/meta/ch.ffmeta');
    const args = buildFfmpegArgs(SOURCE, plan.output, plan.options);
    expect(args[args.indexOf('-map_chapters') + 1]).toBe('2');
  });

  it('drops the source chapters for --no-chapters', () => {
    const plan = buildRemuxCliPlan(SOURCE, { format: 'mkv', copyChapters: false }, DEFAULT_STREAMS);
    expect(plan.options.copyChapters).toBe(false);
    expect(buildFfmpegArgs(SOURCE, plan.output, plan.options)).not.toContain('-map_chapters');
  });

  it('rejects a chapters file for a container that drops chapters', () => {
    expect(() => buildRemuxCliPlan(SOURCE, { format: 'avi', chapters: '/meta/ch.ffmeta' }, DEFAULT_STREAMS)).toThrow(
      /does not store chapters/,
    );
  });

  it('re-reads the primary audio for --audio-sync and stream-copies it', () => {
    const plan = buildRemuxCliPlan(SOURCE, { format: 'mkv', audioSync: '0.5' }, DEFAULT_STREAMS);

    const added = plan.options.additionalInputs ?? [];
    expect(added).toHaveLength(1);
    expect(added[0].path).toBe(SOURCE);
    expect(added[0].syncOffsetSeconds).toBe(0.5);
    expect(added[0].map).toEqual(['1:a:0']);
    expect(plan.options.map).toEqual(['0:v:0', '0:s:0', '0:s:1']);
    expect(plan.options.extraArgs).toEqual(['-c:a', 'copy']);
  });

  it('rejects an incompatible container with INCOMPATIBLE_CONTAINER', () => {
    const prores = streams({ type: 'video', codec: 'prores' }, { type: 'audio', codec: 'aac' });
    try {
      buildRemuxCliPlan(SOURCE, { format: 'mp4' }, prores);
      expect.unreachable('expected an INCOMPATIBLE_CONTAINER error');
    } catch (err) {
      expect(isAppError(err) && err.code).toBe(ErrorCode.INCOMPATIBLE_CONTAINER);
      expect((err as Error).message).toMatch(/cannot be stored in the chosen container/);
    }
  });

  it('turns the lossless copy into a re-encode when --filters is given', () => {
    const plan = buildRemuxCliPlan(SOURCE, { format: 'mkv', filters: ['fps=30', 'hue=s=0'] }, DEFAULT_STREAMS);

    expect(plan.options.copy).toBe(false);
    expect(plan.options.videoFilters).toEqual(['fps=30', 'hue=s=0']);
    expect(plan.warnings.some((w) => w.code === 'filters_force_reencode')).toBe(true);
  });

  it('expands the preset.value shorthand and comma-joins each --filters chain', () => {
    const plan = buildRemuxCliPlan(SOURCE, { format: 'mkv', filters: [' fps=30, framerate.60 ', 'deinterlace.tff'] }, DEFAULT_STREAMS);
    expect(plan.options.videoFilters).toEqual(['fps=30', 'fps=60', 'yadif=1']);
  });

  it('passes the merged chain to FFmpeg as a single -vf argument', () => {
    const plan = buildRemuxCliPlan(SOURCE, { format: 'mkv', filters: ['fps=30', 'hue=s=0'] }, DEFAULT_STREAMS);
    const args = buildFfmpegArgs(SOURCE, plan.output, plan.options);
    const vfIndex = args.indexOf('-vf');
    expect(vfIndex).toBeGreaterThan(-1);
    expect(args[vfIndex + 1]).toBe('fps=30,hue=s=0');
  });

  it('stays a lossless copy for a blank --filters chain', () => {
    const plan = buildRemuxCliPlan(SOURCE, { format: 'mkv', filters: ['  '] }, DEFAULT_STREAMS);
    expect(plan.options.copy).toBe(true);
    expect(plan.options.videoFilters ?? []).toEqual([]);
    expect(plan.warnings.some((w) => w.code === 'filters_force_reencode')).toBe(false);
  });

  it('rejects an invalid --filters chain with a usage error', () => {
    try {
      buildRemuxCliPlan(SOURCE, { format: 'mkv', filters: ['fps=30;rm -rf /'] }, DEFAULT_STREAMS);
      expect.unreachable('expected a CliExitError');
    } catch (err) {
      expect(err).toBeInstanceOf(CliExitError);
      expect((err as CliExitError).exitCode).toBe(CLI_EXIT_USAGE);
    }
  });

  it('still plans the remux when --filters selects no video stream', () => {
    const audioOnly = streams({ type: 'audio', codec: 'aac' });
    const plan = buildRemuxCliPlan(SOURCE, { format: 'mkv', map: ['0:a:0'], filters: ['fps=30'] }, audioOnly);
    expect(plan.options.videoFilters).toEqual(['fps=30']);
    expect(plan.output).toBe(path.join(path.dirname(SOURCE), 'movie.mkv'));
  });
});
