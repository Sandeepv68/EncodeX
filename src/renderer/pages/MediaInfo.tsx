import { useState } from 'react';
import { Box, Typography, Paper, Grid, Chip, CircularProgress } from '@mui/material';
import FileDropZone from '../components/FileDropZone';
import ErrorBanner from '../components/ErrorBanner';
import { useErrorStore } from '../stores/errorStore';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaInfo() {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { currentError, showError, clearError } = useErrorStore();

  const handleFile = async (path: string) => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getMediaInfo(path, 'FFMPEG');
      setInfo(data);
    } catch (err: any) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>Media Information</Typography>
      <Box sx={{ maxWidth: 640 }}>
        {currentError && <Box sx={{ mb: 2 }}><ErrorBanner error={currentError} onClose={clearError} /></Box>}
        <FileDropZone onFileSelect={handleFile} label="Drop a media file here or click to browse" />
        {loading && <Box sx={{ textAlign: 'center', mt: 2 }}><CircularProgress size={24} /></Box>}
        {info && (
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>File Info</Typography>
            <Grid container spacing={1} sx={{ mb: 2 }}>
              {[
                ['File', info.file],
                ['Format', info.format],
                ['Size', formatSize(info.size)],
                ['Duration', `${info.duration.toFixed(2)}s`],
                ['Bitrate', info.bitrate],
              ].map(([label, value]) => (
                <Grid size={{ xs: 6 }} key={label as string}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="body2">{value as string}</Typography>
                </Grid>
              ))}
            </Grid>

            <Typography variant="h6" sx={{ mb: 1 }}>Streams ({info.streams.length})</Typography>
            {info.streams.map((stream: any, i: number) => (
              <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: 'background.default' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip label={stream.type.toUpperCase()} size="small" color={stream.type === 'video' ? 'primary' : 'warning'} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Stream #{stream.index}</Typography>
                </Box>
                <Grid container spacing={0.5}>
                  {stream.codec && <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">Codec: {stream.codec}</Typography></Grid>}
                  {stream.width && <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">Resolution: {stream.width}x{stream.height}</Typography></Grid>}
                  {stream.pixelFormat && <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">Pixel Format: {stream.pixelFormat}</Typography></Grid>}
                  {stream.frameRate && <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">Frame Rate: {stream.frameRate} fps</Typography></Grid>}
                  {stream.bitrate && <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">Bitrate: {stream.bitrate}</Typography></Grid>}
                  {stream.sampleRate && <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">Sample Rate: {stream.sampleRate} Hz</Typography></Grid>}
                  {stream.channels && <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">Channels: {stream.channels}</Typography></Grid>}
                  {stream.language && <Grid size={{ xs: 6 }}><Typography variant="caption" color="text.secondary">Language: {stream.language}</Typography></Grid>}
                </Grid>
              </Paper>
            ))}
          </Paper>
        )}
      </Box>
    </Box>
  );
}
