import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
/**
 * @fileoverview FFTool-based transcoder implementation.
 * Alternative transcoder using FFTool CLI for cross-platform support.
 */

import { Logger } from '../../shared/logger';
import { ITranscoder } from './interface';
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

export class FFToolCore implements ITranscoder {
  private process: ChildProcess | null = null;
  private cancelled = false;
  private processPid: number | null = null;

  getType(): string {
    return TRANSCODER_TYPES[1];
  }

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

  pause(): void {
    log.info(LOG_PAUSING_FFMPEG_PROCESS);
    if (this.processPid != null) {
      suspendProcess(this.processPid);
    }
  }

  resume(): void {
    log.info(LOG_RESUMING_FFMPEG_PROCESS);
    if (this.processPid != null) {
      resumeProcess(this.processPid);
    }
  }

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
