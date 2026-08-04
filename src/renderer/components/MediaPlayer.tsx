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

const AUDIO_LOOKAHEAD_SECONDS = 1;
const MAX_PENDING_AUDIO_CHUNKS = 600;
const SEEK_COALESCE_MS = 120;

const MediaPlayer = memo(
  forwardRef<MediaPlayerHandle, Props>(function MediaPlayer({ filePath, onTimeUpdate, onDurationChange, onMediaInfo }: Props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [muted, setMuted] = useState(false);
    const animRef = useRef<number>(0);
    const frameBuffer = useRef<Array<{ data: ImageData; pts: number }>>([]);
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

    const audioCtxRef = useRef<AudioContext | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const pendingChunksRef = useRef<PlayerAudioChunk[]>([]);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const mutedRef = useRef(false);

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
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
        masterGainRef.current = null;
      }
      nextStartTimeRef.current = 0;
    }, []);

    const resetPacing = useCallback((baseTime: number) => {
      playBaseTimeRef.current = baseTime;
      playStartWallRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
      lastReportedTimeRef.current = -1;
    }, []);

    const runPlayerCommand = useCallback((command: Promise<number>) => {
      frameGenRef.current = null;
      audioGenRef.current = null;
      frameBuffer.current = [];
      command
        .then((gen) => {
          frameGenRef.current = gen;
          audioGenRef.current = gen;
        })
        .catch(() => {});
    }, []);

    const flushPendingSeek = useCallback(() => {
      const pending = pendingSeekRef.current;
      if (pending.timer !== null) {
        window.clearTimeout(pending.timer);
        pending.timer = null;
      }
      const time = pending.time;
      closeAudio();
      resetPacing(time);
      runPlayerCommand(window.electronAPI.playerSeek(formatTime(time)));
      setIsPlaying(true);
    }, [closeAudio, resetPacing, runPlayerCommand]);

    const scheduleOneChunk = useCallback((chunk: PlayerAudioChunk) => {
      const ctx = audioCtxRef.current;
      if (!ctx || !masterGainRef.current) return;

      if (nextStartTimeRef.current < ctx.currentTime - 0.25) {
        nextStartTimeRef.current = ctx.currentTime + 0.05;
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
      const startAt = Math.max(nextStartTimeRef.current, ctx.currentTime + 0.05);
      source.start(startAt);
      nextStartTimeRef.current = startAt + buffer.duration;
      activeSourcesRef.current.add(source);
      source.onended = () => activeSourcesRef.current.delete(source);
    }, []);

    const drainAudioQueue = useCallback(() => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
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
        const ctx = ensureAudioContext();
        if (!ctx) return;
        if (pendingChunksRef.current.length >= MAX_PENDING_AUDIO_CHUNKS) {
          pendingChunksRef.current.shift();
        }
        pendingChunksRef.current.push(chunk);
        drainAudioQueue();
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
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const uint8 = new Uint8Array(frame.data);
        const imageData = ctx.createImageData(frame.width, frame.height);
        for (let i = 0; i < frame.width * frame.height; i++) {
          imageData.data[i * 4] = uint8[i * 3];
          imageData.data[i * 4 + 1] = uint8[i * 3 + 1];
          imageData.data[i * 4 + 2] = uint8[i * 3 + 2];
          imageData.data[i * 4 + 3] = 255;
        }

        if (resetToStartRef.current) {
          resetToStartRef.current = false;
          canvas.width = frame.width;
          canvas.height = frame.height;
          ctx.putImageData(imageData, 0, 0);
          window.electronAPI.playerClose();
          return;
        }

        frameBuffer.current.push({ data: imageData, pts: frame.pts });
      });

      const cleanupAudio = window.electronAPI.onPlayerAudio((chunk: PlayerAudioChunk) => {
        if (chunk.generation !== audioGenRef.current) return;
        queueAudioChunk(chunk);
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
        cancelAnimationFrame(animRef.current);
        closeAudio();
      };
    }, [filePath, queueAudioChunk, closeAudio]);

    const renderLoop = useCallback(() => {
      if (frameBuffer.current.length > 0 && !isSeeking.current) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          const now = typeof performance !== 'undefined' ? performance.now() : 0;
          const targetTime = playBaseTimeRef.current + (now - playStartWallRef.current) / 1000;
          let frame: { data: ImageData; pts: number } | null = null;
          while (frameBuffer.current.length > 0) {
            const candidate = frameBuffer.current[0];
            if (candidate.pts > targetTime) break;
            frameBuffer.current.shift();
            frame = candidate;
          }
          if (frame) {
            if (canvas.width !== frame.data.width || canvas.height !== frame.data.height) {
              canvas.width = frame.data.width;
              canvas.height = frame.data.height;
            }
            ctx.putImageData(frame.data, 0, 0);
            const time = frame.pts;
            displayPtsRef.current = time;
            if (Math.abs(time - lastReportedTimeRef.current) >= 0.1 || time >= durationRef.current) {
              lastReportedTimeRef.current = time;
              setCurrentTime(time);
              onTimeUpdateRef.current?.(time);
            }
          }
        }
      }
      animRef.current = requestAnimationFrame(renderLoop);
    }, []);

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
      resetPacing(resumeTime);
      if (resumeTime > 0) {
        runPlayerCommand(window.electronAPI.playerSeek(formatTime(resumeTime)));
      } else {
        runPlayerCommand(window.electronAPI.playerOpen(filePath));
      }
      const ctx = ensureAudioContext();
      ctx?.resume().catch(() => {});
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
      closeAudio();
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
