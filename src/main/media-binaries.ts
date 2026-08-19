/**
 * @fileoverview Resolves the ffmpeg/ffprobe executable paths for the main
 * process.
 *
 * In a packaged app the binaries are staged next to the app under
 * `process.resourcesPath` by the release build (see
 * `scripts/fetch-media-binaries.mjs` and the `extraResources` entries in
 * package.json):
 *  - ffmpeg:  `<resourcesPath>/ffmpeg-static/ffmpeg[.exe]`
 *  - ffprobe: `<resourcesPath>/ffprobe-static/bin/<platform>/<arch>/ffprobe[.exe]`
 *
 * In development the paths come from the `ffmpeg-static`/`ffprobe-static`
 * packages in `node_modules`. Both modes fall back to the system-installed
 * `ffmpeg`/`ffprobe` commands (with a warning) when no bundled binary exists.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import ffmpegStatic from 'ffmpeg-static';
import { path as ffprobeStaticPath } from 'ffprobe-static';
import { Logger } from '../shared/logger';
import { TRANSCODER_COMMANDS } from '../shared/transcoder-constants';
import {
  LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG,
  LOG_FFPROBE_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFPROBE,
} from '../shared/log-constants';

const log = new Logger('main/media-binaries');

/**
 * Detects whether the app is running from an installed package.
 *
 * `process.versions.electron` is only present inside an Electron runtime, so
 * this is a no-op under plain Node (unit tests, CLI). Inside Electron it reads
 * `app.isPackaged`; true means the binaries must be resolved from
 * `process.resourcesPath` rather than `node_modules`.
 * @returns {boolean} True when running inside a packaged Electron app
 */
function isPackaged(): boolean {
  if (typeof (process.versions as NodeJS.ProcessVersions & { electron?: string }).electron !== 'string') return false;
  return typeof app === 'object' && app !== null && app.isPackaged === true;
}

/**
 * Returns the platform-appropriate executable file name.
 * @param {string} base - Base executable name (e.g. `'ffmpeg'`)
 * @returns {string} `base` on POSIX, `base.exe` on Windows
 */
function executableName(base: string): string {
  return process.platform === 'win32' ? `${base}.exe` : base;
}

/**
 * Resolves the ffmpeg executable path.
 *
 * Prefers the statically bundled binary staged under `process.resourcesPath` in
 * a packaged app (or shipped by `ffmpeg-static` in development); when it is
 * missing on disk, logs a warning and falls back to the system `ffmpeg` command.
 * @returns {string} Absolute path to the bundled ffmpeg binary, or `'ffmpeg'`
 *   for the system-installed executable
 */
export function getFfmpegPath(): string {
  if (isPackaged()) {
    const bundled = join((process as unknown as { resourcesPath: string }).resourcesPath, 'ffmpeg-static', executableName('ffmpeg'));
    if (existsSync(bundled)) return bundled;
    log.warn(LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG);
    return TRANSCODER_COMMANDS.FFMPEG;
  }
  const staticPath = ffmpegStatic ?? '';
  if (staticPath && existsSync(staticPath)) return staticPath;
  log.warn(LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG);
  return TRANSCODER_COMMANDS.FFMPEG;
}

/**
 * Resolves the ffprobe executable path.
 *
 * Prefers the statically bundled binary staged under `process.resourcesPath` in
 * a packaged app (or shipped by `ffprobe-static` in development); when it is
 * missing on disk, logs a warning and falls back to the system `ffprobe`
 * command.
 * @returns {string} Absolute path to the bundled ffprobe binary, or `'ffprobe'`
 *   for the system-installed executable
 */
export function getFfprobePath(): string {
  if (isPackaged()) {
    const bundled = join(
      (process as unknown as { resourcesPath: string }).resourcesPath,
      'ffprobe-static',
      'bin',
      process.platform,
      process.arch,
      executableName('ffprobe'),
    );
    if (existsSync(bundled)) return bundled;
    log.warn(LOG_FFPROBE_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFPROBE);
    return TRANSCODER_COMMANDS.FFPROBE;
  }
  if (ffprobeStaticPath && existsSync(ffprobeStaticPath)) return ffprobeStaticPath;
  log.warn(LOG_FFPROBE_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFPROBE);
  return TRANSCODER_COMMANDS.FFPROBE;
}
