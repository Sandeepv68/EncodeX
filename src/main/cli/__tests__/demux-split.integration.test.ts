/**
 * @fileoverview Integration tests for the CLI demux target options.
 *
 * The unit tier covers the pure option builders with mocked inputs; this tier
 * exercises the same builders through the shared target generation so the
 * per-channel split filters are also seen by the integration coverage report
 * for the CLI surface.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { buildDemuxTargets } from '../../../shared/codec-containers';
import { demuxTargetOptions } from '../cli-demux';
import { buildFfmpegArgs } from '../../transcoders/ffmpeg-utils';
import type { MediaStreamInfo } from '../../../shared/types';

const SOURCE = path.join(path.sep === '\\' ? 'C:\\media' : '/media', 'movie.mkv');

const STREAMS: MediaStreamInfo[] = [
  { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
  { index: 1, type: 'audio', codec: 'aac', channels: 2 },
];

/**
 * Builds the CLI options for one extraction target.
 * @param {number} index - Source stream index to extract.
 * @returns {import('../../../shared/types').ConversionOptions} The CLI options for that target.
 */
function optionsFor(index: number): import('../../../shared/types').ConversionOptions {
  const targets = buildDemuxTargets(SOURCE, 'movie', STREAMS, undefined, new Set([1]));
  const target = targets.find((t) => t.index === index);
  expect(target).toBeDefined();
  return demuxTargetOptions(target!);
}

describe('demuxTargetOptions (integration)', () => {
  it('carries the per-channel audio filter onto the CLI audio options', () => {
    const options = optionsFor(1);

    expect(options.audioFilters).toEqual(['pan=mono|c0=c0']);
    expect(options.audio).toBe(true);
    expect(options.video).toBe(false);
    expect(options.extraArgs).toEqual(['-c:a', 'flac']);
  });

  it('emits the channel pan filter as an ffmpeg -af chain', () => {
    const options = optionsFor(1);
    const args = buildFfmpegArgs(SOURCE, path.join(path.dirname(SOURCE), 'movie.audio_0_ch1.flac'), options);

    const afIndex = args.indexOf('-af');
    expect(afIndex).toBeGreaterThan(-1);
    expect(args[afIndex + 1]).toBe('pan=mono|c0=c0');
  });

  it('leaves the audio options of a non-split stream without a filter chain', () => {
    const targets = buildDemuxTargets(SOURCE, 'movie', STREAMS);
    const options = demuxTargetOptions(targets.find((t) => t.kind === 'audio')!);

    expect(options.audioFilters).toBeUndefined();
  });
});
