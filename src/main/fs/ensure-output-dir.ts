/**
 * @fileoverview Helper that creates the directory of an output file.
 *
 * FFmpeg does not create missing directories, so a conversion whose output
 * lives in a folder that does not exist yet fails. The demux page can collect
 * the extracted streams in a dedicated sub-folder, and the mux queue can run
 * jobs whose output folder was removed after the job was queued, so both
 * entry points create the target directory before the transcoder runs.
 */

import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { Logger } from '../../shared/logger';

const log = new Logger('main/fs/ensure-output-dir');

/**
 * Creates the directory that holds the given output file when it does not
 * exist yet. Failures are logged but not thrown: the conversion itself
 * reports the real problem (for example a permission error) with a proper
 * user-facing message.
 * @param {string} output - Absolute path of the output file.
 * @returns {void}
 */
export function ensureOutputDirectory(output: string): void {
  if (!output) return;
  const dir = dirname(output);
  if (!dir || dir === '.') return;
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err: unknown) {
    log.warn('Could not create the output directory', dir, err);
  }
}
