/**
 * @fileoverview Unit tests for the push-channel IPC shape guards.
 *
 * Each guard is checked in both directions: a well-formed payload is accepted and
 * a payload that fails the first dereferenced field is rejected.
 */

import { describe, it, expect } from 'vitest';
import {
  isArrayBuffer,
  isAuditEntry,
  isBoolean,
  isConversionProgress,
  isConversionProgressEvent,
  isFiniteNumber,
  isLogEntry,
  isPlayerAudioChunk,
  isPlayerFrame,
  isQueueJob,
  isQueueMovedEvent,
  isQueueProgressEvent,
  isRecord,
  isString,
  isUpdateInfo,
  isUpdateProgress,
} from '../ipc-guards';

const PROGRESS = { percent: 42, time: '00:01', fps: 30, speed: '1.0x', eta: '00:10', bitrate: '1500k' };
const JOB = { id: 'job-1', input: 'C:/a.mp4', output: 'C:/b.mp4', status: 'running', progress: 10 };

describe('primitive guards', () => {
  it('isRecord accepts plain objects and rejects arrays, null and primitives', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });

  it('isString, isBoolean and isFiniteNumber narrow their types', () => {
    expect(isString('x')).toBe(true);
    expect(isString(1)).toBe(false);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean('false')).toBe(false);
    expect(isFiniteNumber(1.5)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber('1')).toBe(false);
  });

  it('isArrayBuffer matches only real ArrayBuffers', () => {
    expect(isArrayBuffer(new ArrayBuffer(4))).toBe(true);
    expect(isArrayBuffer(new Uint8Array(4))).toBe(false);
    expect(isArrayBuffer(null)).toBe(false);
  });
});

describe('payload guards', () => {
  it('isConversionProgress requires every dereferenced field', () => {
    expect(isConversionProgress(PROGRESS)).toBe(true);
    expect(isConversionProgress({ ...PROGRESS, percent: '42' })).toBe(false);
    expect(isConversionProgress(null)).toBe(false);
  });

  it('isQueueJob checks the load-bearing fields', () => {
    expect(isQueueJob(JOB)).toBe(true);
    expect(isQueueJob({ ...JOB, id: 1 })).toBe(false);
    expect(isQueueJob({ ...JOB, progress: 'x' })).toBe(false);
    expect(isQueueJob(null)).toBe(false);
  });

  it('isPlayerFrame and isPlayerAudioChunk require byte buffers and numbers', () => {
    const frame = { data: new ArrayBuffer(4), width: 640, height: 360, pts: 0, generation: 1 };
    expect(isPlayerFrame(frame)).toBe(true);
    expect(isPlayerFrame({ ...frame, data: new Uint8Array(4) })).toBe(false);
    expect(isPlayerFrame(null)).toBe(false);

    const chunk = { data: new ArrayBuffer(4), sampleRate: 48000, channels: 2, generation: 1 };
    expect(isPlayerAudioChunk(chunk)).toBe(true);
    expect(isPlayerAudioChunk({ ...chunk, channels: '2' })).toBe(false);
    expect(isPlayerAudioChunk(null)).toBe(false);
  });

  it('isLogEntry narrows level and source to the declared unions', () => {
    expect(isLogEntry({ timestamp: 't', level: 'INFO', text: 'hi', source: 'renderer' })).toBe(true);
    expect(isLogEntry({ timestamp: 't', level: 'TRACE', text: 'hi', source: 'renderer' })).toBe(false);
    expect(isLogEntry({ timestamp: 't', level: 'INFO', text: 'hi', source: 'other' })).toBe(false);
    expect(isLogEntry(null)).toBe(false);
  });

  it('isAuditEntry checks the rendered fields', () => {
    expect(isAuditEntry({ id: '1', timestamp: 't', tool: 'convert_media', tier: 2, argsDigest: 'abcd', result: 'ok' })).toBe(true);
    expect(isAuditEntry({ id: '1', timestamp: 't', tool: 'convert_media', tier: 2, argsDigest: 'abcd', result: 'nope' })).toBe(false);
    expect(isAuditEntry(null)).toBe(false);
  });

  it('isUpdateInfo requires the nested asset', () => {
    const info = { version: '1.0.0', releaseNotes: 'notes', releaseUrl: 'https://x', asset: { fileName: 'setup.exe' } };
    expect(isUpdateInfo(info)).toBe(true);
    expect(isUpdateInfo({ ...info, asset: null })).toBe(false);
    expect(isUpdateInfo({ ...info, asset: { fileName: 7 } })).toBe(false);
    expect(isUpdateInfo({ ...info, version: undefined })).toBe(false);
    expect(isUpdateInfo(null)).toBe(false);
  });

  it('isUpdateProgress requires the three counters', () => {
    expect(isUpdateProgress({ percent: 1, transferred: 2, total: 3 })).toBe(true);
    expect(isUpdateProgress({ percent: 1, transferred: 2 })).toBe(false);
    expect(isUpdateProgress(null)).toBe(false);
  });
});

describe('event envelope guards', () => {
  it('isConversionProgressEvent checks the wrapper and the nested progress', () => {
    expect(isConversionProgressEvent({ input: 'a', output: 'b', progress: PROGRESS })).toBe(true);
    expect(isConversionProgressEvent({ input: 'a', output: 'b', progress: null })).toBe(false);
    expect(isConversionProgressEvent([])).toBe(false);
    expect(isConversionProgressEvent(null)).toBe(false);
  });

  it('isQueueProgressEvent checks the job and the nested progress', () => {
    expect(isQueueProgressEvent({ job: JOB, progress: PROGRESS })).toBe(true);
    expect(isQueueProgressEvent({ job: null, progress: PROGRESS })).toBe(false);
    expect(isQueueProgressEvent(null)).toBe(false);
  });

  it('isQueueMovedEvent checks id and toPosition', () => {
    expect(isQueueMovedEvent({ id: '1', toPosition: 2 })).toBe(true);
    expect(isQueueMovedEvent({ id: '1', toPosition: '2' })).toBe(false);
    expect(isQueueMovedEvent(null)).toBe(false);
  });
});
