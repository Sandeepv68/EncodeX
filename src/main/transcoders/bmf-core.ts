/**
 * @fileoverview BMF (ByteLynx Media Framework) transcoder implementation.
 * Provides a high-performance media processing backend that shells out to the
 * BMF CLI tools (`bmf_ffmpeg`/`bmf_ffprobe`). Implements the ITranscoder
 * contract so it can be selected interchangeably with the FFmpeg backends via
 * the transcoder factory; BMF is intended as an accelerated alternative for
 * environments where the BMF framework is installed.
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess, execSync } from 'child_process';
import { Logger } from '../../shared/logger';
import type { ITranscoder } from './types';
import { suspendProcess, resumeProcess } from '../process-utils';
import { ConversionOptions, ConversionProgress, MediaInfo } from '../../shared/types';
import {
  TRANSCODER_TYPES,
  TRANSCODER_COMMANDS,
  TRANSCODER_DEFAULTS,
  KILL_SIGNAL,
  PROGRESS_PATTERNS,
  EMPTY_PROGRESS,
} from '../../shared/transcoder-constants';
import { buildFfmpegArgs } from './ffmpeg-utils';
import { mapFfprobeData } from './ffprobe-mapper';
import { cancelledError } from '../../shared/errors';
import { ERROR_LOG_TAIL_CHARS } from '../../shared/constants';
import {
  LOG_ARROW,
  LOG_BMF_COMMAND,
  LOG_BMF_EXITED_WITH_CODE,
  LOG_BMF_FFPROBE_COMMAND,
  LOG_BMF_PROCESS_CANCELLED,
  LOG_BMF_PROCESS_COMPLETED_SUCCESSFULLY,
  LOG_BMF_PROCESS_ERROR,
  LOG_BMF_PROCESS_FAILED_WITH_CODE,
  LOG_BMF_PROCESS_KILLED,
  LOG_BMF_SPAWN_ERROR,
  LOG_CANCELLING_CURRENT_BMF_PROCESS,
  LOG_CONVERT,
  LOG_COPY,
  LOG_GET_INFO,
  LOG_GET_INFO_COMPLETED,
  LOG_GET_INFO_FAILED_BMF_NOT_AVAILABLE,
  LOG_PAUSING_BMF_PROCESS,
  LOG_RESUMING_BMF_PROCESS,
  LOG_STDERR,
} from '../../shared/log-constants';

const log = new Logger('main/transcoders/bmf-core');

/**
 * BMF-based transcoder backend.
 * @class BmfCore
 * @implements ITranscoder
 *
 * Runs `bmf_ffprobe` synchronously to read media metadata and spawns
 * `bmf_ffmpeg` with the shared argument builder from ffmpeg-utils for
 * conversion. Supports pause/resume via OS-level process suspension and
 * cancellation via SIGKILL. Progress is derived by scanning stderr for a
 * `time=` timestamp; ETA/fps/percent are not computed (EMPTY_PROGRESS values
 * are used). Cancellation is cooperative: the `cancelled` flag makes the
 * error/close handlers emit a `cancelledError` instead of the raw error.
 */
export class BmfCore implements ITranscoder {
  /** The live bmf_ffmpeg child process, or null when idle. */
  private process: ChildProcess | null = null;
  /** True once cancel() has been called; suppresses non-cancellation errors. */
  private cancelled = false;
  /** PID of the spawned bmf_ffmpeg process, used for suspend/resume. */
  private processPid: number | null = null;

  /**
   * Returns the backend type identifier.
   * @returns {string} `'BMF'` (from TRANSCODER_TYPES[2])
   */
  getType(): string {
    return TRANSCODER_TYPES[2];
  }

  /**
   * Reads media metadata using the synchronous bmf_ffprobe CLI.
   *
   * Builds and executes `bmf_ffprobe -v quiet -print_format json -show_format
   * -show_streams "<input>"` via execSync with a BMF_TIMEOUT_MS timeout, parses
   * the JSON output, and maps it through {@link mapFfprobeData} into a
   * MediaInfo object. Any failure (missing binary, probe error, bad JSON, or
   * timeout) is logged and rethrown as a generic "BMF not available" error.
   * @param {string} input - Absolute path of the media file to probe
   * @returns {Promise<MediaInfo>} Resolves with the mapped media information
   * @throws {Error} Thrown with a "BMF not available..." message if the probe
   *   command fails or the BMF framework is not installed
   */
  async getInfo(input: string): Promise<MediaInfo> {
    log.info(LOG_GET_INFO, input);
    try {
      const cmd = `${TRANSCODER_COMMANDS.BMF_FFPROBE} -v quiet -print_format json -show_format -show_streams "${input}"`;
      log.debug(LOG_BMF_FFPROBE_COMMAND, cmd);
      const result = execSync(cmd, {
        encoding: 'utf-8' as BufferEncoding,
        timeout: TRANSCODER_DEFAULTS.BMF_TIMEOUT_MS,
      });
      const data = JSON.parse(result as string);
      const info = mapFfprobeData(data, input);
      log.info(LOG_GET_INFO_COMPLETED, info.format, info.duration);
      return info;
    } catch (err) {
      log.error(LOG_GET_INFO_FAILED_BMF_NOT_AVAILABLE, err);
      throw new Error('BMF not available. Please ensure BMF CLI tools are installed.');
    }
  }

  /**
   * Starts a BMF conversion and returns an EventEmitter for its lifecycle.
   *
   * Workflow: resets the `cancelled` flag, builds the ffmpeg argument list via
   * {@link buildFfmpegArgs} (input, output, codecs, filters, trim, overwrite),
   * and spawns `bmf_ffmpeg` with those args. stderr is accumulated and scanned
   * for the `time=HH:MM:SS.mm` pattern; every match emits a `progress` event
   * carrying EMPTY_PROGRESS values with the matched timestamp. The process
   * 'error' handler emits the raw error (or a cancelledError if cancelled) and
   * the 'close' handler emits `end` on exit code 0, or an `Error` embedding the
   * last `ERROR_LOG_TAIL_CHARS` characters of stderr otherwise. If cancelled,
   * 'close' emits a cancelledError instead. Spawn failures are reported
   * asynchronously on the emitter via process.nextTick.
   * @param {string} input - Absolute path of the input media file
   * @param {string} output - Absolute path of the output file
   * @param {ConversionOptions} options - Encoding options forwarded to the
   *   ffmpeg argument builder
   * @returns {EventEmitter} Emitter with 'progress' (ConversionProgress),
   *   'end', and 'error' (Error) events; 'error' is guaranteed to fire for
   *   both async process failures and synchronous spawn failures
   */
  convert(input: string, output: string, options: ConversionOptions): EventEmitter {
    log.info(LOG_CONVERT, input, LOG_ARROW, output, LOG_COPY, !!options.copy);
    this.cancelled = false;
    const emitter = new EventEmitter();
    const args = buildFfmpegArgs(input, output, options);

    log.debug(LOG_BMF_COMMAND, TRANSCODER_COMMANDS.BMF_FFMPEG, args.join(' '));

    try {
      const proc = spawn(TRANSCODER_COMMANDS.BMF_FFMPEG, args);
      this.process = proc;
      this.processPid = proc.pid ?? null;

      let stderrData = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrData += chunk.toString();
        const timeMatch = stderrData.match(PROGRESS_PATTERNS.TIME_SINGLE);
        if (timeMatch) {
          emitter.emit('progress', { ...EMPTY_PROGRESS, time: timeMatch[1] } as ConversionProgress);
        }
      });

      proc.on('error', (err: Error) => {
        if (this.cancelled) {
          log.info(LOG_BMF_PROCESS_CANCELLED);
          emitter.emit('error', cancelledError());
          return;
        }
        log.error(LOG_BMF_PROCESS_ERROR, err);
        emitter.emit('error', err);
      });
      proc.on('close', (code: number | null) => {
        log.debug(LOG_BMF_EXITED_WITH_CODE, code);
        if (this.cancelled) {
          log.info(LOG_BMF_PROCESS_CANCELLED);
          emitter.emit('error', cancelledError());
          return;
        }
        if (code === 0) {
          log.info(LOG_BMF_PROCESS_COMPLETED_SUCCESSFULLY);
          emitter.emit('end');
        } else {
          log.error(LOG_BMF_PROCESS_FAILED_WITH_CODE, code, LOG_STDERR, stderrData.slice(-ERROR_LOG_TAIL_CHARS));
          emitter.emit('error', new Error(`BMF exited with code ${code}: ${stderrData.slice(-ERROR_LOG_TAIL_CHARS)}`));
        }
      });
    } catch (err) {
      log.error(LOG_BMF_SPAWN_ERROR, err);
      process.nextTick(() => emitter.emit('error', err));
    }

    return emitter;
  }

  /**
   * Pauses the running BMF conversion by suspending its OS process.
   *
   * Delegates to {@link suspendProcess} with the recorded PID; on non-Windows
   * platforms this uses a SIGSTOP-style signal, on Windows it invokes
   * NtSuspendProcess via PowerShell. No-op when no process is running.
   */
  pause(): void {
    log.info(LOG_PAUSING_BMF_PROCESS);
    if (this.processPid != null) {
      suspendProcess(this.processPid);
    }
  }

  /**
   * Resumes a previously paused BMF conversion.
   *
   * Delegates to {@link resumeProcess} with the recorded PID; no-op when no
   * process PID is recorded.
   */
  resume(): void {
    log.info(LOG_RESUMING_BMF_PROCESS);
    if (this.processPid != null) {
      resumeProcess(this.processPid);
    }
  }

  /**
   * Cancels the running BMF conversion.
   *
   * Sets the `cancelled` flag (which makes the pending error/close handlers
   * emit a cancelledError), kills the child process with KILL_SIGNAL (SIGKILL),
   * and clears the process/PID references. The emitter returned by {@link
   * convert} will fire its 'error' handler with the cancellation error once the
   * process exits.
   */
  cancel(): void {
    log.info(LOG_CANCELLING_CURRENT_BMF_PROCESS);
    this.cancelled = true;
    if (this.process) {
      this.process.kill(KILL_SIGNAL);
      this.process = null;
      this.processPid = null;
      log.info(LOG_BMF_PROCESS_KILLED);
    }
  }
}
