import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, TextField, MenuItem, Button, Paper, Stack } from '@mui/material';
import CodecSelect from '../components/CodecSelect';
import ErrorBanner from '../components/ErrorBanner';
import FileDropZone from '../components/FileDropZone';
import ProgressBar from '../components/ProgressBar';
import { useErrorStore } from '../stores/errorStore';
import { ErrorCode } from '../../shared/errors';
import { BITRATE_OPTIONS } from '../../shared/ui-constants';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';

export default function AudioExtract() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [audioCodec, setAudioCodec] = useState('libmp3lame');
  const [audioBitrate, setAudioBitrate] = useState(BITRATE_OPTIONS[1]);
  const [progress, setProgress] = useState<{ percent: number; time?: string; speed?: string; eta?: string } | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { currentError, showError, clearError } = useErrorStore();
  const transcoder = TRANSCODER_TYPES[0];

  const validate = (): boolean => {
    if (!output.trim()) {
      setErrors({ output: t('validation.outputRequired') });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleExtract = async () => {
    if (!validate()) return;
    if (!input) {
      showError({ code: ErrorCode.INPUT_NOT_SPECIFIED, message: 'Please select a video file.' });
      return;
    }
    setIsConverting(true);
    try {
      await window.electronAPI.convertFile(input, output, { audioCodec, audioBitrate }, transcoder);
      setProgress({ percent: 100, time: 'Done', speed: '-', eta: '0' });
    } catch (err: unknown) {
      showError(err);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        {t('audioExtract.title')}
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentError && <ErrorBanner error={currentError} onClose={clearError} />}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('audioExtract.videoFile')}
          </Typography>
          <FileDropZone onFileSelect={setInput} label={t('audioExtract.dropLabel')} accept="mp4,avi,mkv,mov,flv,wmv,webm" />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('audioExtract.outputFile')}
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              error={!!errors.output}
              helperText={errors.output || ' '}
              value={output}
              onChange={(e) => { setOutput(e.target.value); setErrors(prev => { const next = { ...prev }; delete next.output; return next; }); }}
              onBlur={() => { if (!output.trim()) setErrors(prev => ({ ...prev, output: t('validation.outputRequired') })); }}
              placeholder={t('audioExtract.placeholderOutput')}
            />
            <Button
              variant="outlined"
              onClick={async () => {
                const f = await window.electronAPI.selectOutput();
                if (f) { setOutput(f); setErrors(prev => { const next = { ...prev }; delete next.output; return next; }); }
              }}
            >
              {t('convert.browse')}
            </Button>
          </Stack>
        </Box>
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {t('audioExtract.audioCodec')}
            </Typography>
            <CodecSelect type="audio" value={audioCodec} onChange={setAudioCodec} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {t('audioExtract.bitrate')}
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={audioBitrate}
              onChange={(e) => setAudioBitrate(e.target.value)}
            >
              {BITRATE_OPTIONS.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Stack>
        <Button variant="contained" onClick={handleExtract} disabled={!input || !output || isConverting}>
          {isConverting ? t('audioExtract.extracting') : t('audioExtract.extract')}
        </Button>
        {progress && <ProgressBar percent={progress.percent} />}
      </Paper>
    </Box>
  );
}
