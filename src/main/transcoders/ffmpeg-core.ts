import { EventEmitter } from 'events';
import ffmpeg from 'fluent-ffmpeg';
import type Ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { path as ffprobePath } from 'ffprobe-static';
import { existsSync } from 'fs';
import { Logger } from '../../shared/logger';
import { ITranscoder } from './interface';
import { ConversionOptions, ConversionProgress, MediaInfo, MediaStreamInfo } from '../../shared/types';
import { FFMPEG_FLAGS, TRANSCODER_TYPES, EMPTY_PROGRESS } from '../../shared/transcoder-constants';
import { suspendProcess, resumeProcess } from '../process-utils';

const log = new Logger('main/transcoders/ffmpeg-core');

const staticPath = ffmpegStatic as unknown as string;
if (existsSync(staticPath)) {
  ffmpeg.setFfmpegPath(staticPath);
  log.debug('FFmpeg path set to:', staticPath);
}

if (existsSync(ffprobePath)) {
  ffmpeg.setFfprobePath(ffprobePath);
  log.debug('FFprobe path set to:', ffprobePath);
}

function parseRatio(ratio: string): string {
  const parts = ratio.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (den !== 0) return (num / den).toFixed(2);
  }
  return ratio;
}

export class FfmpegCore implements ITranscoder {
  private currentProcess: ffmpeg.FfmpegCommand | null = null;
  private processPid: number | null = null;
  private cancelled = false;

  getType(): string {
    return TRANSCODER_TYPES[0];
  }

  getInfo(input: string): Promise<MediaInfo> {
    log.info('getInfo:', input);
    return new Promise((resolve, reject) => {
      const proc = ffmpeg(input);
      proc.ffprobe((err: Error | null, data: Ffmpeg.FfprobeData) => {
        if (err) {
          log.error('getInfo ffprobe failed:', err);
          return reject(err);
        }
        const streams: MediaStreamInfo[] = (data.streams || []).map((s: Ffmpeg.FfprobeStream) => ({
          index: s.index ?? 0,
          type: (s.codec_type as MediaStreamInfo['type']) ?? 'video',
          codec: s.codec_name ?? 'unknown',
          codecLong: s.codec_long_name,
          width: s.width,
          height: s.height,
          pixelFormat: s.pix_fmt,
          frameRate: s.r_frame_rate ? parseRatio(s.r_frame_rate) : undefined,
          bitrate: s.bit_rate != null ? String(s.bit_rate) : undefined,
          sampleRate: s.sample_rate,
          channels: s.channels,
          duration: s.duration != null ? Number(s.duration) : undefined,
          language: s.tags?.language as string | undefined,
        }));
        const fmt = data.format;
        log.info('getInfo completed:', fmt.format_name, fmt.duration?.toFixed(2) + 's');
        resolve({
          file: fmt.filename ?? input,
          format: fmt.format_name ?? 'unknown',
          size: fmt.size ?? 0,
          duration: fmt.duration != null ? Number(fmt.duration) : 0,
          bitrate: fmt.bit_rate != null ? String(fmt.bit_rate) : 'N/A',
          streams,
        });
      });
    });
  }

  convert(input: string, output: string, options: ConversionOptions): EventEmitter {
    log.info('convert:', input, '->', output, 'copy:', !!options.copy);
    this.cancelled = false;
    const progressStart = Date.now();
    const emitter = new EventEmitter();
    const cmd = ffmpeg({ source: input });

    if (options.copy) {
      log.debug('Using stream copy mode');
      cmd.outputOptions(FFMPEG_FLAGS.COPY, FFMPEG_FLAGS.COPY_VALUE);
    } else {
      if (options.videoCodec) {
        log.debug('Video codec:', options.videoCodec);
        cmd.videoCodec(options.videoCodec);
      }
      if (options.audioCodec) {
        log.debug('Audio codec:', options.audioCodec);
        cmd.audioCodec(options.audioCodec);
      }
      if (options.videoBitrate) {
        log.debug('Video bitrate:', options.videoBitrate);
        cmd.videoBitrate(options.videoBitrate);
      }
      if (options.audioBitrate) {
        log.debug('Audio bitrate:', options.audioBitrate);
        cmd.audioBitrate(options.audioBitrate);
      }
      if (options.qscale !== undefined) {
        log.debug('Qscale:', options.qscale);
        cmd.outputOptions(`${FFMPEG_FLAGS.QSCALE} ${options.qscale}`);
      }
      if (options.scale) {
        log.debug('Scale:', options.scale);
        cmd.size(options.scale);
      }
      if (options.pixelFormat) {
        log.debug('Pixel format:', options.pixelFormat);
        cmd.outputOptions(`${FFMPEG_FLAGS.PIX_FMT} ${options.pixelFormat}`);
      }
    }

    if (options.startTime) {
      log.debug('Start time:', options.startTime);
      cmd.setStartTime(options.startTime);
    }
    if (options.endTime) {
      log.debug('End time:', options.endTime);
      cmd.seekOutput(options.endTime);
    }
    if (options.duration) {
      log.debug('Duration:', options.duration);
      cmd.duration(options.duration);
    }

    cmd.output(output);
    cmd.on('start', (commandLine) => {
      log.debug('FFmpeg process started:', commandLine);
      const childProc = (cmd as any).ffmpegProc;
      if (childProc) this.processPid = childProc.pid;
      emitter.emit('start', commandLine);
    });
    cmd.on('codecData', (data) => {
      const childProc = (cmd as any).ffmpegProc;
      if (childProc) this.processPid = childProc.pid;
      emitter.emit('codecData', data);
    });
    cmd.on('progress', (info: { percent?: number; timemark?: string; currentFps?: number; speed?: string; currentKbps?: number }) => {
      const elapsed = (Date.now() - progressStart) / 1000;
      let eta: string = EMPTY_PROGRESS.eta;
      if (info.percent != null && info.percent > 0) {
        eta = ((elapsed / info.percent) * (100 - info.percent)).toFixed(0);
      } else if (info.speed && info.timemark) {
        const speed = parseFloat(info.speed.replace('x', ''));
        const parts = info.timemark.split(':').map(Number);
        if (speed > 0 && parts.length === 3 && !parts.some(isNaN)) {
          const currentSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
          const remainingEst = elapsed - currentSec / speed;
          if (remainingEst > 0) eta = remainingEst.toFixed(0);
        }
      }
      const progress: ConversionProgress = {
        percent: info.percent ?? 0,
        time: info.timemark ?? EMPTY_PROGRESS.time,
        fps: info.currentFps ?? 0,
        speed: info.speed ?? EMPTY_PROGRESS.speed,
        eta,
        bitrate: info.currentKbps ? `${info.currentKbps}kbps` : '',
      };
      emitter.emit('progress', progress);
    });
    cmd.on('error', (err: Error) => {
      if (this.cancelled) {
        log.info('FFmpeg process cancelled');
        emitter.emit('end');
        return;
      }
      log.error('FFmpeg process error:', err);
      emitter.emit('error', err);
    });
    cmd.on('end', () => {
      log.info('FFmpeg process ended successfully');
      emitter.emit('end');
    });

    this.currentProcess = cmd;
    cmd.run();
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
    if (this.currentProcess) {
      this.currentProcess.kill('SIGKILL');
      this.currentProcess = null;
      log.info('FFmpeg process killed');
    }
  }
}
