import { useRef, useEffect, useCallback, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

interface Props {
  filePath: string;
  onTimeUpdate?: (time: number) => void;
}

const DEFAULT_FPS = 30;

export default function MediaPlayer({ filePath, onTimeUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const animRef = useRef<number>(0);
  const frameBuffer = useRef<ImageData[]>([]);

  useEffect(() => {
    if (!filePath) return;
    window.electronAPI.playerOpen(filePath);
    frameBuffer.current = [];

    const cleanup = window.electronAPI.onPlayerFrame((frame: any) => {
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
      window.electronAPI.playerClose();
      cleanup();
      cancelAnimationFrame(animRef.current);
    };
  }, [filePath]);

  const renderLoop = useCallback(() => {
    if (frameBuffer.current.length > 0) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const data = frameBuffer.current.shift()!;
          canvas.width = data.width;
          canvas.height = data.height;
          ctx.putImageData(data, 0, 0);
          setCurrentTime((t) => t + 1 / DEFAULT_FPS);
          onTimeUpdate?.(currentTime);
        }
      }
    }
    animRef.current = requestAnimationFrame(renderLoop);
  }, [currentTime, onTimeUpdate]);

  useEffect(() => {
    if (isPlaying) animRef.current = requestAnimationFrame(renderLoop);
    else cancelAnimationFrame(animRef.current);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, renderLoop]);

  const mins = Math.floor(currentTime / 60);
  const secs = Math.floor(currentTime % 60);

  return (
    <Box sx={{ bgcolor: '#000', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', maxHeight: 400, display: 'block' }} />
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 1, p: 1, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
        <IconButton size="small" sx={{ color: '#fff' }} onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <Typography variant="caption" sx={{ color: '#fff' }}>{mins}:{secs.toString().padStart(2, '0')}</Typography>
      </Box>
    </Box>
  );
}
