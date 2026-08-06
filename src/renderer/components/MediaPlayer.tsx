/**
 * @fileoverview Video and audio media player component.
 *
 * Plays back a media file in real time with audio-video synchronization
 * driven by the Web Audio API. Decoded frames and PCM chunks stream in from
 * the main process over IPC while this component owns the render loop, frame
 * buffering, seek coalescing, and the audio scheduling clock.
 *
 * Playback is generation-based: each playerOpen/playerSeek command starts a
 * new decode generation, and frames/chunks whose generation no longer matches
 * the active one are discarded. The player is exposed through an imperative
 * handle (see {@link MediaPlayerHandle}) so parents can seek it
 * programmatically, and it is memoized to avoid re-rendering on parent state
 * changes.
 *
 * Props (see {@link MediaPlayerProps}):
 *  - filePath: absolute path of the file to load for playback.
 *  - onTimeUpdate: called with the current playback time as frames are drawn.
 *  - onDurationChange: called once the probed duration becomes known.
 *  - onMediaInfo: called with the probed MediaInfo of the loaded file.
 */

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faStop, faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';
import { Logger } from '../../shared/logger';
import { PlayerFrame, PlayerAudioChunk } from '../../shared/types';
import type { BufferedFrame, MediaPlayerHandle, MediaPlayerProps } from './types';
import {
  AUDIO_LOOKAHEAD_SECONDS,
  MAX_PENDING_AUDIO_CHUNKS,
  SEEK_COALESCE_MS,
  MAX_BUFFERED_FRAMES,
  MAX_FRAME_LOOKAHEAD_S,
  STALL_DRAW_TIMEOUT_MS,
  AUDIO_CLOCK_FROZEN_MS,
  AUDIO_MIN_SAMPLE_RATE,
  AUDIO_MIN_CHANNELS,
  PCM_MAX_AMPLITUDE,
} from '../../shared/constants';
import { PlayerRoot, PlayerCanvas, ControlsArea, SeekSlider, ControlButton, ControlsRow, TimeText } from '../styles/MediaPlayer.styles';
import { formatClockTime } from '../utils/formatters';
import {
  LOG_AUDIO_CONTEXT_CREATED,
  LOG_CLOSING_PLAYER,
  LOG_FORCE_DREW_STALLED_FRAME_AT,
  LOG_LOADING_PLAYER_FOR,
  LOG_NO_FRAMES_RECEIVED_FOR_3S_DECODE_MAY_BE_STALLED_GENERATION,
  LOG_PLAYER_DECODE_ERROR,
  LOG_QUEUE_AUDIO_CHUNK_ERROR,
  LOG_RENDER_LOOP_ERROR,
  LOG_SCHEDULE_ONE_CHUNK_ERROR,
  LOG_WEB_AUDIO_IS_NOT_AVAILABLE_AUDIO_PLAYBACK_DISABLED,
} from '../../shared/log-constants';

/**
 * Logger instance scoped to this module, used for player lifecycle, decode,
 * audio scheduling, and render-loop diagnostics.
 * @type {Logger}
 */
const log = new Logger('renderer/components/MediaPlayer');

const MediaPlayer = memo(
  forwardRef<MediaPlayerHandle, MediaPlayerProps>(
    /**
     * Renders the media player.
     *
     * Displays decoded video on a canvas, plays PCM audio through the Web
     * Audio API, and keeps both synchronized on a single media clock. Draws
     * buffered frames via an animation-frame render loop, schedules audio
     * chunks slightly ahead of the audio clock, handles generation-baselined
     * seeks, and surfaces a transport row with play/pause, mute, stop, and a
     * seek slider.
     *
     * @param {MediaPlayerProps} props - Component props.
     * @param {string} props.filePath - Absolute path of the file to load and
     *   play.
     * @param {(time: number) => void} [props.onTimeUpdate] - Called with the
     *   current playback time as frames are rendered.
     * @param {(duration: number) => void} [props.onDurationChange] - Called
     *   with the probed duration once the file is loaded.
     * @param {(info: MediaInfo) => void} [props.onMediaInfo] - Called with the
     *   probed media information once available.
     * @param {React.ForwardedRef<MediaPlayerHandle>} ref - Imperative handle
     *   (see {@link MediaPlayerHandle}) exposing seekTo to parent components.
     * @returns {JSX.Element} The player canvas and transport controls.
     */
    function MediaPlayer({ filePath, onTimeUpdate, onDurationChange, onMediaInfo }: MediaPlayerProps, ref) {
      /**
       * Reference to the <canvas> element decoded frames are drawn into.
       * @type {React.RefObject<HTMLCanvasElement>}
       */
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const [isPlaying, setIsPlaying] = useState(false);
      const [currentTime, setCurrentTime] = useState(0);
      const [duration, setDuration] = useState(0);
      const [muted, setMuted] = useState(false);
      /**
       * Holds the requestAnimationFrame id of the active render loop so it can
       * be cancelled when playback pauses or the component unmounts.
       * @type {React.MutableRefObject<number>}
       */
      const animRef = useRef<number>(0);
      /**
       * Ring buffer of decoded frames queued for display, capped at
       * MAX_BUFFERED_FRAMES.
       * @type {React.MutableRefObject<Array<BufferedFrame>>}
       */
      const frameBuffer = useRef<Array<BufferedFrame>>([]);
      /**
       * Cached ImageData reused across draws, recreated only when the frame
       * dimensions change.
       * @type {React.MutableRefObject<ImageData | null>}
       */
      const imageDataRef = useRef<ImageData | null>(null);
      /**
       * True while the user is dragging the seek slider; freezes frame selection
       * in the render loop until the seek is committed.
       * @type {React.MutableRefObject<boolean>}
       */
      const isSeeking = useRef(false);
      /**
       * PTS (seconds) of the last displayed frame; the resume point for
       * play/pause and the pacing baseline.
       * @type {React.MutableRefObject<number>}
       */
      const displayPtsRef = useRef(0);
      /**
       * Set by handleStop so the next frame of the current generation is drawn
       * immediately and the player then closed, ending at time zero.
       * @type {React.MutableRefObject<boolean>}
       */
      const resetToStartRef = useRef(false);
      /**
       * Latest onTimeUpdate callback, stored in a ref so the render loop never
       * captures a stale closure.
       * @type {React.MutableRefObject<((time: number) => void) | undefined>}
       */
      const onTimeUpdateRef = useRef(onTimeUpdate);
      onTimeUpdateRef.current = onTimeUpdate;
      /**
       * Latest onDurationChange callback, stored in a ref so the load effect
       * never captures a stale closure.
       * @type {React.MutableRefObject<((duration: number) => void) | undefined>}
       */
      const onDurationChangeRef = useRef(onDurationChange);
      onDurationChangeRef.current = onDurationChange;
      /**
       * Latest onMediaInfo callback, stored in a ref so the load effect never
       * captures a stale closure.
       * @type {React.MutableRefObject<((info: MediaInfo) => void) | undefined>}
       */
      const onMediaInfoRef = useRef(onMediaInfo);
      onMediaInfoRef.current = onMediaInfo;
      /**
       * Current file duration in seconds, held outside React state so the
       * render loop can read it without re-rendering.
       * @type {React.MutableRefObject<number>}
       */
      const durationRef = useRef(0);
      /**
       * Last playback time reported via onTimeUpdate; throttles updates to
       * roughly 50ms resolution.
       * @type {React.MutableRefObject<number>}
       */
      const lastReportedTimeRef = useRef(-1);
      /**
       * Media-time baseline (seconds) of the current playback session.
       * @type {React.MutableRefObject<number>}
       */
      const playBaseTimeRef = useRef(0);
      /**
       * Wall-clock performance.now() captured when pacing was last reset; used
       * with playBaseTimeRef to derive media time when no audio clock is active.
       * @type {React.MutableRefObject<number>}
       */
      const playStartWallRef = useRef(0);
      /**
       * Generation id of the current video decode; frames from other generations
       * are discarded.
       * @type {React.MutableRefObject<number | null>}
       */
      const frameGenRef = useRef<number | null>(null);
      /**
       * Generation id of the current audio decode; chunks from other generations
       * are discarded.
       * @type {React.MutableRefObject<number | null>}
       */
      const audioGenRef = useRef<number | null>(null);
      /**
       * Coalesced pending seek: the target time and the timer id scheduled to
       * execute it after SEEK_COALESCE_MS.
       * @type {React.MutableRefObject<{ time: number; timer: number | null }>}
       */
      const pendingSeekRef = useRef<{ time: number; timer: number | null }>({ time: 0, timer: null });
      /**
       * AudioContext time at which audio playback was anchored; paired with
       * audioAnchorMediaRef to map audio clock time to media time.
       * @type {React.MutableRefObject<number | null>}
       */
      const audioAnchorCtxRef = useRef<number | null>(null);
      /**
       * Media time corresponding to audioAnchorCtxRef.
       * @type {React.MutableRefObject<number>}
       */
      const audioAnchorMediaRef = useRef(0);
      /**
       * True until the playback clock is snapped to the PTS of the first frame
       * of the current decode generation (after open/seek).
       * @type {React.MutableRefObject<boolean>}
       */
      const needsBaselineRef = useRef(false);

      /**
       * Lazily-created Web Audio AudioContext used for playback, or null when
       * Web Audio is unavailable.
       * @type {React.MutableRefObject<AudioContext | null>}
       */
      const audioCtxRef = useRef<AudioContext | null>(null);
      /**
       * Gain node connected between all scheduled sources and the context
       * destination; muting sets its gain to zero.
       * @type {React.MutableRefObject<GainNode | null>}
       */
      const masterGainRef = useRef<GainNode | null>(null);
      /**
       * AudioContext time at which the next scheduled chunk should start.
       * @type {React.MutableRefObject<number>}
       */
      const nextStartTimeRef = useRef(0);
      /**
       * Queue of PCM chunks decoded by the main process but not yet scheduled
       * into the AudioContext.
       * @type {React.MutableRefObject<PlayerAudioChunk[]>}
       */
      const pendingChunksRef = useRef<PlayerAudioChunk[]>([]);
      /**
       * Set of BufferSource nodes currently scheduled; stopped and cleared on
       * seek, stop, and unmount.
       * @type {React.MutableRefObject<Set<AudioBufferSourceNode>>}
       */
      const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
      /**
       * Mirrors the muted state outside React so audio scheduling can read it
       * synchronously.
       * @type {React.MutableRefObject<boolean>}
       */
      const mutedRef = useRef(false);
      /**
       * Last generation id for which a playback baseline was established; resets
       * on every runPlayerCommand.
       * @type {React.MutableRefObject<number | null>}
       */
      const lastGenRef = useRef<number | null>(null);
      /**
       * Wall-clock time of the last successfully drawn frame; drives the stall
       * watchdog.
       * @type {React.MutableRefObject<number>}
       */
      const lastDrawnWallRef = useRef(0);
      /**
       * Wall-clock time the last frame arrived from the main process; when too
       * old, a decode stall is logged.
       * @type {React.MutableRefObject<number>}
       */
      const lastFrameArrivedWallRef = useRef(0);
      /**
       * Last observed AudioContext.currentTime; used to detect a frozen audio
       * hardware clock.
       * @type {React.MutableRefObject<number>}
       */
      const lastCtxTimeRef = useRef(-1);
      /**
       * Wall-clock time at which lastCtxTimeRef was last seen advancing.
       * @type {React.MutableRefObject<number>}
       */
      const lastCtxAdvanceWallRef = useRef(0);
      /**
       * Generation id for which the 3s no-frames warning was already emitted, to
       * avoid spamming the log.
       * @type {React.MutableRefObject<number | null>}
       */
      const stallWarnedGenRef = useRef<number | null>(null);

      /**
       * Lazily creates the Web Audio AudioContext and its master gain node on
       * first use, preferring the standard constructor and falling back to
       * webkitAudioContext. Logs a warning and returns null when Web Audio is
       * unavailable so playback continues video-only.
       * @returns {AudioContext | null} The active AudioContext, or null when
       *   Web Audio is not available.
       */
      const ensureAudioContext = useCallback((): AudioContext | null => {
        if (audioCtxRef.current) return audioCtxRef.current;
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
          log.warn(LOG_WEB_AUDIO_IS_NOT_AVAILABLE_AUDIO_PLAYBACK_DISABLED);
          return null;
        }
        const ctx = new Ctor();
        const gain = ctx.createGain();
        gain.gain.value = mutedRef.current ? 0 : 1;
        gain.connect(ctx.destination);
        audioCtxRef.current = ctx;
        masterGainRef.current = gain;
        nextStartTimeRef.current = ctx.currentTime + 0.1;
        log.debug(LOG_AUDIO_CONTEXT_CREATED);
        ctx.resume().catch(() => {});
        return ctx;
      }, []);

      /**
       * Fully tears down audio playback: clears pending chunks, stops and drops
       * all scheduled sources, clears the audio anchor, and closes the
       * AudioContext.
       * @returns {void}
       */
      const closeAudio = useCallback(() => {
        pendingChunksRef.current = [];
        activeSourcesRef.current.forEach((source) => {
          try {
            source.stop();
          } catch {
            /* already stopped */
          }
        });
        activeSourcesRef.current.clear();
        audioAnchorCtxRef.current = null;
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {});
          audioCtxRef.current = null;
          masterGainRef.current = null;
        }
        nextStartTimeRef.current = 0;
      }, []);

      /**
       * Resets the audio pipeline for a re-baseline (e.g. seek): stops in-flight
       * sources, clears the pending queue and anchor, and moves the schedule
       * pointer to just after the current audio time, resuming a suspended
       * context.
       * @returns {void}
       */
      const resetAudioScheduling = useCallback(() => {
        activeSourcesRef.current.forEach((source) => {
          try {
            source.stop();
          } catch {
            /* already stopped */
          }
        });
        activeSourcesRef.current.clear();
        pendingChunksRef.current = [];
        audioAnchorCtxRef.current = null;
        const ctx = audioCtxRef.current;
        nextStartTimeRef.current = ctx ? ctx.currentTime + 0.05 : 0;
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      }, []);

      /**
       * Computes the current media time in seconds. When the audio clock is
       * running and anchored, returns audio time mapped to media time; if the
       * audio hardware clock stops advancing (frozen), paces off the last known
       * audio time plus wall-clock elapsed so playback stays continuous.
       * Otherwise falls back to the wall-clock baseline set by resetPacing.
       * @returns {number} Current media time in seconds.
       */
      const getMediaNow = useCallback((): number => {
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === 'running' && audioAnchorCtxRef.current !== null) {
          const now = typeof performance !== 'undefined' ? performance.now() : 0;
          if (ctx.currentTime > lastCtxTimeRef.current) {
            lastCtxTimeRef.current = ctx.currentTime;
            lastCtxAdvanceWallRef.current = now;
          }
          if (lastCtxAdvanceWallRef.current > 0 && now - lastCtxAdvanceWallRef.current > AUDIO_CLOCK_FROZEN_MS) {
            // Audio hardware clock stopped advancing (device glitch, stall).
            // Keep pacing off the last-known audio time plus wall-clock elapsed,
            // so playback continues smoothly and stays continuous with audio.
            return (
              lastCtxTimeRef.current -
              audioAnchorCtxRef.current +
              audioAnchorMediaRef.current +
              (now - lastCtxAdvanceWallRef.current) / 1000
            );
          }
          return ctx.currentTime - audioAnchorCtxRef.current + audioAnchorMediaRef.current;
        }
        const now = typeof performance !== 'undefined' ? performance.now() : 0;
        return playBaseTimeRef.current + (now - playStartWallRef.current) / 1000;
      }, []);

      /**
       * Re-baselines the wall-clock fallback: sets the media-time baseline,
       * captures the current wall time, and requests a re-baseline to the next
       * arriving frame.
       * @param {number} baseTime - Media time in seconds to treat as "now".
       * @returns {void}
       */
      const resetPacing = useCallback((baseTime: number) => {
        playBaseTimeRef.current = baseTime;
        playStartWallRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
        lastReportedTimeRef.current = -1;
        needsBaselineRef.current = true;
      }, []);

      /**
       * Starts a new decode generation from a player IPC command. Clears the
       * frame buffer and generation trackers so stale frames/chunks are
       * discarded, then stores the new generation id when the command resolves.
       * @param {Promise<number>} command - A playerOpen/playerSeek promise
       *   resolving to the new generation id.
       * @returns {void}
       */
      const runPlayerCommand = useCallback((command: Promise<number>) => {
        frameGenRef.current = null;
        audioGenRef.current = null;
        frameBuffer.current = [];
        lastGenRef.current = null;
        stallWarnedGenRef.current = null;
        command
          .then((gen) => {
            frameGenRef.current = gen;
            audioGenRef.current = gen;
          })
          .catch(() => {});
      }, []);

      /**
       * Draws a decoded RGB frame onto the canvas. Resizes the canvas and the
       * cached ImageData when the frame dimensions change, packs the RGB bytes
       * into 32-bit RGBA pixels, and writes the result to the canvas.
       * @param {BufferedFrame} frame - The decoded frame to display.
       * @returns {void}
       */
      const drawFrame = useCallback((frame: BufferedFrame) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (canvas.width !== frame.width || canvas.height !== frame.height) {
          canvas.width = frame.width;
          canvas.height = frame.height;
        }
        let imageData = imageDataRef.current;
        if (!imageData || imageData.width !== frame.width || imageData.height !== frame.height) {
          imageData = ctx.createImageData(frame.width, frame.height);
          imageDataRef.current = imageData;
        }
        const rgba = imageData.data;
        const rgb = frame.data;
        const pixelCount = frame.width * frame.height;
        const rgba32 = new Uint32Array(rgba.buffer, rgba.byteOffset, pixelCount);
        for (let i = 0; i < pixelCount; i++) {
          const j = i * 3;
          rgba32[i] = (0xff << 24) | (rgb[j + 2] << 16) | (rgb[j + 1] << 8) | rgb[j];
        }
        ctx.putImageData(imageData, 0, 0);
      }, []);

      /**
       * Executes the coalesced seek stored in pendingSeekRef: cancels its timer,
       * resets audio scheduling and pacing, issues the IPC seek, and resumes
       * playing.
       * @returns {void}
       */
      const flushPendingSeek = useCallback(() => {
        const pending = pendingSeekRef.current;
        if (pending.timer !== null) {
          window.clearTimeout(pending.timer);
          pending.timer = null;
        }
        const time = pending.time;
        resetAudioScheduling();
        resetPacing(time);
        runPlayerCommand(window.electronAPI.playerSeek(formatTime(time)));
        setIsPlaying(true);
      }, [resetAudioScheduling, resetPacing, runPlayerCommand]);

      /**
       * Converts one PCM chunk into an AudioBuffer and schedules it at the next
       * start time, anchoring the audio clock on the first chunk of a session.
       * Chunks below the minimum sample rate or channel count are skipped.
       * @param {PlayerAudioChunk} chunk - The PCM chunk to schedule.
       * @returns {void}
       */
      const scheduleOneChunk = useCallback((chunk: PlayerAudioChunk) => {
        const ctx = audioCtxRef.current;
        if (!ctx || !masterGainRef.current) return;
        if (chunk.channels < AUDIO_MIN_CHANNELS || chunk.sampleRate < AUDIO_MIN_SAMPLE_RATE) return;

        try {
          if (nextStartTimeRef.current < ctx.currentTime) {
            nextStartTimeRef.current = ctx.currentTime;
          }

          const int16 = new Int16Array(chunk.data);
          const frameCount = Math.floor(int16.length / chunk.channels);
          if (frameCount <= 0) return;

          const buffer = ctx.createBuffer(chunk.channels, frameCount, chunk.sampleRate);
          for (let ch = 0; ch < chunk.channels; ch++) {
            const channelData = buffer.getChannelData(ch);
            for (let i = 0; i < frameCount; i++) {
              channelData[i] = int16[i * chunk.channels + ch] / PCM_MAX_AMPLITUDE;
            }
          }

          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(masterGainRef.current);
          const startAt = nextStartTimeRef.current;
          if (audioAnchorCtxRef.current === null) {
            audioAnchorCtxRef.current = startAt;
            audioAnchorMediaRef.current = playBaseTimeRef.current;
          }
          source.start(startAt);
          nextStartTimeRef.current = startAt + buffer.duration;
          activeSourcesRef.current.add(source);
          source.onended = () => activeSourcesRef.current.delete(source);
        } catch (err) {
          log.error(LOG_SCHEDULE_ONE_CHUNK_ERROR, err);
          nextStartTimeRef.current = ctx.currentTime;
        }
      }, []);

      /**
       * Schedules queued chunks until the schedule pointer is AUDIO_LOOKAHEAD
       * ahead of the audio clock, pulling the pointer back if it drifted too far
       * (e.g. after a suspended context resumed late) so sound resumes.
       * @returns {void}
       */
      const drainAudioQueue = useCallback(() => {
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        // If the schedule pointer drifted far ahead of the audio clock (e.g. a
        // suspended context resumed much later), pull it back so sound resumes.
        if (nextStartTimeRef.current - ctx.currentTime > AUDIO_LOOKAHEAD_SECONDS * 4 && pendingChunksRef.current.length > 0) {
          nextStartTimeRef.current = ctx.currentTime;
        }
        let guard = 0;
        while (pendingChunksRef.current.length > 0 && guard < 200) {
          if (nextStartTimeRef.current - ctx.currentTime > AUDIO_LOOKAHEAD_SECONDS) return;
          const chunk = pendingChunksRef.current.shift()!;
          scheduleOneChunk(chunk);
          guard++;
        }
      }, [scheduleOneChunk]);

      /**
       * Accepts a PCM chunk from the main process: validates it, ensures the
       * audio context exists and is resumed, enqueues it (bounded by
       * MAX_PENDING_AUDIO_CHUNKS), and drains the queue to schedule playback.
       * @param {PlayerAudioChunk} chunk - The PCM chunk to queue for playback.
       * @returns {void}
       */
      const queueAudioChunk = useCallback(
        (chunk: PlayerAudioChunk) => {
          if (
            chunk.channels < AUDIO_MIN_CHANNELS ||
            chunk.sampleRate < AUDIO_MIN_SAMPLE_RATE ||
            chunk.data.byteLength < chunk.channels * 2
          ) {
            return;
          }
          const ctx = ensureAudioContext();
          if (!ctx) return;
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          if (pendingChunksRef.current.length >= MAX_PENDING_AUDIO_CHUNKS) {
            return;
          }
          pendingChunksRef.current.push(chunk);
          try {
            drainAudioQueue();
          } catch (err) {
            log.error(LOG_QUEUE_AUDIO_CHUNK_ERROR, err);
          }
        },
        [ensureAudioContext, drainAudioQueue],
      );

      /**
       * Loads the file for playback whenever filePath changes: resets all
       * playback state, probes media info (reporting duration and media info via
       * callbacks), and subscribes to the player frame, audio, and error IPC
       * channels. The returned cleanup closes the decoder, unsubscribes from
       * the channels, cancels the render loop, and tears down audio.
       * @returns {() => void} Cleanup that releases the player on change/unmount.
       */
      useEffect(() => {
        if (!filePath) return;
        let cancelled = false;

        log.info(LOG_LOADING_PLAYER_FOR, filePath);
        frameGenRef.current = null;
        audioGenRef.current = null;
        frameBuffer.current = [];
        displayPtsRef.current = 0;
        durationRef.current = 0;
        needsBaselineRef.current = true;
        lastGenRef.current = null;
        lastDrawnWallRef.current = 0;
        lastFrameArrivedWallRef.current = 0;
        lastCtxTimeRef.current = -1;
        lastCtxAdvanceWallRef.current = 0;
        stallWarnedGenRef.current = null;
        setCurrentTime(0);
        setIsPlaying(false);

        window.electronAPI
          .getMediaInfo(filePath, 'FFMPEG')
          .then((info) => {
            if (!cancelled) {
              durationRef.current = info.duration;
              setDuration(info.duration);
              onDurationChangeRef.current?.(info.duration);
              onMediaInfoRef.current?.(info);
            }
          })
          .catch(() => {});

        const cleanupFrame = window.electronAPI.onPlayerFrame((frame: PlayerFrame) => {
          if (frame.generation !== frameGenRef.current) return;

          if (resetToStartRef.current) {
            resetToStartRef.current = false;
            drawFrame({ data: new Uint8Array(frame.data), width: frame.width, height: frame.height, pts: frame.pts });
            window.electronAPI.playerClose();
            return;
          }

          lastFrameArrivedWallRef.current = performance.now();

          // Snap the playback clock to the first frame of a new decode generation.
          // This makes files whose PTS does not start at 0 (and seeks) begin
          // playing immediately instead of waiting for the clock to catch up.
          if (lastGenRef.current !== frame.generation) {
            lastGenRef.current = frame.generation;
            if (needsBaselineRef.current) {
              needsBaselineRef.current = false;
              const diff = frame.pts - playBaseTimeRef.current;
              if (Math.abs(diff) > 0.001) {
                playBaseTimeRef.current = frame.pts;
                if (audioAnchorCtxRef.current !== null) {
                  audioAnchorMediaRef.current += diff;
                }
              }
            }
          }

          const buffer = frameBuffer.current;
          if (buffer.length >= MAX_BUFFERED_FRAMES) {
            buffer.shift();
          }
          buffer.push({ data: new Uint8Array(frame.data), width: frame.width, height: frame.height, pts: frame.pts });
        });

        const cleanupAudio = window.electronAPI.onPlayerAudio((chunk: PlayerAudioChunk) => {
          if (chunk.generation !== audioGenRef.current) return;
          queueAudioChunk(chunk);
        });

        const cleanupError = window.electronAPI.onPlayerError?.((message: string) => {
          log.error(LOG_PLAYER_DECODE_ERROR, message);
        });

        return () => {
          cancelled = true;
          log.debug(LOG_CLOSING_PLAYER);
          if (pendingSeekRef.current.timer !== null) {
            window.clearTimeout(pendingSeekRef.current.timer);
            pendingSeekRef.current.timer = null;
          }
          window.electronAPI.playerClose();
          cleanupFrame();
          cleanupAudio();
          cleanupError?.();
          cancelAnimationFrame(animRef.current);
          closeAudio();
        };
      }, [filePath, queueAudioChunk, closeAudio, drawFrame]);

      /**
       * The requestAnimationFrame render loop. Each tick drains the audio
       * queue, picks the best buffered frame for the current media time (dropping
       * frames too far in the future), force-draws the oldest frame when the
       * buffer stalls, and reports throttled time updates. A single bad frame or
       * chunk never kills the loop, and the next tick is always scheduled.
       * @returns {void}
       */
      const renderLoop = useCallback(() => {
        try {
          // Drain audio queue to keep it filled
          drainAudioQueue();

          if (!isSeeking.current) {
            const targetTime = getMediaNow();
            let frame: BufferedFrame | null = null;

            // Find the best frame to display. Frames whose PTS is absurdly far in
            // the future (e.g. from a bad decoder estimate) are dropped instead of
            // blocking the whole buffer forever.
            const buffer = frameBuffer.current;
            while (buffer.length > 0) {
              const candidate = buffer[0];
              if (candidate.pts > targetTime + MAX_FRAME_LOOKAHEAD_S) {
                buffer.shift();
                continue;
              }
              if (candidate.pts > targetTime) break;
              buffer.shift();
              frame = candidate;
            }

            // Stall watchdog: if frames are buffered but none has qualified for a
            // while (clock mismatch), force-draw the oldest and re-baseline so the
            // video can never wedge permanently.
            const now = performance.now();
            if (!frame && buffer.length > 0 && now - lastDrawnWallRef.current > STALL_DRAW_TIMEOUT_MS) {
              frame = buffer.shift()!;
              const diff = frame.pts - playBaseTimeRef.current;
              playBaseTimeRef.current = frame.pts;
              if (audioAnchorCtxRef.current !== null) {
                audioAnchorMediaRef.current += diff;
              }
              needsBaselineRef.current = false;
              log.debug(LOG_FORCE_DREW_STALLED_FRAME_AT, frame.pts);
            } else if (
              frameGenRef.current !== null &&
              !frame &&
              buffer.length === 0 &&
              now - lastFrameArrivedWallRef.current > 3000 &&
              stallWarnedGenRef.current !== frameGenRef.current
            ) {
              stallWarnedGenRef.current = frameGenRef.current;
              log.warn(LOG_NO_FRAMES_RECEIVED_FOR_3S_DECODE_MAY_BE_STALLED_GENERATION, frameGenRef.current, ')');
            }

            if (frame) {
              if (needsBaselineRef.current) {
                needsBaselineRef.current = false;
                const diff = frame.pts - playBaseTimeRef.current;
                if (Math.abs(diff) > 0.05) {
                  playBaseTimeRef.current = frame.pts;
                  if (audioAnchorCtxRef.current !== null) {
                    audioAnchorMediaRef.current += diff;
                  }
                }
              }
              drawFrame(frame);
              lastDrawnWallRef.current = now;
              const time = frame.pts;
              displayPtsRef.current = time;
              if (Math.abs(time - lastReportedTimeRef.current) >= 0.05 || time >= durationRef.current) {
                lastReportedTimeRef.current = time;
                setCurrentTime(time);
                onTimeUpdateRef.current?.(time);
              }
            }
          }
        } catch (err) {
          // A single bad frame/chunk must never kill the whole playback loop.
          log.error(LOG_RENDER_LOOP_ERROR, err);
        }
        animRef.current = requestAnimationFrame(renderLoop);
      }, [getMediaNow, drainAudioQueue, drawFrame]);

      /**
       * Starts the render loop (requestAnimationFrame) while playing and stops
       * it otherwise; cleanup cancels any pending frame on re-render/unmount.
       * @returns {void}
       */
      useEffect(() => {
        if (isPlaying) animRef.current = requestAnimationFrame(renderLoop);
        else cancelAnimationFrame(animRef.current);
        return () => cancelAnimationFrame(animRef.current);
      }, [isPlaying, renderLoop]);

      /**
       * Toggles between play and pause. Pausing closes audio and the decoder;
       * playing restores pacing and either seeks back to the resume time or
       * opens the file from the start, then starts a new decode generation.
       * @returns {void}
       */
      const togglePlayback = () => {
        if (isPlaying) {
          closeAudio();
          setIsPlaying(false);
          window.electronAPI.playerClose();
          return;
        }
        resetToStartRef.current = false;
        const resumeTime = displayPtsRef.current;
        const ctx = ensureAudioContext();
        ctx?.resume().catch(() => {});
        resetPacing(resumeTime);
        if (resumeTime > 0) {
          runPlayerCommand(window.electronAPI.playerSeek(formatTime(resumeTime)));
        } else {
          runPlayerCommand(window.electronAPI.playerOpen(filePath));
        }
        setIsPlaying(true);
      };

      /**
       * Seek slider drag handler: marks the player as seeking and live-updates
       * the displayed time without touching the decoder or frame selection.
       * @param {Event} _ - The slider event (ignored).
       * @param {number | number[]} value - The slider position in seconds.
       * @returns {void}
       */
      const handleSeek = (_: Event, value: number | number[]) => {
        isSeeking.current = true;
        setCurrentTime(value as number);
      };

      /**
       * Fires when the seek slider is released: cancels the seeking flag,
       * resets audio scheduling and pacing to the committed time, issues the
       * IPC seek, and resumes playback.
       * @param {React.SyntheticEvent | Event} _ - The slider event (ignored).
       * @param {number | number[]} value - The committed position in seconds.
       * @returns {void}
       */
      const handleSeekCommitted = (_: React.SyntheticEvent | Event, value: number | number[]) => {
        const time = value as number;
        isSeeking.current = false;
        resetToStartRef.current = false;
        displayPtsRef.current = time;
        resetAudioScheduling();
        resetPacing(time);
        runPlayerCommand(window.electronAPI.playerSeek(formatTime(time)));
        setIsPlaying(true);
      };

      /**
       * Stops playback and returns to time zero: closes audio, resets state,
       * flags resetToStartRef so the next arriving frame ends the session, and
       * issues a seek to the start.
       * @returns {void}
       */
      const handleStop = () => {
        closeAudio();
        setIsPlaying(false);
        setCurrentTime(0);
        displayPtsRef.current = 0;
        resetToStartRef.current = true;
        resetPacing(0);
        runPlayerCommand(window.electronAPI.playerSeek('00:00:00'));
      };

      /**
       * Exposes the imperative {@link MediaPlayerHandle} to parent components.
       * @returns {void}
       */
      useImperativeHandle(
        ref,
        () => ({
          /**
           * Seeks to the given time, coalescing rapid calls into a single
           * pending seek that flushPendingSeek executes after SEEK_COALESCE_MS.
           * @param {number} time - Target playback time in seconds.
           * @returns {void}
           */
          seekTo: (time: number) => {
            isSeeking.current = false;
            resetToStartRef.current = false;
            displayPtsRef.current = time;
            const pending = pendingSeekRef.current;
            pending.time = time;
            if (pending.timer === null) {
              pending.timer = window.setTimeout(flushPendingSeek, SEEK_COALESCE_MS);
            }
          },
        }),
        [flushPendingSeek],
      );

      /**
       * Toggles audio muting, mirroring the state in mutedRef and applying it to
       * the master gain node immediately.
       * @returns {void}
       */
      const handleToggleMute = () => {
        mutedRef.current = !mutedRef.current;
        setMuted(mutedRef.current);
        if (masterGainRef.current) {
          masterGainRef.current.gain.value = mutedRef.current ? 0 : 1;
        }
      };

      /**
       * Formats a time in seconds as an HH:MM:SS.mmm string for playerSeek IPC
       * commands.
       * @param {number} t - Time in seconds.
       * @returns {string} Zero-padded timestamp, e.g. "00:01:23.456".
       */
      function formatTime(t: number): string {
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = t % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
      }

      return (
        <PlayerRoot>
          <PlayerCanvas ref={canvasRef} onClick={togglePlayback} />
          <ControlsArea>
            <SeekSlider
              size="small"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              onChangeCommitted={handleSeekCommitted}
            />
            <ControlsRow>
              <ControlButton size="small" onClick={togglePlayback}>
                {isPlaying ? <FontAwesomeIcon icon={faPause} /> : <FontAwesomeIcon icon={faPlay} />}
              </ControlButton>
              <ControlButton size="small" onClick={handleToggleMute} aria-label={muted ? 'unmute' : 'mute'}>
                {muted ? <FontAwesomeIcon icon={faVolumeXmark} /> : <FontAwesomeIcon icon={faVolumeHigh} />}
              </ControlButton>
              <ControlButton size="small" onClick={handleStop}>
                <FontAwesomeIcon icon={faStop} />
              </ControlButton>
              <TimeText variant="caption">
                {formatClockTime(currentTime)} / {formatClockTime(duration)}
              </TimeText>
            </ControlsRow>
          </ControlsArea>
        </PlayerRoot>
      );
    },
  ),
);

export default MediaPlayer;
