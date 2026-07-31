import { EventEmitter } from 'events';
import { spawn, ChildProcess, execSync } from 'child_process';
import { Logger } from '../../shared/logger';
import { ITranscoder } from './interface';
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

const log = new Logger('main/transcoders/bmf-core');

export class BmfCore implements ITranscoder {
  private process: ChildProcess | null = null;
  private cancelled = false;
  private processPid: number | null = null;

  getType(): string {
    return TRANSCODER_TYPES[2];
  }

  async getInfo(input: string): Promise<MediaInfo> {
    log.info('getInfo:', input);
    try {
      const cmd = `${TRANSCODER_COMMANDS.BMF_FFPROBE} -v quiet -print_format json -show_format -show_streams "${input}"`;
      log.debug('BMF ffprobe command:', cmd);
      const result = execSync(cmd, {
        encoding: 'utf-8' as BufferEncoding,
        timeout: TRANSCODER_DEFAULTS.BMF_TIMEOUT_MS,
      });
      const data = JSON.parse(result as string);
      const info = mapFfprobeData(data, input);
      log.info('getInfo completed:', info.format, info.duration);
      return info;
    } catch (err) {
      log.error('getInfo failed - BMF not available:', err);
      throw new Error('BMF not available. Please ensure BMF CLI tools are installed.');
    }
  }

  convert(input: string, output: string, options: ConversionOptions): EventEmitter {
    log.info('convert:', input, '->', output, 'copy:', !!options.copy);
    this.cancelled = false;
    const emitter = new EventEmitter();
    const args = buildFfmpegArgs(input, output, options);

    log.debug('BMF command:', TRANSCODER_COMMANDS.BMF_FFMPEG, args.join(' '));

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
          log.info('BMF process cancelled');
          emitter.emit('end');
          return;
        }
        log.error('BMF process error:', err);
        emitter.emit('error', err);
      });
      proc.on('close', (code: number | null) => {
        log.debug('BMF exited with code:', code);
        if (this.cancelled) {
          log.info('BMF process cancelled');
          emitter.emit('end');
          return;
        }
        if (code === 0) {
          log.info('BMF process completed successfully');
          emitter.emit('end');
        } else {
          log.error('BMF process failed with code:', code, 'stderr:', stderrData.slice(-200));
          emitter.emit('error', new Error(`BMF exited with code ${code}: ${stderrData.slice(-200)}`));
        }
      });
    } catch (err) {
      log.error('BMF spawn error:', err);
      process.nextTick(() => emitter.emit('error', err));
    }

    return emitter;
  }

  pause(): void {
    log.info('Pausing BMF process');
    if (this.processPid != null) {
      suspendProcess(this.processPid);
    }
  }

  resume(): void {
    log.info('Resuming BMF process');
    if (this.processPid != null) {
      resumeProcess(this.processPid);
    }
  }

  cancel(): void {
    log.info('Cancelling current BMF process');
    this.cancelled = true;
    if (this.process) {
      this.process.kill(KILL_SIGNAL);
      this.process = null;
      this.processPid = null;
      log.info('BMF process killed');
    }
  }
}
