import { EventEmitter } from 'events';
import { spawn, ChildProcess, execSync } from 'child_process';
import { Logger } from '../../shared/logger';
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

const log = new Logger('main/transcoders/bmf-core');

export class BmfCore implements ITranscoder {
  private process: ChildProcess | null = null;

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
      log.info('getInfo completed:', data.format?.format_name, data.format?.duration);
      return {
        file: data.format?.filename ?? input,
        format: data.format?.format_name ?? 'unknown',
        size: data.format?.size ?? 0,
        duration: data.format?.duration ? parseFloat(data.format.duration) : 0,
        bitrate: data.format?.bit_rate ?? 'N/A',
        streams,
      };
    } catch (err) {
      log.error('getInfo failed - BMF not available:', err);
      throw new Error('BMF not available. Please ensure BMF CLI tools are installed.');
    }
  }

  convert(input: string, output: string, options: ConversionOptions): EventEmitter {
    log.info('convert:', input, '->', output, 'copy:', !!options.copy);
    const emitter = new EventEmitter();
    const args: string[] = [FFMPEG_FLAGS.INPUT, input];

    if (options.copy) {
      args.push(FFMPEG_FLAGS.COPY, FFMPEG_FLAGS.COPY_VALUE);
    } else {
      if (options.videoCodec) {
        args.push(FFMPEG_FLAGS.VIDEO_CODEC, options.videoCodec);
        log.debug('Video codec:', options.videoCodec);
      }
      if (options.audioCodec) {
        args.push(FFMPEG_FLAGS.AUDIO_CODEC, options.audioCodec);
        log.debug('Audio codec:', options.audioCodec);
      }
      if (options.videoBitrate) {
        args.push(FFMPEG_FLAGS.VIDEO_BITRATE, options.videoBitrate);
        log.debug('Video bitrate:', options.videoBitrate);
      }
      if (options.audioBitrate) {
        args.push(FFMPEG_FLAGS.AUDIO_BITRATE, options.audioBitrate);
        log.debug('Audio bitrate:', options.audioBitrate);
      }
      if (options.qscale !== undefined) {
        args.push(FFMPEG_FLAGS.QSCALE, String(options.qscale));
        log.debug('Qscale:', options.qscale);
      }
      if (options.scale) {
        args.push(FFMPEG_FLAGS.VIDEO_FILTER, `${FFMPEG_FLAGS.SCALE}${options.scale}`);
        log.debug('Scale:', options.scale);
      }
      if (options.pixelFormat) {
        args.push(FFMPEG_FLAGS.PIX_FMT, options.pixelFormat);
        log.debug('Pixel format:', options.pixelFormat);
      }
    }

    if (options.startTime) {
      args.push(FFMPEG_FLAGS.START, options.startTime);
      log.debug('Start time:', options.startTime);
    }
    if (options.endTime) {
      args.push(FFMPEG_FLAGS.END, options.endTime);
      log.debug('End time:', options.endTime);
    }
    if (options.duration) {
      args.push(FFMPEG_FLAGS.DURATION, options.duration);
      log.debug('Duration:', options.duration);
    }

    args.push(FFMPEG_FLAGS.OVERWRITE, output);

    log.debug('BMF command:', TRANSCODER_COMMANDS.BMF_FFMPEG, args.join(' '));

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

      proc.on('error', (err: Error) => {
        log.error('BMF process error:', err);
        emitter.emit('error', err);
      });
      proc.on('close', (code: number | null) => {
        log.debug('BMF exited with code:', code);
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

  cancel(): void {
    log.info('Cancelling current BMF process');
    if (this.process) {
      this.process.kill(KILL_SIGNAL);
      this.process = null;
      log.info('BMF process killed');
    }
  }
}
