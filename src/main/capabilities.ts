/**
 * @fileoverview FFmpeg and transcoder capability detection and reporting.
 * Discovers available codecs, encoders, and hardware acceleration features.
 *
 * This module is used by the Electron main process to discover which video and
 * audio encoders, plus which hardware acceleration methods, the bundled FFmpeg
 * binary supports. It runs short-lived, synchronous FFmpeg probes (`-encoders`
 * and `-hwaccels`) and caches the parsed results so capability checks are
 * performed at most once per app session unless a refresh is explicitly forced.
 *
 * Exports:
 *  - parseEncoderOutput()     - parses `ffmpeg -encoders` output
 *  - parseHwaccelOutput()     - parses `ffmpeg -hwaccels` output
 *  - getEncoderCapabilities() - cached probe of encoders and hwaccels
 *
 * All probe failures are logged and surface as a `null` result rather than an
 * exception, so callers can degrade gracefully when FFmpeg is unavailable.
 */

import { spawnSync } from 'child_process';
import { Logger } from '../shared/logger';
import { EncoderCapabilities } from '../shared/types';
import { CAPABILITY_PROBE_TIMEOUT_MS } from '../shared/constants';
import { getFfmpegPath } from './transcoders/ffmpeg-utils';
import { LOG_DETECTED_FFMPEG_CAPABILITIES, LOG_ENCODER_CAPABILITY_PROBE_FAILED } from '../shared/log-constants';

/**
 * Logger instance scoped to the capabilities module. Logs detected encoder and
 * hardware acceleration results and any capability-probe failures.
 * @const {Logger} log
 */
const log = new Logger('main/capabilities');

/**
 * Regular expression used to parse a single line of `ffmpeg -encoders` output.
 * The first capture group is the encoder type flag (V = video, A = audio,
 * S = subtitle); the second capture group is the encoder name.
 * @const {RegExp} ENCODER_LINE
 */
const ENCODER_LINE = /^([VAS])\S+\s+(\S+)/;

/**
 * Parses the stdout of `ffmpeg -encoders` into lists of available video and
 * audio encoder names.
 *
 * Each non-empty line of FFmpeg's encoder list begins with a single-character
 * type flag (V/A/S) followed by the encoder name. Lines that do not match the
 * expected layout (headers, blank lines) and subtitle entries (flag `S`) are
 * skipped, so subtitle encoders are intentionally not collected.
 *
 * @param {string} stdout - Raw stdout produced by running
 *   `ffmpeg -hide_banner -encoders`.
 * @returns {Pick<EncoderCapabilities, 'videoEncoders' | 'audioEncoders'>} An
 *   object containing the parsed `videoEncoders` and `audioEncoders` name
 *   arrays. The arrays are empty if no matching encoder lines were found.
 */
export function parseEncoderOutput(stdout: string): Pick<EncoderCapabilities, 'videoEncoders' | 'audioEncoders'> {
  const videoEncoders: string[] = [];
  const audioEncoders: string[] = [];
  for (const rawLine of String(stdout).split(/\r?\n/)) {
    const match = rawLine.trimStart().match(ENCODER_LINE);
    if (!match) continue;
    const kind = match[1];
    const name = match[2];
    if (kind === 'V') videoEncoders.push(name);
    else if (kind === 'A') audioEncoders.push(name);
  }
  return { videoEncoders, audioEncoders };
}

/**
 * Parses the stdout of `ffmpeg -hwaccels` into a flat list of supported
 * hardware acceleration method names.
 *
 * FFmpeg prints a "Hardware acceleration methods:" header line followed by one
 * method name per line. The header is discarded, the remaining lines are joined
 * and split on whitespace, and empty tokens are filtered out.
 *
 * @param {string} stdout - Raw stdout produced by running
 *   `ffmpeg -hide_banner -hwaccels`.
 * @returns {string[]} The list of hardware acceleration method names supported
 *   by the current FFmpeg build. Empty if none were reported.
 */
export function parseHwaccelOutput(stdout: string): string[] {
  const lines = String(stdout).trim().split(/\r?\n/);
  lines.shift();
  return lines.join(' ').split(/\s+/).filter(Boolean);
}

/**
 * Runs a synchronous FFmpeg probe command and returns its stdout.
 *
 * Uses `spawnSync` to invoke the FFmpeg binary resolved by `getFfmpegPath`.
 * The command is bounded by `CAPABILITY_PROBE_TIMEOUT_MS` and runs with
 * `windowsHide` enabled so no console window flashes on Windows.
 *
 * @param {string[]} args - CLI arguments to pass to ffmpeg, e.g.
 *   `['-hide_banner', '-encoders']`.
 * @returns {string} The ffmpeg process stdout as a UTF-8 string (empty if
 *   none was emitted).
 * @throws {Error} If ffmpeg fails to spawn (e.g. the binary is missing), or if
 *   the process exits with a non-zero status code.
 */
function runFfmpeg(args: string[]): string {
  const ffmpegPath = getFfmpegPath();
  const result = spawnSync(ffmpegPath, args, {
    encoding: 'utf-8' as BufferEncoding,
    timeout: CAPABILITY_PROBE_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`ffmpeg ${args.join(' ')} exited with code ${result.status}`);
  }
  return String(result.stdout ?? '');
}

/**
 * Memoized result of the last successful capability probe. `null` until the
 * first probe completes, and also left `null` when a probe fails.
 * @type {EncoderCapabilities | null}
 */
let cached: EncoderCapabilities | null = null;

/**
 * Returns the FFmpeg encoder and hardware-acceleration capabilities, probing
 * them on first call and caching the result.
 *
 * When `force` is false and a previous probe succeeded, the cached result is
 * returned without spawning any new process. When `force` is true, FFmpeg is
 * re-invoked even if a cached result exists. Any failure while probing (spawn
 * error, non-zero exit, or unexpected output) is logged and causes `null` to be
 * returned while leaving the existing cache untouched.
 *
 * @param {boolean} [force=false] - When true, re-runs the FFmpeg probes and
 *   ignores the cached result.
 * @returns {EncoderCapabilities | null} The detected
 *   `{ videoEncoders, audioEncoders, hwaccels }` capabilities, or `null` if
 *   probing failed.
 */
export function getEncoderCapabilities(force = false): EncoderCapabilities | null {
  if (cached && !force) return cached;
  try {
    const encodersOut = runFfmpeg(['-hide_banner', '-encoders']);
    const hwaccelsOut = runFfmpeg(['-hide_banner', '-hwaccels']);
    const { videoEncoders, audioEncoders } = parseEncoderOutput(encodersOut);
    const hwaccels = parseHwaccelOutput(hwaccelsOut);
    cached = { videoEncoders, audioEncoders, hwaccels };
    log.info(
      LOG_DETECTED_FFMPEG_CAPABILITIES,
      videoEncoders.length,
      'video encoders,',
      audioEncoders.length,
      'audio encoders,',
      hwaccels.length,
      'hwaccels',
    );
    return cached;
  } catch (err) {
    log.error(LOG_ENCODER_CAPABILITY_PROBE_FAILED, err);
    return null;
  }
}
