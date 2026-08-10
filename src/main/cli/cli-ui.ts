/**
 * @fileoverview Terminal UI helpers for the EncodeX CLI.
 *
 * Wraps chalk, ora, and cli-progress behind a small, TTY-aware API so every
 * subcommand renders consistently: themed colors, spinners while probing,
 * single/multi progress bars while converting, aligned tables for info and
 * capability output, and stream routing that keeps stdout clean for
 * machine-readable data.
 *
 * Behavior rules:
 *  - Colors are disabled when stdout is not a TTY, when `NO_COLOR` is set, or
 *    when `--no-color` is passed (callers toggle {@link setColor}).
 *  - Progress bars and spinners only render on an interactive TTY.
 *  - `status()`/`success()`/`warn()` are suppressed by `quiet`, and are routed
 *    to stderr whenever `machine` is enabled (e.g. `--json`) so stdout carries
 *    only data.
 *  - `error()` always writes to stderr and is never suppressed.
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import cliProgress from 'cli-progress';
import { CliThemeId } from '../cli-logo';

/**
 * Mutable output configuration shared across CLI subcommands. Set once argument
 * parsing completes.
 * @interface CliOutputConfig
 * @property {boolean} quiet - When true, suppress all non-error status output.
 * @property {boolean} verbose - When true, allow debug-level status output.
 * @property {boolean} machine - When true, status lines route to stderr so
 *   stdout stays reserved for data (JSON).
 */
export interface CliOutputConfig {
  quiet: boolean;
  verbose: boolean;
  machine: boolean;
}

/**
 * The current CLI output configuration. Defaults to interactive, non-quiet,
 * non-machine output; {@link configureCliOutput} updates it once flags parse.
 * @const {CliOutputConfig} cliConfig
 */
export const cliConfig: CliOutputConfig = {
  quiet: false,
  verbose: false,
  machine: false,
};

/**
 * Applies the parsed CLI output flags to the global {@link cliConfig} and
 * enables/disables chalk coloring (`--no-color` / `NO_COLOR`).
 * @param {Partial<CliOutputConfig>} config - Flags to apply.
 * @param {boolean} [color=true] - Whether ANSI colors are allowed.
 * @returns {void}
 */
export function configureCliOutput(config: Partial<CliOutputConfig>, color = true): void {
  if (config.quiet !== undefined) cliConfig.quiet = config.quiet;
  if (config.verbose !== undefined) cliConfig.verbose = config.verbose;
  if (config.machine !== undefined) cliConfig.machine = config.machine;
  setColor(color);
}

/**
 * Whether stdout is an interactive TTY (progress bars / spinners are enabled).
 * @type {boolean} interactive
 */
export const interactive = Boolean(process.stdout.isTTY) && !process.env.CI;

/**
 * Enables or disables ANSI color output by mutating chalk's color level.
 * @param {boolean} enabled - True to allow colors, false to force plain text.
 * @returns {void}
 */
export function setColor(enabled: boolean): void {
  chalk.level = enabled && !process.env.NO_COLOR ? 1 : 0;
}

/**
 * Theme-aware chalk accessors derived from the selected CLI theme palette.
 * @interface ThemeChalk
 * @property {(s: string) => string} primary - The theme's primary accent color.
 * @property {(s: string) => string} secondary - The theme's secondary accent color.
 */
export interface ThemeChalk {
  primary: (s: string) => string;
  secondary: (s: string) => string;
}

/**
 * RGB primary/secondary hex pairs for every CLI theme, mirroring
 * src/renderer/colors.ts (used to build themed chalk functions).
 * @const {Readonly<Record<string, [string, string]>>} THEME_HEX
 */
const THEME_HEX: Readonly<Record<string, [string, string]>> = {
  light: ['#0f9b8e', '#0dbfb0'],
  ocean: ['#1976d2', '#42a5f5'],
  sunset: ['#e65100', '#fb8c00'],
  forest: ['#2e7d32', '#66bb6a'],
  lavender: ['#7b1fa2', '#ab47bc'],
  rose: ['#c2185b', '#ec407a'],
  slate: ['#455a64', '#788890'],
  dark: ['#0f9b8e', '#0dbfb0'],
};

/**
 * Builds chalk color functions for the given theme id. Unknown ids fall back to
 * the brand 'light' palette.
 * @param {CliThemeId} themeId - Theme whose accents color the output.
 * @returns {ThemeChalk} `primary`/`secondary` colorize functions.
 */
export function themeColors(themeId: CliThemeId): ThemeChalk {
  const [primaryHex, secondaryHex] = THEME_HEX[themeId] ?? THEME_HEX.light;
  return {
    primary: (s: string) => chalk.hex(primaryHex)(s),
    secondary: (s: string) => chalk.hex(secondaryHex)(s),
  };
}

/**
 * Standard prefix icons used in CLI status lines.
 * @const {Object} ICONS
 * @property {string} SUCCESS - Green checkmark.
 * @property {string} ERROR - Red cross.
 * @property {string} WARN - Yellow warning triangle.
 * @property {string} INFO - Blue info mark.
 */
export const ICONS = {
  SUCCESS: chalk.green('✔'),
  ERROR: chalk.red('✖'),
  WARN: chalk.yellow('⚠'),
  INFO: chalk.blue('ℹ'),
} as const;

/**
 * The stream used for non-error status lines. In machine mode (JSON output)
 * status is pushed to stderr so stdout stays parseable.
 * @returns {NodeJS.WriteStream} The active status stream.
 */
function statusStream(): NodeJS.WriteStream {
  return cliConfig.machine ? process.stderr : process.stdout;
}

/**
 * Prints a status line to the active status stream, honoring `quiet`.
 * @param {string} text - The message to print.
 * @returns {void}
 */
export function status(text: string): void {
  if (cliConfig.quiet) return;
  statusStream().write(`${text}\n`);
}

/**
 * Prints a success line (green checkmark prefix).
 * @param {string} text - The message to print.
 * @returns {void}
 */
export function success(text: string): void {
  status(`${ICONS.SUCCESS} ${text}`);
}

/**
 * Prints a warning line (yellow warning prefix).
 * @param {string} text - The message to print.
 * @returns {void}
 */
export function warn(text: string): void {
  if (cliConfig.quiet) return;
  statusStream().write(`${ICONS.WARN} ${chalk.yellow(text)}\n`);
}

/**
 * Prints an error line to stderr. Never suppressed by `quiet`.
 * @param {string} text - The message to print.
 * @returns {void}
 */
export function error(text: string): void {
  process.stderr.write(`${ICONS.ERROR} ${chalk.red(text)}\n`);
}

/**
 * Prints raw data to stdout (JSON, etc.) regardless of output config.
 * @param {string} text - The data to write.
 * @returns {void}
 */
export function data(text: string): void {
  process.stdout.write(`${text}\n`);
}

/**
 * Creates and starts an ora spinner when stdout is an interactive TTY; a
 * no-op proxy is returned otherwise so callers use the same API everywhere.
 * @param {string} text - The initial spinner label.
 * @returns {Ora} An ora instance (real or a stub with no-op methods).
 */
export function spinner(text: string): Ora {
  if (!interactive) {
    return new Proxy(
      {},
      {
        get: () => () => {},
      },
    ) as Ora;
  }
  return ora({ text, color: 'cyan', stream: process.stderr });
}

/** Width in characters of the rendered progress bar. @const {number} BAR_WIDTH */
const BAR_WIDTH = 22;

/**
 * Builds the render function shared by the single and multi progress bars.
 * Renders the bar, percentage, output timestamp, speed, fps, ETA, and current
 * bitrate, using the theme's primary accent for the bar itself.
 * @param {CliThemeId} themeId - Theme whose primary accent colors the bar.
 * @param {string} [label] - Optional job label prefixed to the bar (batch mode).
 * @returns {cliProgress.Options['format']} A cli-progress format function.
 */
function barFormatter(
  themeId: CliThemeId,
  label?: string,
): (options: cliProgress.Options, params: cliProgress.Params, payload: Record<string, unknown>) => string {
  const theme = themeColors(themeId);
  return (_options, params, payload) => {
    const percent = Math.floor(params.progress * 100);
    const filled = Math.round(params.progress * BAR_WIDTH);
    const bar = theme.primary(`${'█'.repeat(filled)}${'░'.repeat(BAR_WIDTH - filled)}`);
    const prefix = label ? `${label} ` : '';
    const time = chalk.cyan(String(payload.time ?? '00:00:00'));
    const speed = chalk.green(String(payload.speed ?? '0x'));
    const fps = chalk.yellow(String(payload.fps ?? 0));
    const eta = chalk.magenta(String(payload.eta ?? '0'));
    const bitrate = chalk.dim(String(payload.bitrate ?? ''));
    return `${prefix}${bar} ${String(percent).padStart(3)}% ${time} ${speed} ${fps}fps eta ${eta}s ${bitrate}`;
  };
}

/**
 * Progress payload accepted by the bar update methods. Mirrors
 * {@link ConversionProgress} plus an optional batch label.
 * @interface BarPayload
 * @property {string} [label] - Batch job label shown before the bar.
 * @property {string} [time] - Current output timestamp.
 * @property {string} [speed] - Speed relative to realtime.
 * @property {number} [fps] - Encoding frames per second.
 * @property {string} [eta] - Estimated remaining seconds.
 * @property {string} [bitrate] - Current encoding bitrate.
 */
export interface BarPayload {
  label?: string;
  time?: string;
  speed?: string;
  fps?: number;
  eta?: string;
  bitrate?: string;
}

/**
 * Creates a single progress bar for one conversion, styled with the theme and
 * rendered only on an interactive TTY.
 * @param {CliThemeId} themeId - Theme whose primary accent colors the bar.
 * @returns {cliProgress.SingleBar | null} A started SingleBar, or null when
 *   stdout is not a TTY (callers then skip progress rendering).
 */
export function createProgressBar(themeId: CliThemeId): cliProgress.SingleBar | null {
  if (!interactive) return null;
  const bar = new cliProgress.SingleBar(
    {
      format: barFormatter(themeId),
      hideCursor: true,
      clearOnComplete: true,
      stream: process.stdout,
    },
    cliProgress.Presets.shades_classic,
  );
  bar.start(100, 0, {});
  return bar;
}

/**
 * Creates a multi-bar container for batch conversions (one row per active job),
 * or null on non-interactive terminals.
 * @param {CliThemeId} themeId - Theme whose primary accent colors the bars.
 * @returns {cliProgress.MultiBar | null} A started MultiBar, or null when
 *   stdout is not a TTY.
 */
export function createMultiBar(themeId: CliThemeId): cliProgress.MultiBar | null {
  if (!interactive) return null;
  return new cliProgress.MultiBar(
    {
      format: (options, params, payload) => barFormatter(themeId, String(payload.label ?? ''))(options, params, payload),
      hideCursor: true,
      clearOnComplete: false,
      stream: process.stdout,
    },
    cliProgress.Presets.shades_classic,
  );
}

/**
 * Renders a simple aligned table of rows to the status stream. The first column
 * is dimmed; values are printed as-is so callers can pre-color them.
 * @param {Array<[string, string]>} rows - Label/value pairs to render.
 * @returns {void}
 */
export function printTable(rows: Array<[string, string]>): void {
  const width = Math.max(...rows.map(([label]) => stripAnsi(label).length), 0);
  const lines = rows.map(([label, value]) => `${chalk.dim(label.padEnd(width))}  ${value}`);
  status(lines.join('\n'));
}

/**
 * Removes ANSI escape sequences from a string (used for column width math).
 * @param {string} text - The possibly-colored string.
 * @returns {string} The plain-text version.
 */
export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}
