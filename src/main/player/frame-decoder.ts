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
  generation: number;
}

export interface DecodedAudio {
  buffer: Buffer;
  sampleRate: number;
  channels: number;
  generation: number;
}

export interface AudioDecodeConfig {
  sampleRate: number;
  channels: number;
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
  private audioSampleRate = 0;
  private audioChannels = 0;
  private generation = 0;

  getGeneration(): number {
    return this.generation;
  }

  private spawnFfmpeg(seekTo?: string, width?: number, height?: number, audio?: AudioDecodeConfig): void {
    if (width !== undefined) {
      this.width = width;
      this.height = height ?? this.height;
      this.frameSize = this.width * this.height * 3;
    }
    this.buffer = Buffer.alloc(0);
    this.running = true;
    const generation = ++this.generation;

    const ffmpegPath = getFfmpegPath();
    const args: string[] = [];
    if (seekTo) {
      args.push('-ss', seekTo);
    }
    args.push(FFMPEG_FLAGS.COPYTS, FFMPEG_FLAGS.REALTIME, FFMPEG_FLAGS.INPUT, this.inputPath);

    args.push('-vf', 'showinfo');

    if (audio) {
      this.audioSampleRate = audio.sampleRate;
      this.audioChannels = audio.channels;
      args.push(
        '-map',
        '0:v:0',
        '-f',
        FFMPEG_FLAGS.RAWVIDEO,
        FFMPEG_FLAGS.PIX_FMT,
        FFMPEG_FLAGS.PIX_FMT_RGB24,
        '-s',
        `${this.width}x${this.height}`,
        FFMPEG_FLAGS.NO_AUDIO,
        FFMPEG_FLAGS.NO_SUBTITLES,
        FFMPEG_FLAGS.NO_DATA,
        'pipe:1',
        '-map',
        '0:a:0',
        '-f',
        's16le',
        '-ac',
        String(audio.channels),
        '-ar',
        String(audio.sampleRate),
        'pipe:3',
      );
    } else {
      args.push(
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
    }

    log.debug('FFmpeg decoder args:', args.join(' '));
    const currentProcess = audio ? spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe', 'pipe'] }) : spawn(ffmpegPath, args);
    this.process = currentProcess;
    const pendingPts: number[] = [];
    const pendingFrames: Buffer[] = [];
    let stderrBuf = '';

    const emitAvailable = () => {
      if (!this.running || this.process !== currentProcess) return;
      while (pendingFrames.length > 0 && pendingPts.length > 0) {
        const frameData = pendingFrames.shift()!;
        const pts = pendingPts.shift()!;
        this.emit('frame', {
          buffer: frameData,
          width: this.width,
          height: this.height,
          pts,
          generation,
        } as DecodedFrame);
      }
    };

    currentProcess.stderr?.on('data', (chunk: Buffer) => {
      if (!this.running || this.process !== currentProcess) return;
      stderrBuf += chunk.toString('utf8');
      const re = /pts_time:\s*([0-9]+(?:\.[0-9]+)?)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(stderrBuf)) !== null) {
        pendingPts.push(Number(match[1]));
        lastIndex = re.lastIndex;
      }
      stderrBuf = stderrBuf.slice(lastIndex);
      emitAvailable();
    });

    currentProcess.stdout?.on('data', (chunk: Buffer) => {
      if (!this.running || this.process !== currentProcess) return;
      this.buffer = Buffer.concat([this.buffer, chunk]);

      while (this.buffer.length >= this.frameSize) {
        const frameData = this.buffer.subarray(0, this.frameSize);
        this.buffer = this.buffer.subarray(this.frameSize);
        pendingFrames.push(Buffer.from(frameData));
      }
      emitAvailable();
    });

    if (audio) {
      currentProcess.stdio?.[3]?.on('data', (chunk: Buffer) => {
        if (!this.running || this.process !== currentProcess) return;
        this.emit('audio', {
          buffer: Buffer.from(chunk),
          sampleRate: audio.sampleRate,
          channels: audio.channels,
          generation,
        } as DecodedAudio);
      });
    }

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
    audio?: AudioDecodeConfig,
  ): void {
    this.close();

    log.info('open:', input, 'resolution:', width, 'x', height, 'audio:', audio);
    this.inputPath = input;
    this.width = width;
    this.height = height;
    this.frameSize = width * height * 3;
    this.audioSampleRate = audio?.sampleRate ?? 0;
    this.audioChannels = audio?.channels ?? 0;

    this.spawnFfmpeg(undefined, undefined, undefined, audio);
  }

  seek(seekTo: string): void {
    log.debug('seek:', seekTo);
    this.close();
    if (this.inputPath) {
      this.spawnFfmpeg(
        seekTo,
        undefined,
        undefined,
        this.audioSampleRate ? { sampleRate: this.audioSampleRate, channels: this.audioChannels } : undefined,
      );
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
