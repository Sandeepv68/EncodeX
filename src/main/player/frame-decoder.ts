/**
 * @fileoverview FFmpeg frame and audio decoder for real-time media playback.
 * Spawns a persistent ffmpeg child process that streams raw RGB24 video frames
 * (pipe 1), raw S16LE PCM audio chunks (pipe 3) and `showinfo` PTS annotations
 * (stderr). The FrameDecoder reassembles the byte streams into discrete
 * frames/chunks, tracks presentation timestamps, and emits them as events to a
 * playback consumer. It supports realtime playback, fps capping, audio-only
 * decoding, and seek via process restarts with a generation counter so stale
 * data can be discarded.
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import { existsSync } from 'fs';
import { Logger } from '../../shared/logger';
import { FFMPEG_FLAGS, KILL_SIGNAL, TRANSCODER_DEFAULTS, TRANSCODER_COMMANDS } from '../../shared/transcoder-constants';
import {
  AUDIO_CHUNK_SECONDS,
  FRAME_FLUSH_THRESHOLD_MS,
  FRAME_FLUSH_INTERVAL_MS,
  FRAME_DURATION_SMOOTHING,
  DEFAULT_FRAME_DURATION,
  AUDIO_TARGET_MIN_BYTES,
  FRAME_BUFFER_OVERFLOW_WARN,
} from '../../shared/constants';
import type { DecodedFrame, DecodedAudio, AudioDecodeConfig, FrameDecoderOptions } from './types';
import {
  LOG_AUDIO,
  LOG_CLOSE,
  LOG_DECODER_EXITED_WITH_NON_ZERO_CODE,
  LOG_DECODER_PROCESS_ERROR,
  LOG_DECODER_PROCESS_EXITED_WITH_CODE,
  LOG_DECODER_PROCESS_KILLED,
  LOG_FFMPEG_DECODER_ARGS,
  LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG,
  LOG_OPEN,
  LOG_OPTIONS,
  LOG_RESOLUTION,
  LOG_SEEK,
} from '../../shared/log-constants';

const log = new Logger('main/player/frame-decoder');

/**
 * Resolves the ffmpeg executable path to use for decoding.
 *
 * Prefers the statically bundled ffmpeg binary shipped by `ffmpeg-static`;
 * if that binary is missing on disk it logs a warning and falls back to the
 * system `ffmpeg` command (see TRANSCODER_COMMANDS.FFMPEG).
 * @returns {string} Absolute path to the bundled ffmpeg binary, or the string
 *   `'ffmpeg'` for the system-installed executable
 */
function getFfmpegPath(): string {
  const staticPath = ffmpegStatic as unknown as string;
  if (existsSync(staticPath)) return staticPath;
  log.warn(LOG_FFMPEG_STATIC_NOT_FOUND_FALLING_BACK_TO_SYSTEM_FFMPEG);
  return TRANSCODER_COMMANDS.FFMPEG;
}

/**
 * Decodes video frames and audio from a media file via a spawned ffmpeg
 * process, emitting the decoded data as events.
 * @class FrameDecoder
 * @extends EventEmitter
 *
 * @emits {DecodedFrame} 'frame' - A complete raw RGB24 video frame with its
 *   width, height, presentation timestamp and decoder generation
 * @emits {DecodedAudio} 'audio' - A fixed-size S16LE PCM audio chunk with its
 *   sample rate, channel count and decoder generation
 * @emits {string} 'seek' - The timestamp string a seek was issued to
 * @emits {Error} 'error' - An ffmpeg spawn error, a non-zero exit code, or a
 *   cancelled decode (propagated by the process 'error'/'close' handlers)
 * @emits {void} 'end' - Emitted when the ffmpeg process exits (after any error)
 *
 * Internal buffering: video frames arrive as arbitrarily-sized stdout chunks
 * that are accumulated in `frameParts` until a full frame (`width*height*3`
 * bytes) can be assembled. Presentation timestamps are parsed out of the
 * `showinfo` filter output on stderr into `pendingPts`. Frames are only emitted
 * while their PTS values line up; if PTS lag behind for more than
 * `FRAME_FLUSH_THRESHOLD_MS`, an emergency flush emits the oldest pending frame
 * with a monotonic estimated PTS so playback never stalls permanently. Audio
 * chunks are accumulated into a fixed target size derived from the sample rate.
 */
export class FrameDecoder extends EventEmitter {
  /** The currently running ffmpeg child process, or null when idle. */
  private process: ChildProcess | null = null;
  /** Decode width in pixels (also used to derive `frameSize`). */
  private width = 0;
  /** Decode height in pixels. */
  private height = 0;
  /** Byte size of one RGB24 frame (`width * height * 3`). */
  private frameSize = 0;
  /** Pending stdout chunks not yet assembled into a full frame. */
  private frameParts: Buffer[] = [];
  /** Total byte length of `frameParts`, tracked to avoid repeated summing. */
  private framePartsLen = 0;
  /** Whether the current decode session is still active (stops stale handlers). */
  private running = false;
  /** Path of the input media file currently being decoded. */
  private inputPath = '';
  /** Sample rate of the audio stream requested for the current session. */
  private audioSampleRate = 0;
  /** Channel count of the audio stream requested for the current session. */
  private audioChannels = 0;
  /** Monotonic session counter; bumped on every ffmpeg spawn. */
  private generation = 0;
  /** Effective decoder options for the current session (defaults filled in). */
  private options: Required<FrameDecoderOptions> = { realtime: true, audioOnly: false, fpsCap: 0 };

  /**
   * Returns the current decoder generation counter.
   *
   * Consumers use this to detect that a seek/open happened since a frame was
   * captured and discard stale frames/audio belonging to an older session.
   * @returns {number} The generation of the current (or latest) ffmpeg spawn
   */
  getGeneration(): number {
    return this.generation;
  }

  /**
   * Spawns an ffmpeg process for the configured input and wires up all data
   * handling for frames, audio, and errors.
   *
   * Workflow: computes the current frame size from the supplied dimensions
   * (if given), resets the frame/audio buffers, marks the session running and
   * increments the generation. It then assembles the ffmpeg argument list:
   * - an optional `-ss <seekTo>` seek point,
   * - `-copyts` plus `-re` (when realtime) and `-i <inputPath>`,
   * - an `-vf fps=<cap>,showinfo` filter for the video pipe (fps cap optional),
   * - a video output of raw RGB24 at `width x height` (`-an -sn -dn`) to pipe 1,
   * - an optional second mapped audio output of S16LE PCM to pipe 3.
   *
   * stdout data is accumulated into frame-sized buffers (pulled off the front
   * of `frameParts` in a byte-shifting loop) and pushed onto `pendingFrames`.
   * stderr is scanned with a `pts_time` regex whose matches are pushed onto
   * `pendingPts`; every data event calls `emitAvailable()` which drains matched
   * frame/PTS pairs and, as a safety net, flushes the oldest buffered frame with
   * an estimated PTS if frames have been stuck for `FRAME_FLUSH_THRESHOLD_MS`.
   * A periodic `FRAME_FLUSH_INTERVAL_MS` interval keeps the buffer draining even
   * when no new data arrives. When audio is requested, fd 3 is accumulated into
   * fixed-size chunks (min `AUDIO_TARGET_MIN_BYTES` bytes) and emitted as
   * `audio` events. On process 'error'/'close', the interval is cleared and
   * `error`/`end` events are emitted. All handlers early-return when the session
   * was superseded (stale process or `running === false`).
   * @param {string} [seekTo] - Seek position passed to ffmpeg as `-ss`; when
   *   undefined decoding starts from the beginning of the file
   * @param {number} [width] - Decode width; when provided also (re)derives the
   *   height fallback and the per-frame byte size
   * @param {number} [height] - Decode height, only applied if `width` is given
   * @param {AudioDecodeConfig} [audio] - Optional audio decode config; when
   *   present enables the fd 3 PCM pipe (video pipe 1 stays active unless
   *   audioOnly is set)
   * @param {FrameDecoderOptions} [options] - Session options merged over the
   *   defaults `{ realtime: true, audioOnly: false, fpsCap: 0 }`
   */
  private spawnFfmpeg(seekTo?: string, width?: number, height?: number, audio?: AudioDecodeConfig, options?: FrameDecoderOptions): void {
    if (width !== undefined) {
      this.width = width;
      this.height = height ?? this.height;
      this.frameSize = this.width * this.height * 3;
    }
    this.frameParts = [];
    this.framePartsLen = 0;
    this.running = true;
    const generation = ++this.generation;
    this.options = { realtime: true, audioOnly: false, fpsCap: 0, ...options };

    const ffmpegPath = getFfmpegPath();
    const args: string[] = [];
    if (seekTo) {
      args.push('-ss', seekTo);
    }

    if (this.options.audioOnly) {
      if (this.options.realtime) {
        args.push(FFMPEG_FLAGS.COPYTS, FFMPEG_FLAGS.REALTIME, FFMPEG_FLAGS.INPUT, this.inputPath);
      } else {
        args.push(FFMPEG_FLAGS.COPYTS, FFMPEG_FLAGS.INPUT, this.inputPath);
      }
      if (audio) {
        this.audioSampleRate = audio.sampleRate;
        this.audioChannels = audio.channels;
        args.push('-map', '0:a:0', '-f', 's16le', '-ac', String(audio.channels), '-ar', String(audio.sampleRate), 'pipe:3');
      }
    } else {
      if (this.options.realtime) {
        args.push(FFMPEG_FLAGS.COPYTS, FFMPEG_FLAGS.REALTIME, FFMPEG_FLAGS.INPUT, this.inputPath);
      } else {
        args.push(FFMPEG_FLAGS.COPYTS, FFMPEG_FLAGS.INPUT, this.inputPath);
      }

      const videoFilter = this.options.fpsCap > 0 ? `fps=${this.options.fpsCap},showinfo` : 'showinfo';
      args.push('-vf', videoFilter);

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
    }

    log.debug(LOG_FFMPEG_DECODER_ARGS, args.join(' '));
    const currentProcess = audio ? spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe', 'pipe'] }) : spawn(ffmpegPath, args);
    this.process = currentProcess;
    const pendingPts: number[] = [];
    const pendingFrames: Buffer[] = [];
    let stderrBuf = '';
    let lastEmitTime = Date.now();
    let lastEmittedPts = -1;
    let avgFrameDuration = DEFAULT_FRAME_DURATION;

    const emitFrame = (frameData: Buffer, pts: number) => {
      if (lastEmittedPts >= 0 && pts > lastEmittedPts) {
        const diff = pts - lastEmittedPts;
        avgFrameDuration = avgFrameDuration * FRAME_DURATION_SMOOTHING + diff * (1 - FRAME_DURATION_SMOOTHING);
      }
      lastEmittedPts = pts;
      this.emit('frame', {
        buffer: frameData,
        width: this.width,
        height: this.height,
        pts,
        generation,
      } as DecodedFrame);
      lastEmitTime = Date.now();
    };

    const emitAvailable = () => {
      if (!this.running || this.process !== currentProcess) return;

      // Emit frames that have matching PTS
      while (pendingFrames.length > 0 && pendingPts.length > 0) {
        const frameData = pendingFrames.shift()!;
        const pts = pendingPts.shift()!;
        emitFrame(frameData, pts);
      }

      // Emergency flush: if frames stuck for >200ms and we have no PTS, emit
      // them with a monotonic estimate so playback never stalls permanently.
      // The estimate is derived from the last known timestamp, never from the
      // wall clock, so the renderer's clock matching can always catch up.
      const now = Date.now();
      if (pendingFrames.length > 0 && pendingPts.length === 0 && now - lastEmitTime > FRAME_FLUSH_THRESHOLD_MS) {
        const frameData = pendingFrames.shift()!;
        const estimatedPts = lastEmittedPts >= 0 ? lastEmittedPts + avgFrameDuration : 0;
        emitFrame(frameData, estimatedPts);
        if (pendingFrames.length > FRAME_BUFFER_OVERFLOW_WARN) {
          log.warn(
            `Frame buffer overflow: ${pendingFrames.length} buffered, ${pendingPts.length} PTS values. Consider reducing output resolution or checking disk I/O.`,
          );
        }
      }
    };

    if (!this.options.audioOnly) {
      currentProcess.stderr?.on('data', (chunk: Buffer) => {
        if (!this.running || this.process !== currentProcess) return;
        stderrBuf += chunk.toString('utf8');
        // Match various PTS formats: "pts_time:123.456", "pts_time:123", or just "pts=" patterns
        const re = /pts_time[=:\s]*([0-9]*\.?[0-9]+)/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(stderrBuf)) !== null) {
          const pts = parseFloat(match[1]);
          if (!isNaN(pts)) {
            pendingPts.push(pts);
            lastIndex = re.lastIndex;
          }
        }
        stderrBuf = stderrBuf.slice(lastIndex);
        emitAvailable();
      });

      currentProcess.stdout?.on('data', (chunk: Buffer) => {
        if (!this.running || this.process !== currentProcess) return;
        this.frameParts.push(chunk);
        this.framePartsLen += chunk.length;

        while (this.framePartsLen >= this.frameSize) {
          const frameData = Buffer.alloc(this.frameSize);
          let written = 0;
          while (written < this.frameSize) {
            const part = this.frameParts[0];
            const take = Math.min(part.length, this.frameSize - written);
            part.copy(frameData, written, 0, take);
            written += take;
            if (take === part.length) {
              this.frameParts.shift();
            } else {
              this.frameParts[0] = part.subarray(take);
            }
          }
          this.framePartsLen -= this.frameSize;
          pendingFrames.push(frameData);
        }
        emitAvailable();
      });
    }

    if (audio) {
      const audioTarget = Math.max(AUDIO_TARGET_MIN_BYTES, Math.round(audio.sampleRate * audio.channels * 2 * AUDIO_CHUNK_SECONDS));
      let audioParts: Buffer[] = [];
      let audioPartsLen = 0;
      currentProcess.stdio?.[3]?.on('data', (chunk: Buffer) => {
        if (!this.running || this.process !== currentProcess) return;
        audioParts.push(chunk);
        audioPartsLen += chunk.length;
        while (audioPartsLen >= audioTarget) {
          const out = Buffer.alloc(audioTarget);
          let written = 0;
          while (written < audioTarget) {
            const part = audioParts[0];
            const take = Math.min(part.length, audioTarget - written);
            part.copy(out, written, 0, take);
            written += take;
            if (take === part.length) {
              audioParts.shift();
            } else {
              audioParts[0] = part.subarray(take);
            }
          }
          audioPartsLen -= audioTarget;
          this.emit('audio', {
            buffer: out,
            sampleRate: audio.sampleRate,
            channels: audio.channels,
            generation,
          } as DecodedAudio);
        }
      });
    }

    // Periodic flush to ensure frames don't get stuck in the buffer
    const flushInterval = setInterval(() => {
      emitAvailable();
    }, FRAME_FLUSH_INTERVAL_MS); // ~60fps check interval for more responsive flushing

    currentProcess.on('error', (err) => {
      if (this.process !== currentProcess) return;
      clearInterval(flushInterval);
      log.error(LOG_DECODER_PROCESS_ERROR, err);
      this.emit('error', err);
    });

    currentProcess.on('close', (code) => {
      if (this.process !== currentProcess) return;
      clearInterval(flushInterval);
      log.debug(LOG_DECODER_PROCESS_EXITED_WITH_CODE, code);
      this.running = false;
      if (code !== 0 && code !== null) {
        log.error(LOG_DECODER_EXITED_WITH_NON_ZERO_CODE, code);
        this.emit('error', new Error(`Decoder exited with code ${code}`));
      }
      this.emit('end');
    });
  }

  /**
   * Opens a media file for decoding and starts the ffmpeg process.
   *
   * Closes any previous decode session first, then records the input path and
   * resolution, initializes the frame size from the given dimensions, and
   * spawns a fresh ffmpeg process with no seek point. Dimensions default to
   * `TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH`/`PLAYER_DEFAULT_HEIGHT` (640x360).
   * @param {string} input - Absolute path of the media file to decode
   * @param {number} [width=640] - Decode width in pixels
   * @param {number} [height=360] - Decode height in pixels
   * @param {AudioDecodeConfig} [audio] - Optional audio decode configuration;
   *   enables the PCM audio pipe and `audio` events
   * @param {FrameDecoderOptions} [options] - Optional decode options
   *   (realtime, audioOnly, fpsCap)
   */
  open(
    input: string,
    width: number = TRANSCODER_DEFAULTS.PLAYER_DEFAULT_WIDTH,
    height: number = TRANSCODER_DEFAULTS.PLAYER_DEFAULT_HEIGHT,
    audio?: AudioDecodeConfig,
    options?: FrameDecoderOptions,
  ): void {
    this.close();

    log.info(LOG_OPEN, input, LOG_RESOLUTION, width, 'x', height, LOG_AUDIO, audio, LOG_OPTIONS, options);
    this.inputPath = input;
    this.width = width;
    this.height = height;
    this.frameSize = width * height * 3;
    this.audioSampleRate = audio?.sampleRate ?? 0;
    this.audioChannels = audio?.channels ?? 0;

    this.spawnFfmpeg(undefined, undefined, undefined, audio, options);
  }

  /**
   * Seeks to a given timestamp by restarting the ffmpeg process.
   *
   * Because ffmpeg cannot seek a live pipe without risking a corrupted stream,
   * this closes the current process and spawns a fresh one with `-ss <seekTo>`.
   * The previous audio decode settings and session options are carried over, so
   * the new session behaves identically except for the start position. Emits a
   * `seek` event once the restart is issued; the `generation` counter is bumped
   * so consumers can drop any frames still buffered from the old session.
   * @param {string} seekTo - Seek timestamp in ffmpeg format (e.g. `'12.5'` or
   *   `'00:00:12.500'`), passed via `-ss`
   */
  seek(seekTo: string): void {
    log.debug(LOG_SEEK, seekTo);
    this.close();
    if (this.inputPath) {
      this.spawnFfmpeg(
        seekTo,
        undefined,
        undefined,
        this.audioSampleRate ? { sampleRate: this.audioSampleRate, channels: this.audioChannels } : undefined,
        this.options,
      );
    }
    this.emit('seek', seekTo);
  }

  /**
   * Stops decoding and tears down the current ffmpeg process.
   *
   * Marks the session as not running (which makes all in-flight data handlers
   * early-return), kills the child process with `KILL_SIGNAL` (SIGKILL), clears
   * the process reference, and resets the frame assembly buffers. The buffered
   * pending frames/PTS are intentionally discarded; consumers rely on the
   * generation counter to invalidate anything already emitted.
   */
  close(): void {
    log.debug(LOG_CLOSE);
    this.running = false;
    if (this.process) {
      this.process.kill(KILL_SIGNAL);
      this.process = null;
      log.debug(LOG_DECODER_PROCESS_KILLED);
    }
    this.frameParts = [];
    this.framePartsLen = 0;
  }
}
