import { Box, Chip, Grid, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MediaStreamInfo } from '../../shared/types';

export interface StreamDetailsProps {
  streams: MediaStreamInfo[];
}

export default function StreamDetails({ streams }: StreamDetailsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {t('mediaInfo.streams')} ({streams.length})
      </Typography>
      {streams.map((stream, i) => (
        <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: 'background.default' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Chip label={stream.type.toUpperCase()} size="small" color={stream.type === 'video' ? 'primary' : 'warning'} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {t('mediaInfo.stream')} #{stream.index}
            </Typography>
          </Box>
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
        </Paper>
      ))}
    </>
  );
}
