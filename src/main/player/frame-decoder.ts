import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { existsSync } from 'fs';
import { FFMPEG_FLAGS, KILL_SIGNAL, TRANSCODER_DEFAULTS } from '../../shared/transcoder-constants';

export interface DecodedFrame {
  buffer: Buffer;
  width: number;
  height: number;
  pts: number;
}

function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  return 'ffmpeg';
}

export class FrameDecoder extends EventEmitter {
  private process: ChildProcess | null = null;
  private width = 0;
  private height = 0;
  private frameSize = 0;
  private buffer = Buffer.alloc(0);
  private running = false;

  open(input: string, width = TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH, height = TRANSCODER_DEFAULTS.PLAYER_DEFAULT_HEIGHT): void {
    this.width = width;
    this.height = height;
    this.frameSize = width * height * 3;
    this.buffer = Buffer.alloc(0);
    this.running = true;

    const ffmpegPath = getFfmpegPath();
    const args = [
      FFMPEG_FLAGS.INPUT,
      input,
      '-f',
      FFMPEG_FLAGS.RAWVIDEO,
      FFMPEG_FLAGS.PIX_FMT,
      FFMPEG_FLAGS.PIX_FMT_RGB24,
      '-s',
      `${width}x${height}`,
      FFMPEG_FLAGS.NO_AUDIO,
      FFMPEG_FLAGS.NO_SUBTITLES,
      FFMPEG_FLAGS.NO_DATA,
      FFMPEG_FLAGS.OUTPUT_PIPE,
    ];

    this.process = spawn(ffmpegPath, args);
    let pts = 0;

    this.process.stdout?.on('data', (chunk: Buffer) => {
      if (!this.running) return;
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

    this.process.stderr?.on('data', () => {});

    this.process.on('error', (err) => this.emit('error', err));

    this.process.on('close', (code) => {
      this.running = false;
      if (code !== 0) {
        this.emit('error', new Error(`Decoder exited with code ${code}`));
      }
      this.emit('end');
    });
  }

  seek(seekTo: string): void {
    this.close();
    this.emit('seek', seekTo);
  }

  close(): void {
    this.running = false;
    if (this.process) {
      this.process.kill(KILL_SIGNAL);
      this.process = null;
    }
    this.buffer = Buffer.alloc(0);
  }
}
