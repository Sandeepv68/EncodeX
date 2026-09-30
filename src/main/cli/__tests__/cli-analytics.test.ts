/**
 * @fileoverview Unit tests for the analytics events the `remux` and `demux`
 * CLI subcommands record: the shared `remux_*`/`demux_*` payloads derived from
 * the built plan/targets, silence on cancellation, and failure codes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import { EventEmitter } from 'events';

const { existsSyncMock, mkdirSyncMock, runPreparedMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(() => true),
  mkdirSyncMock: vi.fn(),
  runPreparedMock: vi.fn(async () => undefined),
}));

vi.mock('fs', () => ({
  existsSync: existsSyncMock,
  mkdirSync: mkdirSyncMock,
  default: { existsSync: existsSyncMock, mkdirSync: mkdirSyncMock },
}));
vi.mock('../cli-convert', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cli-convert')>()),
  runPreparedConversion: runPreparedMock,
}));
vi.mock('../cli-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cli-ui')>()),
  status: vi.fn(),
  warn: vi.fn(),
  success: vi.fn(),
}));
vi.mock('../../../shared/analytics/AnalyticsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/analytics/AnalyticsService')>()),
  recordAnalyticsEvent: vi.fn(),
}));

import { runRemux } from '../cli-remux';
import { runDemux } from '../cli-demux';
import { recordAnalyticsEvent } from '../../../shared/analytics/AnalyticsService';
import { cancelledError, createError, ErrorCode } from '../../../shared/errors';
import type { ITranscoder } from '../../transcoders/types';
import type { MediaInfo, MediaStreamInfo } from '../../../shared/types';

const SOURCE = path.join(path.sep === '\\' ? 'C:\\media' : '/media', 'movie.mkv');

const recordMock = vi.mocked(recordAnalyticsEvent);

/**
 * Builds a probed stream list.
 * @param {Array<{type: string; codec: string}>} defs - Stream definitions.
 * @returns {MediaStreamInfo[]} Probed streams.
 */
function streams(defs: Array<{ type: string; codec: string }>): MediaStreamInfo[] {
  return defs.map((def, index) => ({ index, ...def })) as MediaStreamInfo[];
}

const SOURCE_STREAMS = streams([
  { type: 'video', codec: 'h264' },
  { type: 'audio', codec: 'aac' },
  { type: 'subtitle', codec: 'subrip' },
]);

/**
 * Fake transcoder that only answers `getInfo`; the conversion itself is served
 * by the mocked `runPreparedConversion`.
 * @param {MediaStreamInfo[]} probed - Streams the probe reports.
 * @returns {ITranscoder} The fake transcoder.
 */
function fakeTranscoder(probed: MediaStreamInfo[]): ITranscoder {
  return {
    getInfo: async () => ({ streams: probed, duration: 60 }) as MediaInfo,
    convert: () => new EventEmitter(),
    cancel: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
    getType: () => 'FFTOOL',
  };
}

/**
 * Records captured for one analytics event name, in emission order.
 * @param {string} name - Analytics event name.
 * @returns {Array<Record<string, unknown>>} The recorded payloads.
 */
function eventsNamed(name: string): Array<Record<string, unknown>> {
  return recordMock.mock.calls
    .map((call) => call[0])
    .filter((event) => event.name === name)
    .map((event) => event.props as Record<string, unknown>);
}

beforeEach(() => {
  recordMock.mockClear();
  runPreparedMock.mockClear();
  runPreparedMock.mockResolvedValue(undefined);
  existsSyncMock.mockReturnValue(true);
});

describe('runRemux analytics', () => {
  it('reports the container, mapped streams and added assets on start and completion', async () => {
    await runRemux({
      input: SOURCE,
      flags: {
        format: 'mkv',
        addTokens: [
          { kind: 'subtitle', value: path.join(path.dirname(SOURCE), 'subs.srt'), order: 0 },
          { kind: 'audio', value: path.join(path.dirname(SOURCE), 'extra.m4a'), order: 1 },
        ],
        thumbnail: path.join(path.dirname(SOURCE), 'cover.jpg'),
        chapters: path.join(path.dirname(SOURCE), 'chapters.ffmeta'),
        audioSync: '0.5',
      },
      transcoder: fakeTranscoder(SOURCE_STREAMS),
      timeoutSeconds: 30,
      themeId: 'light',
    });

    expect(recordMock.mock.calls.flat().map((event) => event.name)).toEqual(['remux_started', 'remux_completed']);
    expect(eventsNamed('remux_started')[0]).toEqual({
      container: 'mkv',
      streamCount: 2,
      addedSubs: 1,
      addedAudio: 1,
      hasThumbnail: true,
      hasChapters: true,
      hasAudioSync: true,
    });
    expect(eventsNamed('remux_completed')[0]).toEqual(
      expect.objectContaining({ container: 'mkv', addedSubs: 1, addedAudio: 1, durationSec: expect.any(Number) }),
    );
  });

  it('reports the failure code and rethrows', async () => {
    // `ErrorCode.TRANSCODE_FAILED` never existed, so this used to reject with a
    // code of `undefined` and then assert `undefined` equalled `undefined` -
    // green, and checking nothing. The real code is `CONVERSION_FAILED`.
    runPreparedMock.mockRejectedValueOnce(createError(ErrorCode.CONVERSION_FAILED, 'boom'));
    await expect(
      runRemux({
        input: SOURCE,
        flags: { format: 'mp4' },
        transcoder: fakeTranscoder(SOURCE_STREAMS),
        timeoutSeconds: 30,
        themeId: 'light',
      }),
    ).rejects.toThrow('boom');

    expect(eventsNamed('remux_failed')).toEqual([{ container: 'mp4', code: ErrorCode.CONVERSION_FAILED }]);
    expect(eventsNamed('remux_completed')).toEqual([]);
  });

  it('stays silent when the conversion is cancelled', async () => {
    runPreparedMock.mockRejectedValueOnce(cancelledError());
    await expect(
      runRemux({
        input: SOURCE,
        flags: { format: 'mkv' },
        transcoder: fakeTranscoder(SOURCE_STREAMS),
        timeoutSeconds: 30,
        themeId: 'light',
      }),
    ).rejects.toThrow();

    expect(recordMock.mock.calls.flat().map((event) => event.name)).toEqual(['remux_started']);
  });
});

describe('runDemux analytics', () => {
  it('reports per-kind counts and converted kinds on start and completion', async () => {
    await runDemux({
      input: SOURCE,
      flags: { audio: true, audioCodec: 'mp3' },
      transcoder: fakeTranscoder(SOURCE_STREAMS),
      timeoutSeconds: 30,
      themeId: 'light',
    });

    expect(recordMock.mock.calls.flat().map((event) => event.name)).toEqual(['demux_started', 'demux_completed']);
    expect(eventsNamed('demux_started')[0]).toEqual({ kindCounts: { audio: 1 }, streamCount: 1, convertedKinds: ['audio'] });
    expect(eventsNamed('demux_completed')[0]).toEqual(
      expect.objectContaining({ kindCounts: { audio: 1 }, streamCount: 1, convertedKinds: ['audio'], durationSec: expect.any(Number) }),
    );
  });

  it('reports the failure code of the first failing target and rethrows', async () => {
    runPreparedMock.mockRejectedValueOnce(createError(ErrorCode.CONVERSION_FAILED, 'boom'));
    await expect(
      runDemux({
        input: SOURCE,
        flags: {},
        transcoder: fakeTranscoder(SOURCE_STREAMS),
        timeoutSeconds: 30,
        themeId: 'light',
      }),
    ).rejects.toThrow('boom');

    expect(runPreparedMock).toHaveBeenCalledTimes(1);
    expect(eventsNamed('demux_failed')).toEqual([
      { kindCounts: { video: 1, audio: 1, subtitle: 1 }, streamCount: 3, convertedKinds: [], code: ErrorCode.CONVERSION_FAILED },
    ]);
    expect(eventsNamed('demux_completed')).toEqual([]);
  });

  it('stays silent when the extraction is cancelled', async () => {
    runPreparedMock.mockRejectedValueOnce(cancelledError());
    await expect(
      runDemux({
        input: SOURCE,
        flags: { audio: true },
        transcoder: fakeTranscoder(SOURCE_STREAMS),
        timeoutSeconds: 30,
        themeId: 'light',
      }),
    ).rejects.toThrow();

    expect(recordMock.mock.calls.flat().map((event) => event.name)).toEqual(['demux_started']);
  });
});
