import { Button, MenuItem } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faBroom } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX } from '../../shared/media-options';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import type { TranscoderType } from '../../shared/types';
import type { BatchControlsProps } from './types';
import { ControlsPaper, ControlsStack, OperationSelect, TranscoderSelect, SuffixField } from '../styles/BatchControls.styles';

export default function BatchControls({ operationRef, transcoderRef, suffixRef, onAddFiles, onCancelAll }: BatchControlsProps) {
  const { t } = useTranslation();

  const operationLabels: Record<string, string> = {
    transcode: t('batchQueue.operationTranscode'),
    extract_audio: t('batchQueue.operationExtractAudio'),
    compress_image: t('batchQueue.operationCompressImage'),
  };

  return (
    <ControlsPaper>
      <ControlsStack direction="row" spacing={1} useFlexGap>
        <OperationSelect
          select
          size="small"
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
        </OperationSelect>
        <TranscoderSelect
          select
          size="small"
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
        </TranscoderSelect>
        <SuffixField
          size="small"
          defaultValue={DEFAULT_SUFFIX}
          onChange={(e) => {
            suffixRef.current = e.target.value;
          }}
          placeholder={t('batchQueue.suffix')}
        />
        <Button variant="outlined" startIcon={<FontAwesomeIcon icon={faPlus} />} onClick={onAddFiles}>
          {t('batchQueue.addFiles')}
        </Button>
        <Button variant="outlined" color="error" startIcon={<FontAwesomeIcon icon={faBroom} />} onClick={onCancelAll}>
          {t('batchQueue.cancelAll')}
        </Button>
      </ControlsStack>
    </ControlsPaper>
  );
}
