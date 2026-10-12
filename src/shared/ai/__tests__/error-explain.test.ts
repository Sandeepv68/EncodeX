/**
 * @fileoverview Unit tests for the deterministic error explainer.
 */

import { describe, it, expect } from 'vitest';
import { explainError, isErrorCode } from '../error-explain';

describe('isErrorCode', () => {
  it('recognises known codes and rejects others', () => {
    expect(isErrorCode('FILE_NOT_FOUND')).toBe(true);
    expect(isErrorCode('NOT_A_REAL_CODE')).toBe(false);
    expect(isErrorCode(42)).toBe(false);
    expect(isErrorCode(undefined)).toBe(false);
  });
});

describe('explainError', () => {
  it('explains a known error code from the help table', () => {
    const explanation = explainError({ code: 'FILE_NOT_FOUND' });
    expect(explanation.code).toBe('FILE_NOT_FOUND');
    expect(explanation.title).toBe('File not found');
    expect(explanation.explanation).toContain('could not be found');
    expect(explanation.causes.length).toBeGreaterThan(0);
    expect(explanation.detail).toBeUndefined();
    expect(explanation.fixes).toEqual([]);
  });

  it('preserves the detail when a code is given explicitly', () => {
    const explanation = explainError({ code: 'PROBE_FAILED', detail: 'raw stderr line' });
    expect(explanation.code).toBe('PROBE_FAILED');
    expect(explanation.detail).toBe('raw stderr line');
  });

  it('infers the code from a raw message', () => {
    const explanation = explainError({ message: 'ffmpeg exited with code 1' });
    expect(explanation.code).toBe('CONVERSION_FAILED');
    expect(explanation.detail).toBe('ffmpeg exited with code 1');
  });

  it('resolves the code from detail when the message is empty', () => {
    const explanation = explainError({ code: 'NOT_A_CODE', message: '', detail: 'PROBE_FAILED' });
    expect(explanation.code).toBe('PROBE_FAILED');
    expect(explanation.detail).toBeUndefined();
  });

  it('falls back to UNKNOWN when there is no usable code, message or detail', () => {
    const explanation = explainError({ code: 'NOT_A_CODE', message: '' });
    expect(explanation.code).toBe('UNKNOWN');
    expect(explanation.title).toBe('Unexpected error');
  });

  it('suggests re-encoding when filters were combined with copy', () => {
    const explanation = explainError({
      code: 'FILTERS_REQUIRE_RE_ENCODE',
      tool: 'convert_media',
      args: { input: 'a.mp4', copy: true },
    });
    const fix = explanation.fixes.find((candidate) => candidate.kind === 'switch');
    expect(fix?.tool).toBe('convert_media');
    expect(fix?.args).toEqual({ input: 'a.mp4', copy: false });
  });

  it('suggests dropping the video filters', () => {
    const explanation = explainError({
      code: 'INVALID_VIDEO_FILTERS',
      tool: 'convert_media',
      args: { input: 'a.mp4', videoFilters: ['hflip'], filters: 'eq=1', presets: ['p'], crf: 20 },
    });
    const fix = explanation.fixes.find((candidate) => candidate.kind === 'switch');
    expect(fix?.args).toEqual({ input: 'a.mp4', crf: 20 });
  });

  it('suggests re-encoding into the container', () => {
    const explanation = explainError({
      code: 'INCOMPATIBLE_CONTAINER',
      tool: 'convert_media',
      args: { input: 'a.mp4', copy: true },
    });
    const fix = explanation.fixes.find((candidate) => candidate.kind === 'switch');
    expect(fix?.args).toEqual({ input: 'a.mp4', copy: false });
  });

  it('suggests the software encoder and a retry when hardware encoding failed', () => {
    const explanation = explainError({
      code: 'CONVERSION_FAILED',
      tool: 'convert_media',
      args: { input: 'a.mp4', hardwareAcceleration: true },
    });
    expect(explanation.fixes).toContainEqual(
      expect.objectContaining({ kind: 'switch', args: { input: 'a.mp4', hardwareAcceleration: false } }),
    );
    expect(explanation.fixes).toContainEqual(expect.objectContaining({ kind: 'retry' }));
    expect(explanation.retry).toEqual({ tool: 'convert_media', args: { input: 'a.mp4', hardwareAcceleration: true } });
  });

  it('adds a plain retry for a retryable code inferred from a message', () => {
    const explanation = explainError({ message: 'probe could not read the file', tool: 'probe_media', args: { input: 'a.mp4' } });
    expect(explanation.code).toBe('PROBE_FAILED');
    expect(explanation.fixes).toContainEqual(expect.objectContaining({ kind: 'retry', tool: 'probe_media' }));
    expect(explanation.retry).toEqual({ tool: 'probe_media', args: { input: 'a.mp4' } });
  });

  it('adds no switch fix when the failing call is unknown', () => {
    expect(explainError({ code: 'FILTERS_REQUIRE_RE_ENCODE' }).fixes).toEqual([]);
    expect(explainError({ code: 'FILE_NOT_FOUND', tool: 'convert_media', args: { input: 'a.mp4' } }).fixes).toEqual([]);
  });
});
