import { useState } from 'react';
import { Box, Typography, TextField, MenuItem, Button, Paper, Stack } from '@mui/material';
import FileDropZone from '../components/FileDropZone';
import ErrorBanner from '../components/ErrorBanner';
import ProgressBar from '../components/ProgressBar';
import { useErrorStore } from '../stores/errorStore';
import { ErrorCode } from '../../shared/errors';
import { IMAGE_FORMATS, IMAGE_CODEC_MAP } from '../../shared/ui-constants';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';

export default function ImageCompress() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [format, setFormat] = useState(IMAGE_FORMATS[0].value);
  const [quality, setQuality] = useState(23);
  const [scale, setScale] = useState('');
  const [progress, setProgress] = useState<any>(null);
  const [isConverting, setIsConverting] = useState(false);
  const { currentError, showError, clearError } = useErrorStore();
  const transcoder = TRANSCODER_TYPES[0];

  const handleConvert = async () => {
    if (!input) { showError({ code: ErrorCode.INPUT_NOT_SPECIFIED, message: 'Please select an input image.' }); return; }
    if (!output) { showError({ code: ErrorCode.OUTPUT_NOT_SPECIFIED, message: 'Please specify an output file path.' }); return; }
    setIsConverting(true);
    try {
      await window.electronAPI.convertFile(input, output, {
        videoCodec: IMAGE_CODEC_MAP[format],
        qscale: quality,
        scale: scale || undefined,
        pixelFormat: 'yuv420p',
      }, transcoder);
      setProgress({ percent: 100, time: 'Done', speed: '-', eta: '0' });
    } catch (err: any) {
      showError(err);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>Compress Image</Typography>
      <Paper sx={{ p: 3, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentError && <ErrorBanner error={currentError} onClose={clearError} />}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Input Image</Typography>
          <FileDropZone onFileSelect={setInput} label="Drop image here" accept="jpg,jpeg,png,webp,bmp" />
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField fullWidth size="small" label="Output File" value={output} onChange={(e) => setOutput(e.target.value)} placeholder="output path" />
          <Button variant="outlined" onClick={async () => { const f = await window.electronAPI.selectOutput(); if (f) setOutput(f); }}>Browse</Button>
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField select fullWidth size="small" label="Output Format" value={format} onChange={(e) => setFormat(e.target.value)}>
            {IMAGE_FORMATS.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" label="Quality (1-31)" type="number" value={quality} onChange={(e) => setQuality(parseInt(e.target.value) || 23)} slotProps={{ htmlInput: { min: 1, max: 31 } }} />
        </Stack>
        <TextField fullWidth size="small" label="Scale (optional)" value={scale} onChange={(e) => setScale(e.target.value)} placeholder="e.g. 800x600" />
        <Button variant="contained" onClick={handleConvert} disabled={!input || !output || isConverting}>
          {isConverting ? 'Compressing...' : 'Compress Image'}
        </Button>
        {progress && <ProgressBar percent={progress.percent} />}
      </Paper>
    </Box>
  );
}
