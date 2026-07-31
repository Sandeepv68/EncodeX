import { Chip, Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MediaStreamInfo } from '../../shared/types';
import { StreamTitle, StreamPaper, StreamHeaderRow, StreamName } from '../styles/StreamDetails.styles';

export interface StreamDetailsProps {
  streams: MediaStreamInfo[];
}

export default function StreamDetails({ streams }: StreamDetailsProps) {
  const { t } = useTranslation();

  return (
    <>
      <StreamTitle variant="h6">
        {t('mediaInfo.streams')} ({streams.length})
      </StreamTitle>
      {streams.map((stream, i) => (
        <StreamPaper key={i} variant="outlined">
          <StreamHeaderRow>
            <Chip label={stream.type.toUpperCase()} size="small" color={stream.type === 'video' ? 'primary' : 'warning'} />
            <StreamName variant="body2">
              {t('mediaInfo.stream')} #{stream.index}
            </StreamName>
          </StreamHeaderRow>
          <Grid container spacing={0.5}>
            {stream.codec && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('mediaInfo.codec')}: {stream.codec}
                </Typography>
              </Grid>
            )}
            {stream.width && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('mediaInfo.resolution')}: {stream.width}x{stream.height}
                </Typography>
              </Grid>
            )}
            {stream.pixelFormat && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('mediaInfo.pixelFormat')}: {stream.pixelFormat}
                </Typography>
              </Grid>
            )}
            {stream.frameRate && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('mediaInfo.frameRate')}: {stream.frameRate} fps
                </Typography>
              </Grid>
            )}
            {stream.bitrate && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('mediaInfo.bitrate')}: {stream.bitrate}
                </Typography>
              </Grid>
            )}
            {stream.sampleRate && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('mediaInfo.sampleRate')}: {stream.sampleRate} Hz
                </Typography>
              </Grid>
            )}
            {stream.channels && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('mediaInfo.channels')}: {stream.channels}
                </Typography>
              </Grid>
            )}
            {stream.language && (
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('mediaInfo.language')}: {stream.language}
                </Typography>
              </Grid>
            )}
          </Grid>
        </StreamPaper>
      ))}
    </>
  );
}
