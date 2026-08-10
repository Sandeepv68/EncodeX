/**
 * @fileoverview Shared option definitions and global-flag handling for the
 * EncodeX CLI. Every subcommand is configured with the same global options
 * (transcoder, theme, verbosity, color, JSON, timeout) so behavior stays
 * consistent across convert/info/capabilities/batch/compress/extract-audio.
 */

import { Command } from 'commander';
import { TRANSCODER_TYPES, TRANSCODER_LABELS } from '../../shared/transcoder-constants';
import { CLI_CONVERSION_TIMEOUT_MS } from '../../shared/constants';
import { setColor, configureCliOutput } from './cli-ui';
import { isCliThemeId, DEFAULT_CLI_THEME, CliThemeId } from '../cli-logo';
import type { TranscoderType } from '../../shared/types';

/**
 * Global options that apply to every CLI subcommand. Values come from
 * `optsWithGlobals()` inside each subcommand action.
 * @interface GlobalCliOptions
 * @property {string} [transcoder] - Transcoder backend name ('FFMPEG' | 'FFTOOL' | 'BMF').
 * @property {string} [theme] - Logo color theme id.
 * @property {boolean} [verbose] - Enable verbose status output.
 * @property {boolean} [quiet] - Suppress non-error status output.
 * @property {boolean} [color] - Whether colors are enabled (from `--no-color`).
 * @property {boolean} [json] - Emit machine-readable JSON instead of tables.
 * @property {string} [timeout] - Conversion timeout in seconds.
 */
export interface GlobalCliOptions {
  transcoder?: string;
  theme?: string;
  verbose?: boolean;
  quiet?: boolean;
  color?: boolean;
  json?: boolean;
  timeout?: string;
}

/**
 * Error carrying an explicit CLI exit code.
 *
 * Thrown by subcommand handlers when a specific process exit code is required
 * (e.g. cancellation, timeout, or not-found); {@link ../cli mapCliErrorToExitCode}
 * converts it and plain errors into process exit codes.
 * @class CliExitError
 * @extends {Error}
 * @property {number} exitCode - Process exit code to use.
 */
export class CliExitError extends Error {
  exitCode: number;

  /**
   * Creates a new CliExitError.
   * @param {string} message - Human-readable error message.
   * @param {number} exitCode - Process exit code to use.
   */
  constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'CliExitError';
    this.exitCode = exitCode;
  }
}

/**
 * Registers the global options shared by all subcommands on a Commander
 * program/command.
 * @param {Command} program - The Commander program to configure.
 * @returns {void}
 */
export function addGlobalOptions(program: Command): void {
  program
    .option('--transcoder <type>', `Transcoder backend (${TRANSCODER_TYPES.join(', ')})`, TRANSCODER_TYPES[0])
    .option('--theme <id>', 'Logo color theme')
    .option('--verbose', 'Enable verbose status output')
    .option('--quiet', 'Suppress status output')
    .option('--no-color', 'Disable colored output')
    .option('--json', 'Emit machine-readable JSON instead of human tables')
    .option('--timeout <seconds>', 'Conversion timeout in seconds', String(CLI_CONVERSION_TIMEOUT_MS / 1000));
}

/**
 * Normalizes a `--transcoder` value into a valid TranscoderType, falling back
 * to the default backend when the value is unknown or absent.
 * @param {string} [value] - Raw transcoder option value.
 * @returns {TranscoderType} A valid transcoder type.
 */
export function resolveTranscoderType(value?: string): TranscoderType {
  const requested = value ?? TRANSCODER_TYPES[0];
  return (TRANSCODER_TYPES as readonly string[]).includes(requested) ? (requested as TranscoderType) : TRANSCODER_TYPES[0];
}

/**
 * Returns the display label for a transcoder backend.
 * @param {TranscoderType} type - Transcoder backend identifier.
 * @returns {string} Human-readable label.
 */
export function transcoderLabel(type: TranscoderType): string {
  return TRANSCODER_LABELS[type] ?? type;
}

/**
 * Extracts the `--theme` value from raw CLI arguments so the logo can be
 * colored before Commander finishes parsing. Unknown ids fall back to the
 * default theme.
 * @param {string[]} rawArgs - Raw user-supplied CLI arguments.
 * @returns {CliThemeId} The resolved theme id.
 */
export function resolveThemeId(rawArgs: string[]): CliThemeId {
  const flagIndex = rawArgs.indexOf('--theme');
  const equalsArg = rawArgs.find((arg) => arg.startsWith('--theme='));
  const value = flagIndex >= 0 ? rawArgs[flagIndex + 1] : equalsArg?.slice('--theme='.length);
  return isCliThemeId(value) ? value : DEFAULT_CLI_THEME;
}

/**
 * Applies global output flags to the CLI output config and chalk color level.
 * Respects `NO_COLOR` and the `--no-color` flag, then configures quiet/verbose/
 * machine (JSON) routing for status output.
 * @param {Record<string, unknown>} global - Parsed global options.
 * @returns {void}
 */
export function applyGlobalOptions(global: Record<string, unknown>): void {
  const noColor = Boolean(process.env.NO_COLOR) || global.color === false;
  setColor(!noColor);
  configureCliOutput(
    {
      quiet: global.quiet === true,
      verbose: global.verbose === true,
      machine: global.json === true,
    },
    !noColor,
  );
}

/**
 * Parses the `--timeout` global option into a positive number of seconds.
 * @param {Record<string, unknown>} global - Parsed global options.
 * @returns {number} Timeout in seconds (always positive; falls back to the
 *   default {@link CLI_CONVERSION_TIMEOUT_MS}).
 */
export function parseTimeout(global: Record<string, unknown>): number {
  const seconds = Number(global.timeout);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : CLI_CONVERSION_TIMEOUT_MS / 1000;
}
