import type { RefObject } from 'react';
import { Button, MenuItem, Paper, Stack, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useTranslation } from 'react-i18next';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX } from '../../shared/media-options';
import { TRANSCODER_TYPES, type TranscoderType } from '../../shared/transcoder-constants';

export interface BatchControlsProps {
  operationRef: RefObject<string>;
  transcoderRef: RefObject<TranscoderType>;
  suffixRef: RefObject<string>;
  onAddFiles: () => void;
  onCancelAll: () => void;
}

export default function BatchControls({ operationRef, transcoderRef, suffixRef, onAddFiles, onCancelAll }: BatchControlsProps) {
  const { t } = useTranslation();

  const operationLabels: Record<string, string> = {
    transcode: t('batchQueue.operationTranscode'),
    extract_audio: t('batchQueue.operationExtractAudio'),
    compress_image: t('batchQueue.operationCompressImage'),
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          sx={{ minWidth: 140 }}
          defaultValue={BATCH_OPERATIONS[0].value}
          onChange={(e) => {
            operationRef.current = e.target.value;
          }}
        >
          {BATCH_OPERATIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {operationLabels[o.value]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          sx={{ minWidth: 110 }}
          defaultValue={TRANSCODER_TYPES[0]}
          onChange={(e) => {
            transcoderRef.current = e.target.value as TranscoderType;
          }}
        >
          {TRANSCODER_TYPES.map((codec) => (
            <MenuItem key={codec} value={codec}>
              {codec}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          sx={{ minWidth: 120 }}
          defaultValue={DEFAULT_SUFFIX}
          onChange={(e) => {
            suffixRef.current = e.target.value;
          }}
          placeholder={t('batchQueue.suffix')}
        />
        <Button variant="outlined" startIcon={<AddIcon />} onClick={onAddFiles}>
          {t('batchQueue.addFiles')}
        </Button>
        <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />} onClick={onCancelAll}>
          {t('batchQueue.cancelAll')}
        </Button>
      </Stack>
    </Paper>
  );
}
