import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
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

const log = new Logger('main/transcoders/fftool-core');

export class FFToolCore implements ITranscoder {
  private process: ChildProcess | null = null;
  private cancelled = false;
  private processPid: number | null = null;

  getType(): string {
    return TRANSCODER_TYPES[1];
  }

  async getInfo(input: string): Promise<MediaInfo> {
    log.info('getInfo:', input);
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
      log.debug('ffprobe args:', args.join(' '));
      const proc = spawn(ffprobePath, args);
      let stdout = '';
      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.on('error', (err) => {
        log.error('getInfo ffprobe spawn error:', err);
        reject(err);
      });
      proc.on('close', (code: number | null) => {
        log.debug('ffprobe exited with code:', code);
        if (code !== 0) return reject(new Error(`ffprobe exited with code ${code}`));
        try {
          const data = JSON.parse(stdout);
          const info = mapFfprobeData(data, input);
          log.info('getInfo completed:', info.format, info.duration);
          resolve(info);
        } catch (e) {
          log.error('getInfo JSON parse error:', e);
          reject(e);
        }
      });
    });
  }

  convert(input: string, output: string, options: ConversionOptions): EventEmitter {
    log.info('convert:', input, '->', output, 'copy:', !!options.copy);
    this.cancelled = false;
    const emitter = new EventEmitter();
    const ffmpegPath = getFfmpegPath();
    const args = buildFfmpegArgs(input, output, options);
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let lastTime: string = EMPTY_PROGRESS.time;
    const progressStart = Date.now();

    log.debug('FFmpeg command:', ffmpegPath, args.join(' '));

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
        log.info('FFmpeg process cancelled');
        emitter.emit('error', cancelledError());
        return;
      }
      log.error('FFmpeg process error:', err);
      if (progressTimer) clearInterval(progressTimer);
      emitter.emit('error', err);
    });

    proc.on('close', (code: number | null) => {
      log.debug('FFmpeg exited with code:', code);
      if (progressTimer) clearInterval(progressTimer);
      if (this.cancelled) {
        log.info('FFmpeg process cancelled');
        emitter.emit('error', cancelledError());
        return;
      }
      if (code === 0) {
        log.info('FFmpeg process completed successfully');
        emitter.emit('end');
      } else {
        log.error('FFmpeg process failed with code:', code);
        emitter.emit('error', new Error(`FFmpeg exited with code ${code}`));
      }
    });

    return emitter;
  }

  pause(): void {
    log.info('Pausing FFmpeg process');
    if (this.processPid != null) {
      suspendProcess(this.processPid);
    }
  }

  resume(): void {
    log.info('Resuming FFmpeg process');
    if (this.processPid != null) {
      resumeProcess(this.processPid);
    }
  }

  cancel(): void {
    log.info('Cancelling current FFmpeg process');
    this.cancelled = true;
    if (this.process) {
      this.process.kill(KILL_SIGNAL);
      this.process = null;
      this.processPid = null;
      log.info('FFmpeg process killed');
    }
  }
}
