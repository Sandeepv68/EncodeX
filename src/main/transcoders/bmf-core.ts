import { EventEmitter } from 'events';
import { spawn, ChildProcess, execSync } from 'child_process';
import { ITranscoder } from './interface';
import { ConversionOptions, ConversionProgress, MediaInfo, MediaStreamInfo } from '../../shared/types';
import {
  TRANSCODER_TYPES,
  TRANSCODER_COMMANDS,
  TRANSCODER_DEFAULTS,
  KILL_SIGNAL,
  PROGRESS_PATTERNS,
  EMPTY_PROGRESS,
  FFMPEG_FLAGS,
} from '../../shared/transcoder-constants';

export class BmfCore implements ITranscoder {
  private process: ChildProcess | null = null;

  getType(): string {
    return TRANSCODER_TYPES[2];
  }

  async getInfo(input: string): Promise<MediaInfo> {
    try {
      const result = execSync(`${TRANSCODER_COMMANDS.BMF_FFPROBE} -v quiet -print_format json -show_format -show_streams "${input}"`, {
        encoding: 'utf-8' as BufferEncoding,
        timeout: TRANSCODER_DEFAULTS.BMF_TIMEOUT_MS,
      });
      const data = JSON.parse(result as string);
      const streams: MediaStreamInfo[] = (data.streams || []).map((s: Record<string, unknown>) => ({
        index: (s.index as number) ?? 0,
        type: (s.codec_type as string) ?? 'video',
        codec: (s.codec_name as string) ?? 'unknown',
        codecLong: s.codec_long_name as string | undefined,
        width: s.width as number | undefined,
        height: s.height as number | undefined,
        pixelFormat: s.pix_fmt as string | undefined,
        frameRate: s.r_frame_rate as string | undefined,
        bitrate: s.bit_rate as string | undefined,
        sampleRate: s.sample_rate as number | undefined,
        channels: s.channels as number | undefined,
        duration: s.duration ? parseFloat(s.duration as string) : undefined,
        language: (s.tags as Record<string, unknown> | undefined)?.language as string | undefined,
      }));
      return {
        file: data.format?.filename ?? input,
        format: data.format?.format_name ?? 'unknown',
        size: data.format?.size ?? 0,
        duration: data.format?.duration ? parseFloat(data.format.duration) : 0,
        bitrate: data.format?.bit_rate ?? 'N/A',
        streams,
      };
    } catch {
      throw new Error('BMF not available. Please ensure BMF CLI tools are installed.');
    }
  }

  convert(input: string, output: string, options: ConversionOptions): EventEmitter {
    const emitter = new EventEmitter();
    const args: string[] = [FFMPEG_FLAGS.INPUT, input];

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

    try {
      const proc = spawn(TRANSCODER_COMMANDS.BMF_FFMPEG, args);
      this.process = proc;

      let stderrData = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrData += chunk.toString();
        const timeMatch = stderrData.match(PROGRESS_PATTERNS.TIME_SINGLE);
        if (timeMatch) {
          emitter.emit('progress', { ...EMPTY_PROGRESS, time: timeMatch[1] } as ConversionProgress);
        }
      });

      proc.on('error', (err: Error) => emitter.emit('error', err));
      proc.on('close', (code: number | null) => {
        if (code === 0) emitter.emit('end');
        else emitter.emit('error', new Error(`BMF exited with code ${code}: ${stderrData.slice(-200)}`));
      });
    } catch (err) {
      process.nextTick(() => emitter.emit('error', err));
    }

    return emitter;
  }

  cancel(): void {
    if (this.process) {
      this.process.kill(KILL_SIGNAL);
      this.process = null;
    }
  }
}
