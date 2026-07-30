import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Paper, Grid, Chip, CircularProgress } from '@mui/material';
import FileDropZone from '../components/FileDropZone';
import ErrorBanner from '../components/ErrorBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useErrorStore } from '../stores/errorStore';
import { MediaInfo as MediaInfoType, MediaStreamInfo } from '../../shared/types';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaInfo() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<MediaInfoType | null>(null);
  const [loading, setLoading] = useState(false);
  const { currentError, showError, clearError } = useErrorStore();

  const handleFile = async (path: string) => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getMediaInfo(path, 'FFMPEG');
      setInfo(data);
    } catch (err: unknown) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        {t('mediaInfo.title')}
      </Typography>
      <Box sx={{ maxWidth: 640 }}>
        {currentError && (
          <Box sx={{ mb: 2 }}>
            <ErrorBoundary fallback={null}>
              <ErrorBanner error={currentError} onClose={clearError} />
            </ErrorBoundary>
          </Box>
        )}
        <ErrorBoundary fallback={null}>
          <FileDropZone onFileSelect={handleFile} label={t('mediaInfo.dropLabel')} />
        </ErrorBoundary>
        {loading && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {info && (
          <ErrorBoundary fallback={null}>
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {t('mediaInfo.fileInfo')}
              </Typography>
              <Grid container spacing={1} sx={{ mb: 2 }}>
                {(
                  [
                    [t('mediaInfo.file'), info.file],
                    [t('mediaInfo.format'), info.format],
                    [t('mediaInfo.size'), formatSize(info.size)],
                    [t('mediaInfo.duration'), `${info.duration.toFixed(2)}s`],
                    [t('mediaInfo.bitrate'), info.bitrate],
                  ] as const
                ).map(([label, value]) => (
                  <Grid size={{ xs: 6 }} key={label}>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="body2">{value}</Typography>
                  </Grid>
                ))}
              </Grid>

              <Typography variant="h6" sx={{ mb: 1 }}>
                {t('mediaInfo.streams')} ({info.streams.length})
              </Typography>
              {info.streams.map((stream: MediaStreamInfo, i: number) => (
                <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: 'background.default' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Chip label={stream.type.toUpperCase()} size="small" color={stream.type === 'video' ? 'primary' : 'warning'} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {t('mediaInfo.stream')} #{stream.index}
                    </Typography>
                  </Box>
                  <Grid container spacing={0.5}>
                    {stream.codec && (
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('mediaInfo.codec')}: {stream.codec}
                        </Typography>
                      </Grid>
                    )}
                    {stream.width && (
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('mediaInfo.resolution')}: {stream.width}x{stream.height}
                        </Typography>
                      </Grid>
                    )}
                    {stream.pixelFormat && (
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('mediaInfo.pixelFormat')}: {stream.pixelFormat}
                        </Typography>
                      </Grid>
                    )}
                    {stream.frameRate && (
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('mediaInfo.frameRate')}: {stream.frameRate} fps
                        </Typography>
                      </Grid>
                    )}
                    {stream.bitrate && (
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('mediaInfo.bitrate')}: {stream.bitrate}
                        </Typography>
                      </Grid>
                    )}
                    {stream.sampleRate && (
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('mediaInfo.sampleRate')}: {stream.sampleRate} Hz
                        </Typography>
                      </Grid>
                    )}
                    {stream.channels && (
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('mediaInfo.channels')}: {stream.channels}
                        </Typography>
                      </Grid>
                    )}
                    {stream.language && (
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('mediaInfo.language')}: {stream.language}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              ))}
            </Paper>
          </ErrorBoundary>
        )}
      </Box>
    </Box>
  );
}
