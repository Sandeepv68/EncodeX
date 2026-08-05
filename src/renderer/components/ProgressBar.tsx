import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import type { ProgressBarProps } from './types';
import { ProgressTrack, ProgressInfoRow } from '../styles/ProgressBar.styles';

export default function ProgressBar({ percent, time, speed, eta, paused = false }: ProgressBarProps) {
  const { t } = useTranslation();
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <Box>
      <ProgressTrack variant="determinate" value={clamped} paused={paused} />
      <ProgressInfoRow>
        <Typography variant="caption" color="text.secondary">
          {clamped.toFixed(1)}%
        </Typography>
        {time && (
          <Typography variant="caption" color="text.secondary">
            {t('progress.time')}: {time}
          </Typography>
        )}
        {speed && (
          <Typography variant="caption" color="text.secondary">
            {t('progress.speed')}: {speed}
          </Typography>
        )}
        {eta && eta !== '0' && (
          <Typography variant="caption" color="text.secondary">
            {t('progress.eta')}: {eta}s
          </Typography>
        )}
      </ProgressInfoRow>
    </Box>
  );
}
