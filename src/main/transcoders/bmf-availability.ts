/**
 * @fileoverview Detects whether the BMF framework CLI tools are installed.
 * BMF is not shipped with EncodeX, so its executables (`bmf_ffmpeg`,
 * `bmf_ffprobe`) must be resolved from the system PATH. Lookup uses `where`
 * on Windows and `which` elsewhere, with no shell involved.
 */

import { spawnSync } from 'child_process';
import { Logger } from '../../shared/logger';
import { TRANSCODER_COMMANDS } from '../../shared/transcoder-constants';
import { CAPABILITY_PROBE_TIMEOUT_MS } from '../../shared/constants';
import type { BmfStatus } from '../../shared/types';

const log = new Logger('main/transcoders/bmf-availability');

/**
 * Returns true when the executable can be resolved from PATH.
 * @param {string} command - Executable name without extension.
 * @returns {boolean} Whether the lookup command found it.
 */
function isOnPath(command: string): boolean {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(lookup, [command], {
    encoding: 'utf-8',
    timeout: CAPABILITY_PROBE_TIMEOUT_MS,
    windowsHide: true,
  });
  return result.status === 0 && (result.stdout ?? '').trim().length > 0;
}

/**
 * Checks whether both BMF CLI tools (`bmf_ffmpeg` and `bmf_ffprobe`) are on PATH.
 * Not cached, so installing BMF while the app is running is picked up on the
 * next check.
 * @returns {BmfStatus} `available` is true only when nothing is missing.
 */
export function checkBmfAvailable(): BmfStatus {
  const required = [TRANSCODER_COMMANDS.BMF_FFMPEG, TRANSCODER_COMMANDS.BMF_FFPROBE];
  const missing = required.filter((cmd) => !isOnPath(cmd));
  if (missing.length > 0) {
    log.warn('BMF not available on PATH, missing:', missing.join(', '));
  }
  return { available: missing.length === 0, missing };
}
