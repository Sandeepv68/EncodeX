import { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, Stack, FormControlLabel, Switch } from '@mui/material';
import ErrorBanner from '../components/ErrorBanner';
import MediaPlayer from '../components/MediaPlayer';
import ProgressBar from '../components/ProgressBar';
import { useErrorStore } from '../stores/errorStore';
import { ErrorCode } from '../../shared/errors';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';

export default function VideoCut() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [useDuration, setUseDuration] = useState(false);
  const { currentError, showError, clearError } = useErrorStore();
  const transcoder = TRANSCODER_TYPES[0];

  const handleCut = async () => {
    if (!input) { showError({ code: ErrorCode.INPUT_NOT_SPECIFIED, message: 'Please select a video file.' }); return; }
    if (!output) { showError({ code: ErrorCode.OUTPUT_NOT_SPECIFIED, message: 'Please specify an output file path.' }); return; }
    setIsConverting(true);
    try {
      await window.electronAPI.convertFile(input, output, {
        copy: true,
        startTime,
        ...(useDuration ? { duration } : { endTime }),
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
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>Cut Video</Typography>
      <Paper sx={{ p: 3, maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentError && <ErrorBanner error={currentError} onClose={clearError} />}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Video File</Typography>
          <Stack direction="row" spacing={1}>
            <TextField fullWidth size="small" value={input || ''} placeholder="No file selected" slotProps={{ input: { readOnly: true } }} />
            <Button variant="outlined" onClick={async () => { const f = await window.electronAPI.selectFile(); if (f) setInput(f); }}>Browse</Button>
          </Stack>
        </Box>

        {input && <MediaPlayer filePath={input} />}

        <Stack direction="row" spacing={1}>
          <TextField fullWidth size="small" label="Output File" value={output} onChange={(e) => setOutput(e.target.value)} placeholder="output path" />
          <Button variant="outlined" onClick={async () => { const f = await window.electronAPI.selectOutput(); if (f) setOutput(f); }}>Browse</Button>
        </Stack>

        <Stack direction="row" spacing={2}>
          <TextField fullWidth size="small" label="Start Time (HH:MM:SS)" value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="00:00:00" />
          {useDuration ? (
            <TextField fullWidth size="small" label="Duration (HH:MM:SS)" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 00:01:30" />
          ) : (
            <TextField fullWidth size="small" label="End Time (HH:MM:SS)" value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="e.g. 00:01:30" />
          )}
        </Stack>

        <FormControlLabel control={<Switch checked={useDuration} onChange={() => setUseDuration(!useDuration)} />} label="Use duration instead of end time" />

        <Button variant="contained" onClick={handleCut} disabled={!input || !output || isConverting}>
          {isConverting ? 'Cutting...' : 'Cut Video'}
        </Button>

        {progress && <ProgressBar percent={progress.percent} />}
      </Paper>
    </Box>
  );
}
