/**
 * @fileoverview Type definitions for the top-level main-process modules.
 * Describes the shapes spoken by the CLI logo/theme helpers, the OS power-action
 * executor, the preview cache, the subprocess watchdog, the in-app updater, and
 * the video preview extractor.
 */

import type { CLI_THEME_IDS } from './cli-logo';

/**
 * A theme id usable for the CLI logo.
 * @typedef {(typeof CLI_THEME_IDS)[number]} CliThemeId
 */
export type CliThemeId = (typeof CLI_THEME_IDS)[number];

/**
 * An RGB triple.
 * @typedef {readonly [number, number, number]} Rgb
 */
export type Rgb = readonly [number, number, number];

/**
 * A theme palette's accent colors as RGB triples, mirroring the `primary` and
 * `secondary` hex values of each theme in src/shared/theme/colors.ts.
 * @interface CliThemePalette
 * @property {Rgb} primary - The theme's primary accent color (darker).
 * @property {Rgb} secondary - The theme's secondary accent color (brighter).
 */
export interface CliThemePalette {
  primary: Rgb;
  secondary: Rgb;
}

/**
 * A fully resolved OS command to execute.
 * @interface PowerCommand
 * @property {string} command - The executable to spawn.
 * @property {string[]} args - Arguments passed to the executable.
 */
export interface PowerCommand {
  command: string;
  args: string[];
}

/**
 * On-disk shape of one cached preview.
 * @interface PreviewCacheEntry
 * @property {number} size - Byte size of the source file when generated.
 * @property {number} mtimeMs - Modification time (integer milliseconds) of the
 *   source file when generated; used together with {@link size} to detect edits.
 * @property {string} dataUrl - The generated base64 data URL.
 */
export interface PreviewCacheEntry {
  size: number;
  mtimeMs: number;
  dataUrl: string;
}

/**
 * The minimum a watchdog needs in order to stop runaway work.
 *
 * Declared with method syntax on purpose: that makes `kill`'s parameter
 * bivariant under `strictFunctionTypes`, so both a Node `ChildProcess`
 * (`kill(signal?: NodeJS.Signals | number)`) and a fluent-ffmpeg `FfmpegCommand`
 * (`kill(signal: string)`) satisfy it without an adapter at each call site.
 */
export interface Killable {
  kill(signal?: string | number | NodeJS.Signals): unknown;
}

/**
 * Starts bounded work and hands the watchdog whatever needs killing.
 *
 * `onSpawn` is called synchronously, immediately after the process is created.
 * It may be called more than once (last registration wins) or not at all, which
 * is why the watchdog treats a missing target as "nothing to kill" rather than
 * as a programming error.
 */
export type SpawnStarter<T> = (onSpawn: (target: Killable) => void) => Promise<T>;

/**
 * A version split into its comparable parts.
 * @interface ParsedVersion
 * @property {number[]} core - Numeric major/minor/patch, padded by comparison.
 * @property {Array<string|number>|null} pre - Pre-release identifiers, or null when stable.
 */
export interface ParsedVersion {
  core: number[];
  pre: Array<string | number> | null;
}

/**
 * The shape this module needs out of a single release payload.
 * @interface RawReleaseAsset
 * @property {string} name - Asset file name.
 * @property {string} browser_download_url - Direct download URL.
 * @property {number} size - Byte count.
 * @property {string} [digest] - GitHub-published digest, e.g. `sha256:ab12...`.
 */
export interface RawReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  digest?: string;
}

/** @interface RawRelease - the validated fields of a single release payload. */
export interface RawRelease {
  tag_name: string;
  body: string;
  html_url: string;
  assets: RawReleaseAsset[];
  /** True when the release is marked as a pre-release on GitHub. */
  prerelease: boolean;
  /** True when the release is still a draft. Drafts are never offered. */
  draft: boolean;
}

/**
 * The update channel a running version belongs to.
 *
 * - `stable`: the running version has no pre-release identifier. Only stable
 *   releases are offered.
 * - `beta`: the running version is a pre-release. Both pre-releases and stable
 *   releases are offered, so a beta user keeps getting betas and still
 *   receives the eventual 1.0.0.
 * @typedef {'stable' | 'beta'} UpdateChannel
 */
export type UpdateChannel = 'stable' | 'beta';

/**
 * Outcome of a single ffmpeg preview-extraction run.
 * @interface PreviewAttempt
 * @property {string | null} dataUrl - Base64 PNG data URL, or `null` when the
 *   run exited non-zero or produced no frame bytes.
 * @property {number | null} code - Exit code of the ffmpeg process (`null` when
 *   `close` fired without a code, e.g. the process was killed).
 * @property {string} stderr - Captured stderr text (may be empty when the
 *   failure produced no diagnostics, e.g. `-v error` suppresses the empty
 *   output warning for short videos).
 */
export interface PreviewAttempt {
  dataUrl: string | null;
  code: number | null;
  stderr: string;
}
