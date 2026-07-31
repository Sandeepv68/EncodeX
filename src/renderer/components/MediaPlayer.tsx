import { useRef, useEffect, useCallback, useState } from 'react';
import { Box, IconButton, Slider, Stack, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import { Logger } from '../../shared/logger';
import { PlayerFrame } from '../../shared/types';

const log = new Logger('renderer/components/MediaPlayer');

interface Props {
  filePath: string;
  onTimeUpdate?: (time: number) => void;
}

const DEFAULT_FPS = 30;

export default function MediaPlayer({ filePath, onTimeUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const animRef = useRef<number>(0);
  const frameBuffer = useRef<ImageData[]>([]);
  const isSeeking = useRef(false);
  const displayPtsRef = useRef(0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

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

    const cleanup = window.electronAPI.onPlayerFrame((frame: PlayerFrame) => {
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

    return () => {
      cancelled = true;
      log.debug('Closing player');
      window.electronAPI.playerClose();
      cleanup();
      cancelAnimationFrame(animRef.current);
    };
  }, [filePath]);

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

  const handlePlayPause = () => {
    if (!isPlaying && displayPtsRef.current === 0 && frameBuffer.current.length === 0) {
      window.electronAPI.playerOpen(filePath);
      setIsPlaying(true);
    } else {
      setIsPlaying((p) => !p);
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
    window.electronAPI.playerSeek(formatTime(time));
    setIsPlaying(true);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    displayPtsRef.current = 0;
    frameBuffer.current = [];
    window.electronAPI.playerClose();
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
    <Box sx={{ bgcolor: '#000', borderRadius: 2, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ maxWidth: '100%', maxHeight: 400, display: 'block', cursor: 'pointer', margin: '0 auto' }}
        onClick={handlePlayPause}
      />
      <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
        <Slider
          size="small"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          onChangeCommitted={handleSeekCommitted}
          sx={{ color: '#fff', py: 0 }}
        />
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton size="small" sx={{ color: '#fff' }} onClick={handlePlayPause}>
            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
          <IconButton size="small" sx={{ color: '#fff' }} onClick={handleStop}>
            <StopIcon />
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', ml: 'auto' }}>
            {displayTime(currentTime)} / {displayTime(duration)}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
