import { useTranslation } from 'react-i18next';
import { Box, Button, Typography, TextField, MenuItem, FormControlLabel, Switch, Paper, Stack } from '@mui/material';
import { useConversion } from '../hooks/useConversion';
import CodecSelect from '../components/CodecSelect';
import ErrorBanner from '../components/ErrorBanner';
import ProgressBar from '../components/ProgressBar';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { PIXEL_FORMATS } from '../../shared/ui-constants';
import { TRANSCODER_TYPES, TRANSCODER_LABELS } from '../../shared/transcoder-constants';

export default function Convert() {
  const { t } = useTranslation();
  const {
    inputFile,
    outputFile,
    videoCodec,
    audioCodec,
    videoBitrate,
    audioBitrate,
    qscale,
    scale,
    pixelFormat,
    copyMode,
    transcoder,
    isConverting,
    progress,
    setInputFile,
    setOutputFile,
    setVideoCodec,
    setAudioCodec,
    setVideoBitrate,
    setAudioBitrate,
    setQscale,
    setScale,
    setPixelFormat,
    setCopyMode,
    setTranscoder,
    startConversion,
    cancelConversion,
    selectInput,
    selectOutput,
  } = useConversion();

  const { currentError, clearError } = useErrorHandler();

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        {t('convert.title')}
      </Typography>
      <Paper sx={{ p: 3, maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentError && <ErrorBanner error={currentError} onClose={clearError} />}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('convert.inputFile')}
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              value={inputFile || ''}
              placeholder={t('convert.noFile')}
              slotProps={{ input: { readOnly: true } }}
            />
            <Button variant="outlined" onClick={selectInput}>
              {t('convert.browse')}
            </Button>
          </Stack>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('convert.outputFile')}
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              fullWidth
              size="small"
              value={outputFile || ''}
              placeholder={t('convert.noOutput')}
              slotProps={{ input: { readOnly: true } }}
            />
            <Button variant="outlined" onClick={selectOutput}>
              {t('convert.saveAs')}
            </Button>
          </Stack>
        </Box>

        <FormControlLabel
          control={<Switch checked={copyMode} onChange={(e) => setCopyMode(e.target.checked)} />}
          label={t('convert.losslessCopy')}
        />

        {!copyMode && (
          <>
            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {t('convert.videoCodec')}
                </Typography>
                <CodecSelect type="video" value={videoCodec} onChange={setVideoCodec} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {t('convert.audioCodec')}
                </Typography>
                <CodecSelect type="audio" value={audioCodec} onChange={setAudioCodec} />
              </Box>
            </Stack>

            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                size="small"
                label={t('convert.videoBitrate')}
                value={videoBitrate}
                onChange={(e) => setVideoBitrate(e.target.value)}
                placeholder={t('convert.placeholderBitrate')}
              />
              <TextField
                fullWidth
                size="small"
                label={t('convert.audioBitrate')}
                value={audioBitrate}
                onChange={(e) => setAudioBitrate(e.target.value)}
                placeholder={t('convert.placeholderAudioBitrate')}
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                size="small"
                label={t('convert.qscale')}
                type="number"
                value={qscale}
                onChange={(e) => setQscale(parseInt(e.target.value) || 23)}
                slotProps={{ htmlInput: { min: 1, max: 31 } }}
              />
              <TextField
                fullWidth
                size="small"
                label={t('convert.scale')}
                value={scale}
                onChange={(e) => setScale(e.target.value)}
                placeholder={t('convert.placeholderScale')}
              />
              <TextField
                select
                fullWidth
                size="small"
                label={t('convert.pixelFormat')}
                value={pixelFormat}
                onChange={(e) => setPixelFormat(e.target.value)}
              >
                {PIXEL_FORMATS.map((f) => (
                  <MenuItem key={f} value={f}>
                    {f}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('convert.transcoderCore')}
          </Typography>
          <TextField select fullWidth size="small" value={transcoder} onChange={(e) => setTranscoder(e.target.value)}>
            {TRANSCODER_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {TRANSCODER_LABELS[t]}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={startConversion} disabled={!inputFile || !outputFile || isConverting}>
            {isConverting ? t('convert.converting') : t('convert.startConversion')}
          </Button>
          {isConverting && (
            <Button variant="contained" color="error" onClick={cancelConversion}>
              {t('convert.cancel')}
            </Button>
          )}
        </Stack>

        {progress && <ProgressBar percent={progress.percent} time={progress.time} speed={progress.speed} eta={progress.eta} />}
      </Paper>
    </Box>
  );
}
