/**
 * @fileoverview Unit tests for the dedicated mux queue guards.
 *
 * The guards sit on both sides of the mux queue IPC boundary, so every case is
 * checked with hostile, parseable JSON shapes rather than only typed objects.
 */

import { describe, it, expect } from 'vitest';
import { MAX_MUX_QUEUE_TARGETS, MUX_QUEUE_STATE_VERSION } from '../constants';
import {
  hasValidMuxTargets,
  isConversionOptionsLike,
  isMuxQueueAddPayload,
  isMuxQueueJob,
  isMuxQueueKind,
  isMuxQueueMovedEvent,
  isMuxQueueProgressEvent,
  isMuxQueueSnapshot,
  isMuxQueueTarget,
} from '../mux-queue-guards';
import { QUEUE_STATUS } from '../media-options';

const PROGRESS = { percent: 42, time: '00:01', fps: 30, speed: '1.0x', eta: '00:10', bitrate: '1500k' };

function target(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    output: 'C:/out/a.mkv',
    options: { copy: true, map: ['0'] },
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'remux',
    input: 'C:/in/a.mp4',
    output: 'C:/out/a.mkv',
    targets: [target()],
    ...overrides,
  };
}

function job(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mux-1',
    kind: 'remux',
    input: 'C:/in/a.mp4',
    output: 'C:/out/a.mkv',
    targets: [target()],
    transcoder: 'FFMPEG',
    status: QUEUE_STATUS.QUEUED,
    progress: 0,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: MUX_QUEUE_STATE_VERSION,
    concurrency: 1,
    jobs: [job()],
    ...overrides,
  };
}

describe('mux queue kinds and options', () => {
  it('accepts only remux and demux kinds', () => {
    expect(isMuxQueueKind('remux')).toBe(true);
    expect(isMuxQueueKind('demux')).toBe(true);
    expect(isMuxQueueKind('convert')).toBe(false);
    expect(isMuxQueueKind(null)).toBe(false);
  });

  it('accepts known option fields and ignores forward-compatible extras', () => {
    expect(isConversionOptionsLike({ copy: true, map: ['0'], videoFilters: ['scale=1:1'], qscale: 3 })).toBe(true);
    expect(isConversionOptionsLike({ futureField: 'ignored' })).toBe(true);
    const cyclic: Record<string, unknown> = { copy: true };
    cyclic.self = cyclic;
    expect(() => isConversionOptionsLike(cyclic)).not.toThrow();
    expect(isConversionOptionsLike(cyclic)).toBe(true);
  });

  it('rejects wrong option field types', () => {
    expect(isConversionOptionsLike({ copy: 'yes' })).toBe(false);
    expect(isConversionOptionsLike({ map: [1] })).toBe(false);
    expect(isConversionOptionsLike({ qscale: Number.NaN })).toBe(false);
    expect(isConversionOptionsLike({ rotate: '45' })).toBe(false);
    expect(isConversionOptionsLike({ additionalInputs: [{ path: 'a', map: [1] }] })).toBe(false);
    expect(isConversionOptionsLike(null)).toBe(false);
  });
});

describe('mux queue targets and payloads', () => {
  it('accepts a valid remux payload and a valid demux payload', () => {
    expect(isMuxQueueAddPayload(payload())).toBe(true);
    expect(isMuxQueueAddPayload(payload({ kind: 'demux', output: 'C:/out', targets: [target({ sourceIndex: 1 })] }))).toBe(true);
  });

  it('rejects missing fields, wrong kinds, and empty paths', () => {
    expect(isMuxQueueAddPayload(payload({ kind: 'convert' }))).toBe(false);
    expect(isMuxQueueAddPayload(payload({ input: '' }))).toBe(false);
    expect(isMuxQueueAddPayload(payload({ output: '' }))).toBe(false);
    expect(isMuxQueueAddPayload(payload({ targets: [] }))).toBe(false);
    expect(isMuxQueueAddPayload(payload({ transcoder: 'NOPE' }))).toBe(false);
    expect(isMuxQueueAddPayload(payload({ overwrite: 'yes' }))).toBe(false);
    expect(isMuxQueueAddPayload(null)).toBe(false);
  });

  it('rejects duplicate target outputs case-insensitively', () => {
    const duplicate = [target({ output: 'C:/Out/a.mkv' }), target({ output: 'c:/out/A.MKV' })];
    expect(hasValidMuxTargets(duplicate)).toBe(false);
    expect(isMuxQueueAddPayload(payload({ targets: duplicate }))).toBe(false);
  });

  it('rejects target lists above the limit', () => {
    const targets = Array.from({ length: MAX_MUX_QUEUE_TARGETS + 1 }, (_, index) => target({ output: `C:/out/${index}.mkv` }));
    expect(hasValidMuxTargets(targets)).toBe(false);
    expect(isMuxQueueAddPayload(payload({ targets }))).toBe(false);
  });

  it('rejects a target without output or with invalid options', () => {
    expect(hasValidMuxTargets([target({ output: '' })])).toBe(false);
    expect(hasValidMuxTargets([target({ options: null })])).toBe(false);
    expect(hasValidMuxTargets([target({ label: 4 })])).toBe(false);
  });

  it('rejects a target with a malformed label or source index', () => {
    expect(isMuxQueueTarget({ output: 'a.mkv', options: {}, label: 4 })).toBe(false);
    expect(isMuxQueueTarget({ output: 'a.mkv', options: {}, sourceIndex: 'x' })).toBe(false);
    expect(isMuxQueueTarget({ output: 'a.mkv', options: {}, label: 'ok', sourceIndex: 2 })).toBe(true);
  });

  it('rejects options whose string fields carry the wrong type', () => {
    expect(isConversionOptionsLike({ videoCodec: 4 })).toBe(false);
    expect(isConversionOptionsLike({ audioCodec: {} })).toBe(false);
    expect(isConversionOptionsLike({ scale: true })).toBe(false);
  });

  it('rejects additional inputs with malformed fields', () => {
    expect(isConversionOptionsLike({ additionalInputs: [{ path: 'a.srt', map: ['0'] }] })).toBe(true);
    expect(isConversionOptionsLike({ additionalInputs: [{ path: 4, map: ['0'] }] })).toBe(false);
    expect(isConversionOptionsLike({ additionalInputs: [{ path: 'a.srt', map: [1] }] })).toBe(false);
    expect(isConversionOptionsLike({ additionalInputs: [{ path: 'a.srt', map: ['0'], codec: 4 }] })).toBe(false);
    expect(isConversionOptionsLike({ additionalInputs: [{ path: 'a.srt', map: ['0'], disposition: 4 }] })).toBe(false);
    expect(isConversionOptionsLike({ additionalInputs: [{ path: 'a.srt', map: ['0'], attachment: 'yes' }] })).toBe(false);
    expect(isConversionOptionsLike({ additionalInputs: [{ path: 'a.srt', map: ['0'], syncOffsetSeconds: 'x' }] })).toBe(false);
  });
});

describe('mux queue jobs and snapshots', () => {
  it('accepts a valid job and rejects invalid status/progress', () => {
    expect(isMuxQueueJob(job())).toBe(true);
    expect(isMuxQueueJob(job({ status: 'sleeping' }))).toBe(false);
    expect(isMuxQueueJob(job({ progress: Number.POSITIVE_INFINITY }))).toBe(false);
    expect(isMuxQueueJob(job({ transcoder: 'NOPE' }))).toBe(false);
    expect(isMuxQueueJob(job({ targets: [] }))).toBe(false);
    expect(isMuxQueueJob(null)).toBe(false);
    expect(isMuxQueueJob(job({ id: '' }))).toBe(false);
    expect(isMuxQueueJob(job({ kind: 'convert' }))).toBe(false);
    expect(isMuxQueueJob(job({ input: '' }))).toBe(false);
    expect(isMuxQueueJob(job({ output: '' }))).toBe(false);
    expect(isMuxQueueJob(job({ error: 4 }))).toBe(false);
    expect(isMuxQueueJob(job({ priority: 'high' }))).toBe(false);
    expect(isMuxQueueJob(job({ paused: 'yes' }))).toBe(false);
    expect(isMuxQueueJob(job({ createdAt: 'now' }))).toBe(false);
  });

  it('accepts a valid snapshot and rejects wrong versions or partial jobs', () => {
    expect(isMuxQueueSnapshot(snapshot())).toBe(true);
    expect(isMuxQueueSnapshot(snapshot({ version: MUX_QUEUE_STATE_VERSION + 1 }))).toBe(false);
    expect(isMuxQueueSnapshot(null)).toBe(false);
    expect(isMuxQueueSnapshot(snapshot({ concurrency: 'many' }))).toBe(false);
    expect(isMuxQueueSnapshot(snapshot({ jobs: 'nope' }))).toBe(false);
    expect(isMuxQueueSnapshot(snapshot({ concurrency: Number.NaN }))).toBe(false);
    expect(isMuxQueueSnapshot(snapshot({ jobs: [job(), null] }))).toBe(false);
    expect(isMuxQueueSnapshot(snapshot({ jobs: 'not-an-array' }))).toBe(false);
  });
});

describe('mux queue push events', () => {
  it('guards progress and moved payloads', () => {
    expect(isMuxQueueProgressEvent({ job: job(), progress: PROGRESS })).toBe(true);
    expect(isMuxQueueProgressEvent({ job: job(), progress: { percent: '42' } })).toBe(false);
    expect(isMuxQueueProgressEvent({ job: null, progress: PROGRESS })).toBe(false);
    expect(isMuxQueueMovedEvent({ id: 'mux-1', toPosition: 2 })).toBe(true);
    expect(isMuxQueueMovedEvent({ id: 'mux-1', toPosition: Number.NaN })).toBe(false);
    expect(isMuxQueueMovedEvent(null)).toBe(false);
    expect(isMuxQueueProgressEvent(null)).toBe(false);
  });
});
