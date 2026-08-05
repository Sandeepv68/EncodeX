import { describe, it, expect } from 'vitest';
import type { ErrorCodeType } from '../types';
import { ErrorCode, createError, isAppError, formatError, ERROR_MESSAGES, AppErrorImpl } from '../errors';

describe('ErrorCode', () => {
  it('has all expected error codes', () => {
    expect(ErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
    expect(ErrorCode.FFMPEG_NOT_FOUND).toBe('FFMPEG_NOT_FOUND');
    expect(ErrorCode.FFPROBE_NOT_FOUND).toBe('FFPROBE_NOT_FOUND');
    expect(ErrorCode.CONVERSION_FAILED).toBe('CONVERSION_FAILED');
    expect(ErrorCode.INVALID_FORMAT).toBe('INVALID_FORMAT');
    expect(ErrorCode.PROBE_FAILED).toBe('PROBE_FAILED');
    expect(ErrorCode.QUEUE_ERROR).toBe('QUEUE_ERROR');
    expect(ErrorCode.PLAYER_ERROR).toBe('PLAYER_ERROR');
    expect(ErrorCode.CANCELLED).toBe('CANCELLED');
    expect(ErrorCode.BMF_NOT_AVAILABLE).toBe('BMF_NOT_AVAILABLE');
    expect(ErrorCode.OUTPUT_NOT_SPECIFIED).toBe('OUTPUT_NOT_SPECIFIED');
    expect(ErrorCode.INPUT_NOT_SPECIFIED).toBe('INPUT_NOT_SPECIFIED');
    expect(ErrorCode.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
    expect(ErrorCode.UNKNOWN).toBe('UNKNOWN');
  });
});

describe('AppErrorImpl', () => {
  it('creates an error with correct properties', () => {
    const err = new AppErrorImpl(ErrorCode.FILE_NOT_FOUND, 'test message', 'detail');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppErrorImpl);
    expect(err.code).toBe('FILE_NOT_FOUND');
    expect(err.message).toBe('test message');
    expect(err.detail).toBe('detail');
    expect(err.timestamp).toBeGreaterThan(0);
    expect(err.name).toBe('AppError');
  });

  it('works without detail', () => {
    const err = new AppErrorImpl(ErrorCode.UNKNOWN, 'no detail');
    expect(err.detail).toBeUndefined();
  });
});

describe('createError', () => {
  it('returns an AppErrorImpl instance', () => {
    const err = createError(ErrorCode.CONVERSION_FAILED, 'failed', 'detail');
    expect(isAppError(err)).toBe(true);
    expect(err.code).toBe('CONVERSION_FAILED');
  });
});

describe('isAppError', () => {
  it('returns true for AppErrorImpl instances', () => {
    const err = new AppErrorImpl(ErrorCode.UNKNOWN, 'msg');
    expect(isAppError(err)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isAppError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isAppError(undefined)).toBe(false);
  });

  it('returns false for strings', () => {
    expect(isAppError('error')).toBe(false);
  });

  it('returns false for numbers', () => {
    expect(isAppError(42)).toBe(false);
  });

  it('returns false for plain objects missing required fields', () => {
    expect(isAppError({ message: 'msg' })).toBe(false);
    expect(isAppError({ code: 'ERR' })).toBe(false);
    expect(isAppError({})).toBe(false);
  });

  it('returns false when timestamp is not a number', () => {
    expect(isAppError({ code: 'ERR', message: 'msg', timestamp: 'now' })).toBe(false);
  });
});

describe('ERROR_MESSAGES', () => {
  it('has a message for every error code', () => {
    const codes = Object.values(ErrorCode) as ErrorCodeType[];
    for (const code of codes) {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });
});

describe('formatError', () => {
  it('passes through AppError instances unchanged', () => {
    const original = createError(ErrorCode.FILE_NOT_FOUND, 'keep me');
    const result = formatError(original);
    expect(result).toBe(original);
  });

  it('formats Error objects with message', () => {
    const result = formatError(new Error('file not found'));
    expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(result.message).toBe(ERROR_MESSAGES.FILE_NOT_FOUND);
  });

  it('formats Error objects with ffmpeg in message', () => {
    const result = formatError(new Error('ffmpeg not found'));
    expect(result.code).toBe(ErrorCode.FFMPEG_NOT_FOUND);
  });

  it('formats Error objects with ffprobe not found', () => {
    const result = formatError(new Error('ffprobe binary not found'));
    expect(result.code).toBe(ErrorCode.FFPROBE_NOT_FOUND);
  });

  it('formats ENOENT errors', () => {
    const err = new Error('no such file or directory');
    (err as NodeJS.ErrnoException).code = 'ENOENT';
    const result = formatError(err);
    expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
  });

  it('formats EACCES errors', () => {
    const err = new Error('permission denied');
    (err as NodeJS.ErrnoException).code = 'EACCES';
    const result = formatError(err);
    expect(result.code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('formats cancellation errors', () => {
    const result = formatError(new Error('operation cancelled'));
    expect(result.code).toBe(ErrorCode.CANCELLED);
  });

  it('formats conversion failures', () => {
    const result = formatError(new Error('conversion failed with exit code 1'));
    expect(result.code).toBe(ErrorCode.CONVERSION_FAILED);
  });

  it('formats BMF not available errors', () => {
    const result = formatError(new Error('BMF is not available'));
    expect(result.code).toBe(ErrorCode.BMF_NOT_AVAILABLE);
  });

  it('formats probe failures', () => {
    const result = formatError(new Error('could not read media file'));
    expect(result.code).toBe(ErrorCode.PROBE_FAILED);
  });

  it('formats invalid format errors', () => {
    const result = formatError(new Error('unsupported format'));
    expect(result.code).toBe(ErrorCode.INVALID_FORMAT);
  });

  it('formats queue errors', () => {
    const result = formatError(new Error('queue processing error'));
    expect(result.code).toBe(ErrorCode.QUEUE_ERROR);
  });

  it('formats player errors', () => {
    const result = formatError(new Error('decoder initialization failed'));
    expect(result.code).toBe(ErrorCode.PLAYER_ERROR);
  });

  it('falls back to UNKNOWN for unrecognized errors', () => {
    const result = formatError(new Error('something completely unexpected'));
    expect(result.code).toBe(ErrorCode.UNKNOWN);
  });

  it('handles string input', () => {
    const result = formatError('just a string');
    expect(result.code).toBe(ErrorCode.UNKNOWN);
    expect(result.detail).toBe('just a string');
  });

  it('handles number input', () => {
    const result = formatError(42);
    expect(result.code).toBe(ErrorCode.UNKNOWN);
    expect(result.detail).toBe('42');
  });

  it('handles null input', () => {
    const result = formatError(null);
    expect(result.code).toBe(ErrorCode.UNKNOWN);
  });

  it('handles objects without message property', () => {
    const result = formatError({ foo: 'bar' });
    expect(result.code).toBe(ErrorCode.UNKNOWN);
  });
});
