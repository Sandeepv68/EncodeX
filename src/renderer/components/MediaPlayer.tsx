/**
 * @fileoverview Video and audio media player component.
 * Handles real-time playback with audio-video synchronization using Web Audio API.
 */

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle, memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faStop, faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';
import { Logger } from '../../shared/logger';
import { MediaInfo, PlayerFrame, PlayerAudioChunk } from '../../shared/types';
import { PlayerRoot, PlayerCanvas, ControlsArea, SeekSlider, ControlButton, ControlsRow, TimeText } from '../styles/MediaPlayer.styles';
import { formatClockTime } from '../utils/formatters';

const log = new Logger('renderer/components/MediaPlayer');

export interface MediaPlayerHandle {
  seekTo: (time: number) => void;
}

interface Props {
  filePath: string;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onMediaInfo?: (info: MediaInfo) => void;
}

const AUDIO_LOOKAHEAD_SECONDS = 0.75;
const MAX_PENDING_AUDIO_CHUNKS = 200;
const SEEK_COALESCE_MS = 120;
const MAX_BUFFERED_FRAMES = 30;
const MAX_FRAME_LOOKAHEAD_S = 3;
const STALL_DRAW_TIMEOUT_MS = 400;
const AUDIO_CLOCK_FROZEN_MS = 500;

const MediaPlayer = memo(
  forwardRef<MediaPlayerHandle, Props>(function MediaPlayer({ filePath, onTimeUpdate, onDurationChange, onMediaInfo }: Props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [muted, setMuted] = useState(false);
    const animRef = useRef<number>(0);
    const frameBuffer = useRef<Array<{ data: Uint8Array; width: number; height: number; pts: number }>>([]);
    const imageDataRef = useRef<ImageData | null>(null);
    const isSeeking = useRef(false);
    const displayPtsRef = useRef(0);
    const resetToStartRef = useRef(false);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    onTimeUpdateRef.current = onTimeUpdate;
    const onDurationChangeRef = useRef(onDurationChange);
    onDurationChangeRef.current = onDurationChange;
    const onMediaInfoRef = useRef(onMediaInfo);
    onMediaInfoRef.current = onMediaInfo;
    const durationRef = useRef(0);
    const lastReportedTimeRef = useRef(-1);
    const playBaseTimeRef = useRef(0);
    const playStartWallRef = useRef(0);
    const frameGenRef = useRef<number | null>(null);
    const audioGenRef = useRef<number | null>(null);
    const pendingSeekRef = useRef<{ time: number; timer: number | null }>({ time: 0, timer: null });
    const audioAnchorCtxRef = useRef<number | null>(null);
    const audioAnchorMediaRef = useRef(0);
    const needsBaselineRef = useRef(false);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const pendingChunksRef = useRef<PlayerAudioChunk[]>([]);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const mutedRef = useRef(false);
    const lastGenRef = useRef<number | null>(null);
    const lastDrawnWallRef = useRef(0);
    const lastFrameArrivedWallRef = useRef(0);
    const lastCtxTimeRef = useRef(-1);
    const lastCtxAdvanceWallRef = useRef(0);
    const stallWarnedGenRef = useRef<number | null>(null);

    const ensureAudioContext = useCallback((): AudioContext | null => {
      if (audioCtxRef.current) return audioCtxRef.current;
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        log.warn('Web Audio is not available, audio playback disabled');
        return null;
      }
      const ctx = new Ctor();
      const gain = ctx.createGain();
      gain.gain.value = mutedRef.current ? 0 : 1;
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      masterGainRef.current = gain;
      nextStartTimeRef.current = ctx.currentTime + 0.1;
      log.debug('Audio context created');
      ctx.resume().catch(() => {});
      return ctx;
    }, []);

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
            lastCtxTimeRef.current - audioAnchorCtxRef.current +
            audioAnchorMediaRef.current + (now - lastCtxAdvanceWallRef.current) / 1000
          );
        }
        return ctx.currentTime - audioAnchorCtxRef.current + audioAnchorMediaRef.current;
      }
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      return playBaseTimeRef.current + (now - playStartWallRef.current) / 1000;
    }, []);

    const resetPacing = useCallback((baseTime: number) => {
      playBaseTimeRef.current = baseTime;
      playStartWallRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
      lastReportedTimeRef.current = -1;
      needsBaselineRef.current = true;
    }, []);

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

    type BufferedFrame = { data: Uint8Array; width: number; height: number; pts: number };

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

    const scheduleOneChunk = useCallback((chunk: PlayerAudioChunk) => {
      const ctx = audioCtxRef.current;
      if (!ctx || !masterGainRef.current) return;
      if (chunk.channels < 1 || chunk.sampleRate < 8000) return;

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
            channelData[i] = int16[i * chunk.channels + ch] / 32768;
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
        log.error('scheduleOneChunk error:', err);
        nextStartTimeRef.current = ctx.currentTime;
      }
    }, []);

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

    const queueAudioChunk = useCallback(
      (chunk: PlayerAudioChunk) => {
        if (chunk.channels < 1 || chunk.sampleRate < 8000 || chunk.data.byteLength < chunk.channels * 2) {
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
          log.error('queueAudioChunk error:', err);
        }
      },
      [ensureAudioContext, drainAudioQueue],
    );

    useEffect(() => {
      if (!filePath) return;
      let cancelled = false;

      log.info('Loading player for:', filePath);
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
        log.error('Player decode error:', message);
      });

      return () => {
        cancelled = true;
        log.debug('Closing player');
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
            log.debug('Force-drew stalled frame at', frame.pts);
          } else if (frameGenRef.current !== null && !frame && buffer.length === 0 && now - lastFrameArrivedWallRef.current > 3000 && stallWarnedGenRef.current !== frameGenRef.current) {
            stallWarnedGenRef.current = frameGenRef.current;
            log.warn('No frames received for 3s - decode may be stalled (generation', frameGenRef.current, ')');
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
        log.error('renderLoop error:', err);
      }
      animRef.current = requestAnimationFrame(renderLoop);
    }, [getMediaNow, drainAudioQueue, drawFrame]);

    useEffect(() => {
      if (isPlaying) animRef.current = requestAnimationFrame(renderLoop);
      else cancelAnimationFrame(animRef.current);
      return () => cancelAnimationFrame(animRef.current);
    }, [isPlaying, renderLoop]);

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

    const handleSeek = (_: Event, value: number | number[]) => {
      isSeeking.current = true;
      setCurrentTime(value as number);
    };

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

    const handleStop = () => {
      closeAudio();
      setIsPlaying(false);
      setCurrentTime(0);
      displayPtsRef.current = 0;
      resetToStartRef.current = true;
      resetPacing(0);
      runPlayerCommand(window.electronAPI.playerSeek('00:00:00'));
    };

    useImperativeHandle(
      ref,
      () => ({
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

    const handleToggleMute = () => {
      mutedRef.current = !mutedRef.current;
      setMuted(mutedRef.current);
      if (masterGainRef.current) {
        masterGainRef.current.gain.value = mutedRef.current ? 0 : 1;
      }
    };

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
  }),
);

export default MediaPlayer;
