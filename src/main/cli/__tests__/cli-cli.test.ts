/**
 * @fileoverview Unit tests for the CLI entry module (cli.ts): the legacy flat
 * usage shim and the error-to-exit-code mapping used by the main process entry.
 */

import { describe, it, expect } from 'vitest';
import { applyLegacyShim, mapCliErrorToExitCode } from '../cli';
import { CliExitError } from '../cli-options';
import { createError, ErrorCode } from '../../../shared/errors';
import { EXIT_CODES } from '../../../shared/app-constants';
import { CLI_EXIT_TIMEOUT } from '../../../shared/constants';

describe('applyLegacyShim', () => {
  it('leaves subcommand invocations unchanged', () => {
    expect(applyLegacyShim(['info', 'in.mp4'])).toEqual(['info', 'in.mp4']);
    expect(applyLegacyShim(['convert', 'in.mp4', 'out.mp4', '--copy'])).toEqual(['convert', 'in.mp4', 'out.mp4', '--copy']);
    expect(applyLegacyShim(['batch', '*.mp4'])).toEqual(['batch', '*.mp4']);
  });

  it('prepends convert for legacy positional usage', () => {
    expect(applyLegacyShim(['in.mp4', 'out.mp4'])).toEqual(['convert', 'in.mp4', 'out.mp4']);
    expect(applyLegacyShim(['in.mp4'])).toEqual(['convert', 'in.mp4']);
    expect(applyLegacyShim(['in.mp4', '-v', 'libx264'])).toEqual(['convert', 'in.mp4', '-v', 'libx264']);
  });

  it('rewrites --info into the info subcommand', () => {
    expect(applyLegacyShim(['--info', 'in.mp4'])).toEqual(['info', 'in.mp4']);
    expect(applyLegacyShim(['in.mp4', '--info'])).toEqual(['info', 'in.mp4']);
  });

  it('returns empty args unchanged and leaves flag-only invocations alone', () => {
    expect(applyLegacyShim([])).toEqual([]);
    expect(applyLegacyShim(['--help'])).toEqual(['--help']);
    expect(applyLegacyShim(['--version'])).toEqual(['--version']);
  });

  it('prefers an explicit subcommand over the positional shim', () => {
    expect(applyLegacyShim(['info', 'in.mp4', 'out.mp4'])).toEqual(['info', 'in.mp4', 'out.mp4']);
  });
});

describe('mapCliErrorToExitCode', () => {
  it('passes through CliExitError exit codes', () => {
    expect(mapCliErrorToExitCode(new CliExitError('timeout', CLI_EXIT_TIMEOUT))).toBe(CLI_EXIT_TIMEOUT);
    expect(mapCliErrorToExitCode(new CliExitError('usage', 2))).toBe(2);
  });

  it('maps CANCELLED to the cancelled exit code', () => {
    expect(mapCliErrorToExitCode(createError(ErrorCode.CANCELLED, 'cancelled'))).toBe(EXIT_CODES.CANCELLED);
  });

  it('maps not-found errors to the not-found exit code', () => {
    expect(mapCliErrorToExitCode(createError(ErrorCode.FILE_NOT_FOUND, 'missing'))).toBe(EXIT_CODES.NOT_FOUND);
    expect(mapCliErrorToExitCode(createError(ErrorCode.FFMPEG_NOT_FOUND, 'no ffmpeg'))).toBe(EXIT_CODES.NOT_FOUND);
    expect(mapCliErrorToExitCode(createError(ErrorCode.FFPROBE_NOT_FOUND, 'no ffprobe'))).toBe(EXIT_CODES.NOT_FOUND);
  });

  it('maps anything else to the generic error exit code', () => {
    expect(mapCliErrorToExitCode(createError(ErrorCode.CONVERSION_FAILED, 'boom'))).toBe(EXIT_CODES.ERROR);
    expect(mapCliErrorToExitCode(new Error('boom'))).toBe(EXIT_CODES.ERROR);
    expect(mapCliErrorToExitCode('boom')).toBe(EXIT_CODES.ERROR);
    expect(mapCliErrorToExitCode(undefined)).toBe(EXIT_CODES.ERROR);
  });
});
