/**
 * @fileoverview Unit tests for the CLI global-option handling (cli-options.ts):
 * transcoder resolution, theme resolution, output-flag application, timeout
 * parsing, and the CliExitError used for explicit exit codes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import {
  CliExitError,
  addGlobalOptions,
  resolveTranscoderType,
  transcoderLabel,
  resolveThemeId,
  applyGlobalOptions,
  parseTimeout,
} from '../cli-options';
import { TRANSCODER_TYPES } from '../../../shared/transcoder-constants';
import { CLI_CONVERSION_TIMEOUT_MS } from '../../../shared/constants';
import { cliConfig } from '../cli-ui';

describe('CliExitError', () => {
  it('carries an exit code and sets its name', () => {
    const err = new CliExitError('boom', 7);
    expect(err.message).toBe('boom');
    expect(err.exitCode).toBe(7);
    expect(err.name).toBe('CliExitError');
  });
});

describe('addGlobalOptions', () => {
  it('registers all global flags on a command', () => {
    const cmd = new Command();
    addGlobalOptions(cmd);
    const names = cmd.options.map((o) => o.long);
    expect(names).toEqual(expect.arrayContaining(['--transcoder', '--theme', '--verbose', '--quiet', '--no-color', '--json', '--timeout']));
  });
});

describe('resolveTranscoderType', () => {
  it('returns the requested valid type', () => {
    expect(resolveTranscoderType('FFTOOL')).toBe('FFTOOL');
    expect(resolveTranscoderType('BMF')).toBe('BMF');
  });

  it('falls back to the first type for unknown or missing values', () => {
    expect(resolveTranscoderType('BOGUS')).toBe(TRANSCODER_TYPES[0]);
    expect(resolveTranscoderType(undefined)).toBe(TRANSCODER_TYPES[0]);
  });
});

describe('transcoderLabel', () => {
  it('returns a label for known types', () => {
    expect(transcoderLabel('FFMPEG')).toBeTypeOf('string');
    expect(transcoderLabel('FFMPEG').length).toBeGreaterThan(0);
  });
});

describe('resolveThemeId', () => {
  it('extracts the value after --theme', () => {
    expect(resolveThemeId(['info', 'in.mp4', '--theme', 'ocean'])).toBe('ocean');
  });

  it('extracts the value from --theme=…', () => {
    expect(resolveThemeId(['--theme=sunset', 'info'])).toBe('sunset');
  });

  it('falls back to the default theme when absent or unknown', () => {
    expect(resolveThemeId(['info'])).toBe('light');
    expect(resolveThemeId(['--theme', 'nope'])).toBe('light');
  });
});

describe('applyGlobalOptions', () => {
  const originalConfig = { ...cliConfig };

  beforeEach(() => {
    Object.assign(cliConfig, originalConfig);
    delete process.env.NO_COLOR;
    delete process.env.CI;
  });

  afterEach(() => {
    Object.assign(cliConfig, originalConfig);
    delete process.env.NO_COLOR;
    delete process.env.CI;
  });

  it('applies quiet, verbose, and machine flags', () => {
    applyGlobalOptions({ quiet: true, verbose: true, json: true });
    expect(cliConfig.quiet).toBe(true);
    expect(cliConfig.verbose).toBe(true);
    expect(cliConfig.machine).toBe(true);
  });

  it('is a no-op for an empty flag set', () => {
    applyGlobalOptions({});
    expect(cliConfig.quiet).toBe(originalConfig.quiet);
    expect(cliConfig.verbose).toBe(originalConfig.verbose);
    expect(cliConfig.machine).toBe(originalConfig.machine);
  });
});

describe('parseTimeout', () => {
  it('parses a positive number of seconds', () => {
    expect(parseTimeout({ timeout: '12' })).toBe(12);
    expect(parseTimeout({ timeout: '0.5' })).toBe(0.5);
  });

  it('falls back to the default for invalid or absent values', () => {
    expect(parseTimeout({})).toBe(CLI_CONVERSION_TIMEOUT_MS / 1000);
    expect(parseTimeout({ timeout: 'abc' })).toBe(CLI_CONVERSION_TIMEOUT_MS / 1000);
    expect(parseTimeout({ timeout: '-4' })).toBe(CLI_CONVERSION_TIMEOUT_MS / 1000);
    expect(parseTimeout({ timeout: '0' })).toBe(CLI_CONVERSION_TIMEOUT_MS / 1000);
  });
});

describe('applyGlobalOptions (integration)', () => {
  it('respects --no-color through the color flag', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    applyGlobalOptions({ color: false });
    expect(spy).toHaveBeenCalledTimes(0);
    spy.mockRestore();
    delete process.env.NO_COLOR;
  });
});
