import { Box, LinearProgress, Typography } from '@mui/material';

interface Props {
  percent: number;
  time?: string;
  speed?: string;
  eta?: string;
}

export default function ProgressBar({ percent, time, speed, eta }: Props) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <Box>
      <LinearProgress variant="determinate" value={clamped} sx={{ height: 8, borderRadius: 1 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{clamped.toFixed(1)}%</Typography>
        {time && <Typography variant="caption" color="text.secondary">Time: {time}</Typography>}
        {speed && <Typography variant="caption" color="text.secondary">Speed: {speed}</Typography>}
        {eta && <Typography variant="caption" color="text.secondary">ETA: {eta}s</Typography>}
      </Box>
    </Box>
  );
}
