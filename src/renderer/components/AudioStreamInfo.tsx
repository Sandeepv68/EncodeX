import { useTranslation } from 'react-i18next';
import { Stack, Typography } from '@mui/material';
import type { MediaStreamInfo } from '../../shared/types';
import type { AudioStreamInfoProps } from './types';

function formatStreamLine(stream: MediaStreamInfo): string {
  const parts: string[] = [];
  parts.push(stream.codec + (stream.profile ? ` (${stream.profile})` : ''));
  if (stream.channels != null && stream.channels > 0) parts.push(`${stream.channels} ch`);
  if (stream.sampleRate != null && stream.sampleRate > 0) parts.push(`${stream.sampleRate} Hz`);
  if (stream.channelLayout) parts.push(stream.channelLayout);
  if (stream.bitrate) parts.push(stream.bitrate);
  if (stream.language) parts.push(stream.language);
  return parts.join(' · ');
}

export default function AudioStreamInfo({ streams }: AudioStreamInfoProps) {
  const { t } = useTranslation();
  if (streams.length === 0) return null;
  return (
    <Stack spacing={0.25} data-testid="audio-stream-info">
      {streams.map((stream, i) => (
        <Typography key={i} variant="caption" color="text.secondary" data-testid="audio-stream-row">
          {t('mediaInfo.audio')} #{stream.index} · {formatStreamLine(stream)}
        </Typography>
      ))}
    </Stack>
  );
}
