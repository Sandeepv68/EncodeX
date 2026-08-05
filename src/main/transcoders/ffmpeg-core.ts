import { EventEmitter } from 'events';
import ffmpeg from 'fluent-ffmpeg';
import type Ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { path as ffprobePath } from 'ffprobe-static';
import { existsSync } from 'fs';
import { Logger } from '../../shared/logger';
import { ITranscoder } from './interface';
import { ConversionOptions, ConversionProgress, MediaInfo } from '../../shared/types';
import { FFMPEG_FLAGS, TRANSCODER_TYPES, EMPTY_PROGRESS } from '../../shared/transcoder-constants';
import { suspendProcess, resumeProcess } from '../process-utils';
import { mapFfprobeData } from './ffprobe-mapper';
import { getHwAccelArgs } from './hwaccel';
import { cancelledError } from '../../shared/errors';
import {
  LOG_ARROW,
  LOG_AUDIO_BITRATE,
  LOG_AUDIO_CODEC,
  LOG_AUDIO_DISABLED_OUTPUT_WILL_HAVE_NO_AUDIO_STREAM,
  LOG_CANCELLING_CURRENT_FFMPEG_PROCESS,
  LOG_CONVERT,
  LOG_COPY,
  LOG_DURATION_CAPITALIZED,
  LOG_END_TIME,
  LOG_FFMPEG_PATH_SET_TO,
  LOG_FFMPEG_PROCESS_CANCELLED,
  LOG_FFMPEG_PROCESS_ENDED_SUCCESSFULLY,
  LOG_FFMPEG_PROCESS_ERROR,
  LOG_FFMPEG_PROCESS_KILLED,
  LOG_FFMPEG_PROCESS_STARTED,
  LOG_FFPROBE_PATH_SET_TO,
  LOG_FORCING_FULL_RANGE_COLOR_FOR_MJPEG_OUTPUT,
  LOG_GET_INFO,
  LOG_GET_INFO_COMPLETED,
  LOG_GET_INFO_FFPROBE_FAILED,
  LOG_HARDWARE_ACCELERATION_INPUT_OPTIONS,
  LOG_PAUSING_FFMPEG_PROCESS,
  LOG_PIXEL_FORMAT,
  LOG_QSCALE,
  LOG_RESUMING_FFMPEG_PROCESS,
  LOG_SCALE,
  LOG_SCALE_KEEP_ASPECT_RATIO,
  LOG_START_TIME,
  LOG_USING_STREAM_COPY_MODE,
  LOG_VIDEO_BITRATE,
  LOG_VIDEO_CODEC,
} from '../../shared/log-constants';

const log = new Logger('main/transcoders/ffmpeg-core');

const staticPath = ffmpegStatic as unknown as string;
if (existsSync(staticPath)) {
  ffmpeg.setFfmpegPath(staticPath);
  log.debug(LOG_FFMPEG_PATH_SET_TO, staticPath);
}

if (existsSync(ffprobePath)) {
  ffmpeg.setFfprobePath(ffprobePath);
  log.debug(LOG_FFPROBE_PATH_SET_TO, ffprobePath);
}

export class FfmpegCore implements ITranscoder {
  private currentProcess: ffmpeg.FfmpegCommand | null = null;
  private processPid: number | null = null;
  private cancelled = false;
  private sourceDuration = 0;

  getType(): string {
    return TRANSCODER_TYPES[0];
  }

  getInfo(input: string): Promise<MediaInfo> {
    log.info(LOG_GET_INFO, input);
    return new Promise((resolve, reject) => {
      const proc = ffmpeg(input);
      proc.ffprobe((err: Error | null, data: Ffmpeg.FfprobeData) => {
        if (err) {
          log.error(LOG_GET_INFO_FFPROBE_FAILED, err);
          return reject(err);
        }
        const info = mapFfprobeData(data, input);
        log.info(LOG_GET_INFO_COMPLETED, info.format, info.duration.toFixed(2) + 's');
        resolve(info);
      });
    });
  }

  convert(input: string, output: string, options: ConversionOptions): EventEmitter {
    log.info(LOG_CONVERT, input, LOG_ARROW, output, LOG_COPY, !!options.copy);
    this.cancelled = false;
    this.sourceDuration = 0;
    this.getInfo(input)
      .then((info) => {
        this.sourceDuration = info.duration;
      })
      .catch(() => {});
    const progressStart = Date.now();
    const emitter = new EventEmitter();
    const cmd = ffmpeg({ source: input });

    if (!options.copy) {
      const hwAccelArgs = getHwAccelArgs(options.videoCodec, options.hardwareAcceleration, options.hwaccelMode);
      if (hwAccelArgs.length > 0) {
        log.debug(LOG_HARDWARE_ACCELERATION_INPUT_OPTIONS, hwAccelArgs.join(' '));
        cmd.inputOptions(hwAccelArgs);
      }
    }

    if (options.copy) {
      log.debug(LOG_USING_STREAM_COPY_MODE);
      cmd.outputOptions(FFMPEG_FLAGS.COPY, FFMPEG_FLAGS.COPY_VALUE);
    } else {
      if (options.videoCodec) {
        log.debug(LOG_VIDEO_CODEC, options.videoCodec);
        cmd.videoCodec(options.videoCodec);
      }
      if (options.audioCodec) {
        log.debug(LOG_AUDIO_CODEC, options.audioCodec);
        cmd.audioCodec(options.audioCodec);
      }
      if (options.videoBitrate) {
        log.debug(LOG_VIDEO_BITRATE, options.videoBitrate);
        cmd.videoBitrate(options.videoBitrate);
      }
      if (options.audioBitrate) {
        log.debug(LOG_AUDIO_BITRATE, options.audioBitrate);
        cmd.audioBitrate(options.audioBitrate);
      }
      if (options.qscale !== undefined) {
        log.debug(LOG_QSCALE, options.qscale);
        cmd.outputOptions(`${FFMPEG_FLAGS.QSCALE} ${options.qscale}`);
      }
      if (options.scale) {
        if (options.keepAspectRatio) {
          log.debug(LOG_SCALE_KEEP_ASPECT_RATIO, options.scale);
          cmd.videoFilters(`${FFMPEG_FLAGS.SCALE}${options.scale.replace(/x.*$/, ':-2')}`);
        } else {
          log.debug(LOG_SCALE, options.scale);
          cmd.size(options.scale);
        }
      }
      if (options.pixelFormat) {
        log.debug(LOG_PIXEL_FORMAT, options.pixelFormat);
        cmd.outputOptions(`${FFMPEG_FLAGS.PIX_FMT} ${options.pixelFormat}`);
      }
      if (options.videoCodec === 'mjpeg') {
        log.debug(LOG_FORCING_FULL_RANGE_COLOR_FOR_MJPEG_OUTPUT);
        cmd.outputOptions(FFMPEG_FLAGS.COLOR_RANGE, FFMPEG_FLAGS.COLOR_RANGE_FULL);
      }
    }

    if (options.audio === false) {
      log.debug(LOG_AUDIO_DISABLED_OUTPUT_WILL_HAVE_NO_AUDIO_STREAM);
      cmd.outputOptions(FFMPEG_FLAGS.NO_AUDIO);
    }

    if (options.startTime) {
      log.debug(LOG_START_TIME, options.startTime);
      cmd.setStartTime(options.startTime);
    }
    if (options.endTime) {
      log.debug(LOG_END_TIME, options.endTime);
      cmd.inputOptions(FFMPEG_FLAGS.END, options.endTime);
    }
    if (options.duration) {
      log.debug(LOG_DURATION_CAPITALIZED, options.duration);
      cmd.duration(options.duration);
    }

    cmd.output(output);
    cmd.on('start', (commandLine) => {
      log.debug(LOG_FFMPEG_PROCESS_STARTED, commandLine);
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
      const timemarkParts = info.timemark ? info.timemark.split(':').map(Number) : null;
      const currentSec =
        timemarkParts && timemarkParts.length === 3 && !timemarkParts.some(isNaN)
          ? timemarkParts[0] * 3600 + timemarkParts[1] * 60 + timemarkParts[2]
          : 0;

      let percent = info.percent;
      if (percent == null && this.sourceDuration > 0 && currentSec > 0) {
        percent = (currentSec / this.sourceDuration) * 100;
      }

      let speed = info.speed;
      if (speed == null && elapsed > 0) {
        speed = `${(currentSec / elapsed).toFixed(2)}x`;
      }

      let eta: string = EMPTY_PROGRESS.eta;
      if (percent != null && percent > 0) {
        eta = ((elapsed / percent) * (100 - percent)).toFixed(0);
      } else if (speed && currentSec > 0) {
        const speedNum = parseFloat(speed.replace('x', ''));
        if (speedNum > 0) {
          const remainingEst = elapsed - currentSec / speedNum;
          if (remainingEst > 0) eta = remainingEst.toFixed(0);
        }
      }

      const progress: ConversionProgress = {
        percent: percent ?? 0,
        time: info.timemark ?? EMPTY_PROGRESS.time,
        fps: info.currentFps ?? 0,
        speed: speed ?? EMPTY_PROGRESS.speed,
        eta,
        bitrate: info.currentKbps ? `${info.currentKbps}kbps` : '',
      };
      emitter.emit('progress', progress);
    });
    cmd.on('error', (err: Error) => {
      if (this.cancelled) {
        log.info(LOG_FFMPEG_PROCESS_CANCELLED);
        emitter.emit('error', cancelledError());
        return;
      }
      log.error(LOG_FFMPEG_PROCESS_ERROR, err);
      emitter.emit('error', err);
    });
    cmd.on('end', () => {
      log.info(LOG_FFMPEG_PROCESS_ENDED_SUCCESSFULLY);
      emitter.emit('end');
    });

    this.currentProcess = cmd;
    cmd.run();
    return emitter;
  }

  pause(): void {
    log.info(LOG_PAUSING_FFMPEG_PROCESS);
    if (this.processPid != null) {
      suspendProcess(this.processPid);
    }
  }

  resume(): void {
    log.info(LOG_RESUMING_FFMPEG_PROCESS);
    if (this.processPid != null) {
      resumeProcess(this.processPid);
    }
  }

  cancel(): void {
    log.info(LOG_CANCELLING_CURRENT_FFMPEG_PROCESS);
    this.cancelled = true;
    if (this.currentProcess) {
      this.currentProcess.kill('SIGKILL');
      this.currentProcess = null;
      log.info(LOG_FFMPEG_PROCESS_KILLED);
    }
  }
}
