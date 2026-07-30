import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { existsSync } from 'fs';
import { Logger } from '../../shared/logger';
import { FFMPEG_FLAGS, KILL_SIGNAL, TRANSCODER_DEFAULTS } from '../../shared/transcoder-constants';

const log = new Logger('main/player/frame-decoder');

export interface DecodedFrame {
  buffer: Buffer;
  width: number;
  height: number;
  pts: number;
}

function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  log.warn('ffmpeg-static not found, falling back to system ffmpeg');
  return 'ffmpeg';
}

export class FrameDecoder extends EventEmitter {
  private process: ChildProcess | null = null;
  private width = 0;
  private height = 0;
  private frameSize = 0;
  private buffer = Buffer.alloc(0);
  private running = false;
  private inputPath = '';

  private spawnFfmpeg(seekTo?: string, width?: number, height?: number): void {
    if (width !== undefined) {
      this.width = width;
      this.height = height ?? this.height;
      this.frameSize = this.width * this.height * 3;
    }
    this.buffer = Buffer.alloc(0);
    this.running = true;

    const ffmpegPath = getFfmpegPath();
    const args: string[] = [];
    if (seekTo) {
      args.push('-ss', seekTo);
    }
    args.push(
      FFMPEG_FLAGS.REALTIME,
      FFMPEG_FLAGS.INPUT,
      this.inputPath,
      '-f',
      FFMPEG_FLAGS.RAWVIDEO,
      FFMPEG_FLAGS.PIX_FMT,
      FFMPEG_FLAGS.PIX_FMT_RGB24,
      '-s',
      `${this.width}x${this.height}`,
      FFMPEG_FLAGS.NO_AUDIO,
      FFMPEG_FLAGS.NO_SUBTITLES,
      FFMPEG_FLAGS.NO_DATA,
      FFMPEG_FLAGS.OUTPUT_PIPE,
    );

    log.debug('FFmpeg decoder args:', args.join(' '));
    const currentProcess = spawn(ffmpegPath, args);
    this.process = currentProcess;
    let pts = 0;

    currentProcess.stdout?.on('data', (chunk: Buffer) => {
      if (!this.running || this.process !== currentProcess) return;
      this.buffer = Buffer.concat([this.buffer, chunk]);

      while (this.buffer.length >= this.frameSize) {
        const frameData = this.buffer.subarray(0, this.frameSize);
        this.buffer = this.buffer.subarray(this.frameSize);
        this.emit('frame', {
          buffer: Buffer.from(frameData),
          width: this.width,
          height: this.height,
          pts,
        } as DecodedFrame);
        pts++;
      }
    });

    currentProcess.stderr?.on('data', () => {});

    currentProcess.on('error', (err) => {
      if (this.process !== currentProcess) return;
      log.error('Decoder process error:', err);
      this.emit('error', err);
    });

    currentProcess.on('close', (code) => {
      if (this.process !== currentProcess) return;
      log.debug('Decoder process exited with code:', code);
      this.running = false;
      if (code !== 0 && code !== null) {
        log.error('Decoder exited with non-zero code:', code);
        this.emit('error', new Error(`Decoder exited with code ${code}`));
      }
      this.emit('end');
    });
  }

  open(
    input: string,
    width: number = TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH,
    height: number = TRANSCODER_DEFAULTS.PLAYER_DEFAULT_HEIGHT,
  ): void {
    this.close();

    log.info('open:', input, 'resolution:', width, 'x', height);
    this.inputPath = input;
    this.width = width;
    this.height = height;
    this.frameSize = width * height * 3;

    this.spawnFfmpeg();
  }

  seek(seekTo: string): void {
    log.debug('seek:', seekTo);
    this.close();
    if (this.inputPath) {
      this.spawnFfmpeg(seekTo);
    }
    this.emit('seek', seekTo);
  }

  close(): void {
    log.debug('close');
    this.running = false;
    if (this.process) {
      this.process.kill(KILL_SIGNAL);
      this.process = null;
      log.debug('Decoder process killed');
    }
    this.buffer = Buffer.alloc(0);
  }
}
