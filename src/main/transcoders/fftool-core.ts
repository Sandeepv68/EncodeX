import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { existsSync } from 'fs';
import { ITranscoder } from './interface';
import { ConversionOptions, ConversionProgress, MediaInfo, MediaStreamInfo } from '../../shared/types';
import { FFMPEG_FLAGS, FFPROBE_FLAGS, PROGRESS_PATTERNS, TRANSCODER_TYPES, KILL_SIGNAL, TRANSCODER_DEFAULTS, EMPTY_PROGRESS } from '../../shared/transcoder-constants';

function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  return 'ffmpeg';
}

function getFfprobePath(): string {
  try {
    return require('ffprobe-static').path;
  } catch {
    return 'ffprobe';
  }
}

export class FFToolCore implements ITranscoder {
  private process: ChildProcess | null = null;

  getType(): string {
    return TRANSCODER_TYPES[1];
  }

  async getInfo(input: string): Promise<MediaInfo> {
    const ffprobePath = getFfprobePath();
    return new Promise((resolve, reject) => {
      const args = [
        FFPROBE_FLAGS.VERBOSE, FFPROBE_FLAGS.QUIET,
        FFPROBE_FLAGS.PRINT_FORMAT, FFPROBE_FLAGS.FORMAT_JSON,
        FFPROBE_FLAGS.SHOW_FORMAT,
        FFPROBE_FLAGS.SHOW_STREAMS,
        input,
      ];
      const proc = spawn(ffprobePath, args);
      let stdout = '';
      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.on('error', reject);
      proc.on('close', (code: number | null) => {
        if (code !== 0) return reject(new Error(`ffprobe exited with code ${code}`));
        try {
          const data = JSON.parse(stdout);
          const streams: MediaStreamInfo[] = (data.streams || []).map((s: Record<string, unknown>) => ({
            index: (s.index as number) ?? 0,
            type: (s.codec_type as string) ?? 'video',
            codec: (s.codec_name as string) ?? 'unknown',
            codecLong: s.codec_long_name as string | undefined,
            width: s.width as number | undefined,
            height: s.height as number | undefined,
            pixelFormat: s.pix_fmt as string | undefined,
            frameRate: s.r_frame_rate as string | undefined,
            bitrate: s.bit_rate != null ? String(s.bit_rate as string) : undefined,
            sampleRate: s.sample_rate as number | undefined,
            channels: s.channels as number | undefined,
            duration: s.duration != null ? Number(s.duration as string) : undefined,
            language: (s.tags as Record<string, unknown> | undefined)?.language as string | undefined,
          }));
          const fmt = data.format || {};
          resolve({
            file: fmt.filename ?? input,
            format: fmt.format_name ?? 'unknown',
            size: fmt.size ?? 0,
            duration: fmt.duration != null ? Number(fmt.duration) : 0,
            bitrate: fmt.bit_rate != null ? String(fmt.bit_rate) : 'N/A',
            streams,
          });
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  convert(input: string, output: string, options: ConversionOptions): EventEmitter {
    const emitter = new EventEmitter();
    const ffmpegPath = getFfmpegPath();
    const args: string[] = [FFMPEG_FLAGS.INPUT, input];
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let lastTime: string = EMPTY_PROGRESS.time;
    const progressStart = Date.now();

    if (options.copy) {
      args.push(FFMPEG_FLAGS.COPY, FFMPEG_FLAGS.COPY_VALUE);
    } else {
      if (options.videoCodec) args.push(FFMPEG_FLAGS.VIDEO_CODEC, options.videoCodec);
      if (options.audioCodec) args.push(FFMPEG_FLAGS.AUDIO_CODEC, options.audioCodec);
      if (options.videoBitrate) args.push(FFMPEG_FLAGS.VIDEO_BITRATE, options.videoBitrate);
      if (options.audioBitrate) args.push(FFMPEG_FLAGS.AUDIO_BITRATE, options.audioBitrate);
      if (options.qscale !== undefined) args.push(FFMPEG_FLAGS.QSCALE, String(options.qscale));
      if (options.scale) args.push(FFMPEG_FLAGS.VIDEO_FILTER, `${FFMPEG_FLAGS.SCALE}${options.scale}`);
      if (options.pixelFormat) args.push(FFMPEG_FLAGS.PIX_FMT, options.pixelFormat);
    }

    if (options.startTime) args.push(FFMPEG_FLAGS.START, options.startTime);
    if (options.endTime) args.push(FFMPEG_FLAGS.END, options.endTime);
    if (options.duration) args.push(FFMPEG_FLAGS.DURATION, options.duration);

    args.push(FFMPEG_FLAGS.OVERWRITE, output);

    const proc = spawn(ffmpegPath, args);
    this.process = proc;

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
      if (progressTimer) clearInterval(progressTimer);
      emitter.emit('error', err);
    });

    proc.on('close', (code: number | null) => {
      if (progressTimer) clearInterval(progressTimer);
      if (code === 0) {
        emitter.emit('end');
      } else {
        emitter.emit('error', new Error(`FFmpeg exited with code ${code}`));
      }
    });

    return emitter;
  }

  cancel(): void {
    if (this.process) {
      this.process.kill(KILL_SIGNAL);
      this.process = null;
    }
  }
}
