import { useRef, useEffect, useCallback, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faStop, faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';
import { Logger } from '../../shared/logger';
import { PlayerFrame, PlayerAudioChunk } from '../../shared/types';
import { PlayerRoot, PlayerCanvas, ControlsArea, SeekSlider, ControlButton, ControlsRow, TimeText } from '../styles/MediaPlayer.styles';

const log = new Logger('renderer/components/MediaPlayer');

interface Props {
  filePath: string;
  onTimeUpdate?: (time: number) => void;
}

const DEFAULT_FPS = 30;
const AUDIO_LOOKAHEAD_SECONDS = 1;
const MAX_PENDING_AUDIO_CHUNKS = 600;

export default function MediaPlayer({ filePath, onTimeUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const animRef = useRef<number>(0);
  const frameBuffer = useRef<ImageData[]>([]);
  const isSeeking = useRef(false);
  const displayPtsRef = useRef(0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

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

    log.info('Opening player for:', filePath);
    window.electronAPI.playerOpen(filePath);
    frameBuffer.current = [];
    displayPtsRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(true);

    window.electronAPI
      .getMediaInfo(filePath, 'FFMPEG')
      .then((info) => {
        if (!cancelled) setDuration(info.duration);
      })
      .catch(() => {});

    const cleanupFrame = window.electronAPI.onPlayerFrame((frame: PlayerFrame) => {
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
      frameBuffer.current.push(imageData);
    });

    const cleanupAudio = window.electronAPI.onPlayerAudio((chunk: PlayerAudioChunk) => {
      queueAudioChunk(chunk);
    });

    return () => {
      cancelled = true;
      log.debug('Closing player');
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
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const data = frameBuffer.current.shift()!;
          canvas.width = data.width;
          canvas.height = data.height;
          ctx.putImageData(data, 0, 0);
          displayPtsRef.current += 1;
          const time = displayPtsRef.current / DEFAULT_FPS;
          setCurrentTime(time);
          onTimeUpdateRef.current?.(time);
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
    if (!isPlaying && displayPtsRef.current === 0 && frameBuffer.current.length === 0) {
      window.electronAPI.playerOpen(filePath);
      const ctx = ensureAudioContext();
      ctx?.resume().catch(() => {});
      setIsPlaying(true);
      return;
    }
    if (isPlaying) {
      audioCtxRef.current?.suspend().catch(() => {});
      setIsPlaying(false);
    } else {
      audioCtxRef.current?.resume().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (_: Event, value: number | number[]) => {
    isSeeking.current = true;
    setCurrentTime(value as number);
  };

  const handleSeekCommitted = (_: React.SyntheticEvent | Event, value: number | number[]) => {
    const time = value as number;
    isSeeking.current = false;
    frameBuffer.current = [];
    displayPtsRef.current = Math.round(time * DEFAULT_FPS);
    closeAudio();
    window.electronAPI.playerSeek(formatTime(time));
    setIsPlaying(true);
  };

  const handleStop = () => {
    closeAudio();
    setIsPlaying(false);
    setCurrentTime(0);
    displayPtsRef.current = 0;
    frameBuffer.current = [];
    window.electronAPI.playerClose();
  };

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

  function displayTime(t: number): string {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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
            {displayTime(currentTime)} / {displayTime(duration)}
          </TimeText>
        </ControlsRow>
      </ControlsArea>
    </PlayerRoot>
  );
}
