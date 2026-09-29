/**
 * @fileoverview Unit tests for the shared remux/demux categorical analytics
 * summaries (analytics-summaries.ts), the single source of the `remux_*` and
 * `demux_*` payload numbers for the GUI stores and the CLI subcommands.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { demuxAnalyticsSummary, remuxAnalyticsSummary } from '../analytics-summaries';
import type { DemuxTarget } from '../../codec-containers';
import type { ConversionOptions } from '../../types';

const SOURCE = path.join(path.sep === '\\' ? 'C:\\media' : '/media', 'movie.mkv');
const dir = path.dirname(SOURCE);

describe('remuxAnalyticsSummary', () => {
  it('counts mapped streams and classifies added inputs by extension', () => {
    const options: ConversionOptions = {
      copy: true,
      map: ['0:v:0', '0:a:0', '0:s:0'],
      additionalInputs: [
        { path: path.join(dir, 'subs.en.srt'), map: ['1:0'], codec: 'subrip' },
        { path: path.join(dir, 'subs.fr.ass'), map: ['2:0'], codec: 'ass' },
        { path: path.join(dir, 'commentary.m4a'), map: ['3:0'], codec: 'copy' },
        { path: path.join(dir, 'cover.jpg'), map: ['4:0'], disposition: 'attached_pic' },
      ],
      copyChapters: true,
    };

    expect(remuxAnalyticsSummary(options, { container: 'mkv', input: SOURCE })).toEqual({
      container: 'mkv',
      streamCount: 3,
      addedSubs: 2,
      addedAudio: 1,
      hasThumbnail: true,
      hasChapters: true,
      hasAudioSync: false,
    });
  });

  it('counts an MKV cover attachment as a thumbnail', () => {
    const options: ConversionOptions = {
      copy: true,
      additionalInputs: [{ path: path.join(dir, 'cover.png'), map: [], attachment: true }],
      copyChapters: false,
    };

    const summary = remuxAnalyticsSummary(options, { container: 'mkv', input: SOURCE });
    expect(summary.hasThumbnail).toBe(true);
    expect(summary.hasChapters).toBe(false);
    expect(summary.addedSubs).toBe(0);
    expect(summary.addedAudio).toBe(0);
  });

  it('keeps the audio-sync re-read entry out of the added-audio count', () => {
    const options: ConversionOptions = {
      copy: true,
      map: ['0:v:0', '0:a:0'],
      additionalInputs: [{ path: SOURCE, map: ['1:a:0'], syncOffsetSeconds: 0.5 }],
      copyChapters: true,
    };

    expect(remuxAnalyticsSummary(options, { container: 'mkv', input: SOURCE })).toMatchObject({
      addedAudio: 0,
      hasAudioSync: true,
    });
  });

  it('flags per-added-track offsets as audio sync', () => {
    const options: ConversionOptions = {
      copy: true,
      map: ['0:v:0', '0:a:0'],
      additionalInputs: [{ path: path.join(dir, 'commentary.m4a'), map: ['1:0'], codec: 'copy', syncOffsetSeconds: -0.25 }],
      chaptersFile: path.join(dir, 'chapters.ffmeta'),
    };

    expect(remuxAnalyticsSummary(options, { container: 'mkv', input: SOURCE })).toMatchObject({
      addedAudio: 1,
      hasAudioSync: true,
      hasChapters: true,
    });
  });

  it('ignores dots inside directory names when classifying extensions', () => {
    const options: ConversionOptions = {
      copy: true,
      additionalInputs: [{ path: path.join(dir, 'v1.2', 'notes.txt'), map: ['1:0'], codec: 'copy' }],
    };

    expect(remuxAnalyticsSummary(options, { input: SOURCE })).toMatchObject({ addedSubs: 0, addedAudio: 0 });
  });

  it('defaults the container to an empty string when the caller omits it', () => {
    expect(remuxAnalyticsSummary({ copy: true })).toEqual({
      container: '',
      streamCount: 0,
      addedSubs: 0,
      addedAudio: 0,
      hasThumbnail: false,
      hasChapters: true,
      hasAudioSync: false,
    });
  });
});

describe('demuxAnalyticsSummary', () => {
  it('counts streams per kind and lists re-encoded kinds once', () => {
    const targets: DemuxTarget[] = [
      { index: 0, kind: 'video', map: '0:v:0', copy: true, output: 'movie.video.mkv' },
      { index: 1, kind: 'audio', map: '0:a:0', copy: false, codec: 'mp3', output: 'movie.audio_0.mp3' },
      { index: 2, kind: 'audio', map: '0:a:1', copy: false, codec: 'mp3', output: 'movie.audio_1.mp3' },
      { index: 3, kind: 'subtitle', map: '0:s:0', copy: true, output: 'movie.subtitle_0.srt' },
    ];

    expect(demuxAnalyticsSummary(targets)).toEqual({
      kindCounts: { video: 1, audio: 2, subtitle: 1 },
      streamCount: 4,
      convertedKinds: ['audio'],
    });
  });

  it('returns an empty summary for no targets', () => {
    expect(demuxAnalyticsSummary([])).toEqual({ kindCounts: {}, streamCount: 0, convertedKinds: [] });
  });
});
