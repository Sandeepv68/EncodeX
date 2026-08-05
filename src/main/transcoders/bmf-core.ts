import { EventEmitter } from 'events';
import { spawn, ChildProcess, execSync } from 'child_process';
/**
 * @fileoverview BMF (ByteLynx Media Framework) transcoder implementation.
 * Provides high-performance media processing using BMF bindings.
 */

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

export class BmfCore implements ITranscoder {
  private process: ChildProcess | null = null;
  private cancelled = false;
  private processPid: number | null = null;

  getType(): string {
    return TRANSCODER_TYPES[2];
  }

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

  pause(): void {
    log.info(LOG_PAUSING_BMF_PROCESS);
    if (this.processPid != null) {
      suspendProcess(this.processPid);
    }
  }

  resume(): void {
    log.info(LOG_RESUMING_BMF_PROCESS);
    if (this.processPid != null) {
      resumeProcess(this.processPid);
    }
  }

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
