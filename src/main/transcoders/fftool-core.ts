/**
 * @fileoverview FFTool-based transcoder implementation.
 * Alternative transcoder that drives the raw ffmpeg/ffprobe CLI subprocesses
 * directly (as opposed to FfmpegCore's fluent-ffmpeg API). Probes metadata via
 * a spawned ffprobe process and converts via a spawned ffmpeg process using the
 * shared {@link buildFfmpegArgs} builder, reporting time-based progress at a
 * fixed interval.
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { Logger } from '../../shared/logger';
import type { ITranscoder } from './types';
import { suspendProcess, resumeProcess } from '../process-utils';
import { ConversionOptions, ConversionProgress, MediaInfo } from '../../shared/types';
import {
  FFPROBE_FLAGS,
  PROGRESS_PATTERNS,
  TRANSCODER_TYPES,
  KILL_SIGNAL,
  TRANSCODER_DEFAULTS,
  EMPTY_PROGRESS,
} from '../../shared/transcoder-constants';
import { getFfmpegPath, getFfprobePath, buildFfmpegArgs } from './ffmpeg-utils';
import { mapFfprobeData } from './ffprobe-mapper';
import { cancelledError } from '../../shared/errors';
import {
  LOG_ARROW,
  LOG_CANCELLING_CURRENT_FFMPEG_PROCESS,
  LOG_CONVERT,
  LOG_COPY,
  LOG_FFMPEG_COMMAND,
  LOG_FFMPEG_EXITED_WITH_CODE,
  LOG_FFMPEG_PROCESS_CANCELLED,
  LOG_FFMPEG_PROCESS_COMPLETED_SUCCESSFULLY,
  LOG_FFMPEG_PROCESS_ERROR,
  LOG_FFMPEG_PROCESS_FAILED_WITH_CODE,
  LOG_FFMPEG_PROCESS_KILLED,
  LOG_FFPROBE_ARGS,
  LOG_FFPROBE_EXITED_WITH_CODE,
  LOG_GET_INFO,
  LOG_GET_INFO_COMPLETED,
  LOG_GET_INFO_FFPROBE_SPAWN_ERROR,
  LOG_GET_INFO_JSON_PARSE_ERROR,
  LOG_PAUSING_FFMPEG_PROCESS,
  LOG_RESUMING_FFMPEG_PROCESS,
} from '../../shared/log-constants';

const log = new Logger('main/transcoders/fftool-core');

/**
 * Raw CLI ffmpeg/ffprobe transcoder backend.
 * @class FFToolCore
 * @implements ITranscoder
 *
 * `getInfo` spawns ffprobe with `-v quiet -print_format json -show_format
 * -show_streams` and maps the JSON through {@link mapFfprobeData}. `convert`
 * spawns ffmpeg with args from {@link buildFfmpegArgs}; progress is derived by
 * scanning stderr for `time=HH:MM:SS.mm` tokens and re-emitting a
 * ConversionProgress on a `PROGRESS_INTERVAL_MS` timer (percent/eta/bitrate
 * stay at EMPTY_PROGRESS values, speed is approximated from timemark vs elapsed
 * wall time). Pause/resume suspend the OS process; cancel SIGKILLs it and
 * emits a cancelledError. Distinguishes itself from the fluent-ffmpeg backend
 * as an escape hatch when the library path misbehaves.
 */
export class FFToolCore implements ITranscoder {
  /** The live ffmpeg child process, or null when idle. */
  private process: ChildProcess | null = null;
  /** True once cancel() has been called; maps process errors to cancelledError. */
  private cancelled = false;
  /** PID of the spawned ffmpeg process, used for suspend/resume. */
  private processPid: number | null = null;

  /**
   * Returns the backend type identifier.
   * @returns {string} `'FFTOOL'` (from TRANSCODER_TYPES[1])
   */
  getType(): string {
    return TRANSCODER_TYPES[1];
  }

  /**
   * Reads media metadata by spawning an ffprobe subprocess.
   *
   * Spawns the resolved ffprobe binary with `-v quiet -print_format json
   * -show_format -show_streams <input>`, accumulates stdout, and on exit code 0
   * parses the JSON and maps it through {@link mapFfprobeData}. A spawn error
   * rejects with the raw error; a non-zero exit rejects with an
   * `Error('ffprobe exited with code <n>')`; a JSON parse failure rejects with
   * the parse error. No timeout is enforced here.
   * @param {string} input - Absolute path of the media file to probe
   * @returns {Promise<MediaInfo>} Resolves with the mapped media information
   * @throws {Error} Rejects on spawn failure, non-zero ffprobe exit, or
   *   malformed JSON output
   */
  async getInfo(input: string): Promise<MediaInfo> {
    log.info(LOG_GET_INFO, input);
    const ffprobePath = getFfprobePath();
    return new Promise((resolve, reject) => {
      const args = [
        FFPROBE_FLAGS.VERBOSE,
        FFPROBE_FLAGS.QUIET,
        FFPROBE_FLAGS.PRINT_FORMAT,
        FFPROBE_FLAGS.FORMAT_JSON,
        FFPROBE_FLAGS.SHOW_FORMAT,
        FFPROBE_FLAGS.SHOW_STREAMS,
        input,
      ];
      log.debug(LOG_FFPROBE_ARGS, args.join(' '));
      const proc = spawn(ffprobePath, args);
      let stdout = '';
      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.on('error', (err) => {
        log.error(LOG_GET_INFO_FFPROBE_SPAWN_ERROR, err);
        reject(err);
      });
      proc.on('close', (code: number | null) => {
        log.debug(LOG_FFPROBE_EXITED_WITH_CODE, code);
        if (code !== 0) return reject(new Error(`ffprobe exited with code ${code}`));
        try {
          const data = JSON.parse(stdout);
          const info = mapFfprobeData(data, input);
          log.info(LOG_GET_INFO_COMPLETED, info.format, info.duration);
          resolve(info);
        } catch (e) {
          log.error(LOG_GET_INFO_JSON_PARSE_ERROR, e);
          reject(e);
        }
      });
    });
  }

  /**
   * Starts a raw ffmpeg CLI conversion and returns an EventEmitter for it.
   *
   * Workflow: resets the `cancelled` flag, resolves the ffmpeg path, and builds
   * the argument array via {@link buildFfmpegArgs}. The process is spawned with
   * `this.process`/`this.processPid` recorded for pause/cancel. stderr is
   * accumulated and scanned for `time=HH:MM:SS.mm` tokens; the last matched
   * timestamp becomes `lastTime`. A `PROGRESS_INTERVAL_MS` timer emits a
   * ConversionProgress built from `lastTime` (percent 0, EMPTY_PROGRESS
   * fps/eta/bitrate, speed approximated as currentSeconds/elapsed). The
   * 'error' handler clears the timer and emits a cancelledError if cancelled,
   * else the raw error; the 'close' handler clears the timer, emits a
   * cancelledError if cancelled, `end` on exit code 0, or an
   * `Error('FFmpeg exited with code <n>')` otherwise.
   * @param {string} input - Absolute path of the input media file
   * @param {string} output - Absolute path of the output file
   * @param {ConversionOptions} options - Encoding options forwarded to the
   *   ffmpeg argument builder
   * @returns {EventEmitter} Emitter with periodic 'progress' (ConversionProgress)
   *   events plus 'end' and 'error' (Error) events
   */
  convert(input: string, output: string, options: ConversionOptions): EventEmitter {
    log.info(LOG_CONVERT, input, LOG_ARROW, output, LOG_COPY, !!options.copy);
    this.cancelled = false;
    const emitter = new EventEmitter();
    const ffmpegPath = getFfmpegPath();
    const args = buildFfmpegArgs(input, output, options);
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let lastTime: string = EMPTY_PROGRESS.time;
    const progressStart = Date.now();

    log.debug(LOG_FFMPEG_COMMAND, ffmpegPath, args.join(' '));

    const proc = spawn(ffmpegPath, args);
    this.process = proc;
    this.processPid = proc.pid ?? null;

    let stderrData = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrData += chunk.toString();
      const matches = stderrData.match(PROGRESS_PATTERNS.TIME);
      if (matches?.length) {
        lastTime = matches[matches.length - 1].replace('time=', '');
      }
    });

    progressTimer = setInterval(() => {
      const elapsed = (Date.now() - progressStart) / 1000;
      const parts = lastTime.split(':').map(Number);
      const currentSeconds = parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
      const progress: ConversionProgress = {
        percent: 0,
        time: lastTime,
        fps: EMPTY_PROGRESS.fps,
        speed: currentSeconds > 0 && elapsed > 0 ? `${(currentSeconds / elapsed).toFixed(1)}x` : EMPTY_PROGRESS.speed,
        eta: EMPTY_PROGRESS.eta,
        bitrate: EMPTY_PROGRESS.bitrate,
      };
      emitter.emit('progress', progress);
    }, TRANSCODER_DEFAULTS.PROGRESS_INTERVAL_MS);

    proc.on('error', (err: Error) => {
      if (this.cancelled) {
        if (progressTimer) clearInterval(progressTimer);
        log.info(LOG_FFMPEG_PROCESS_CANCELLED);
        emitter.emit('error', cancelledError());
        return;
      }
      log.error(LOG_FFMPEG_PROCESS_ERROR, err);
      if (progressTimer) clearInterval(progressTimer);
      emitter.emit('error', err);
    });

    proc.on('close', (code: number | null) => {
      log.debug(LOG_FFMPEG_EXITED_WITH_CODE, code);
      if (progressTimer) clearInterval(progressTimer);
      if (this.cancelled) {
        log.info(LOG_FFMPEG_PROCESS_CANCELLED);
        emitter.emit('error', cancelledError());
        return;
      }
      if (code === 0) {
        log.info(LOG_FFMPEG_PROCESS_COMPLETED_SUCCESSFULLY);
        emitter.emit('end');
      } else {
        log.error(LOG_FFMPEG_PROCESS_FAILED_WITH_CODE, code);
        emitter.emit('error', new Error(`FFmpeg exited with code ${code}`));
      }
    });

    return emitter;
  }

  /**
   * Pauses the running conversion by suspending the ffmpeg OS process.
   *
   * Delegates to {@link suspendProcess} with the recorded PID; no-op when no
   * PID is recorded.
   */
  pause(): void {
    log.info(LOG_PAUSING_FFMPEG_PROCESS);
    if (this.processPid != null) {
      suspendProcess(this.processPid);
    }
  }

  /**
   * Resumes a previously paused conversion.
   *
   * Delegates to {@link resumeProcess} with the recorded PID; no-op when no
   * PID is recorded.
   */
  resume(): void {
    log.info(LOG_RESUMING_FFMPEG_PROCESS);
    if (this.processPid != null) {
      resumeProcess(this.processPid);
    }
  }

  /**
   * Cancels the running conversion.
   *
   * Sets the `cancelled` flag (making the pending error/close handlers emit a
   * cancelledError), kills the ffmpeg child with KILL_SIGNAL (SIGKILL), and
   * clears the process/PID references.
   */
  cancel(): void {
    log.info(LOG_CANCELLING_CURRENT_FFMPEG_PROCESS);
    this.cancelled = true;
    if (this.process) {
      this.process.kill(KILL_SIGNAL);
      this.process = null;
      this.processPid = null;
      log.info(LOG_FFMPEG_PROCESS_KILLED);
    }
  }
}
