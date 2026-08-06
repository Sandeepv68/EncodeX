/**
 * @fileoverview Batch queue configuration and action controls.
 *
 * Renders the toolbar of the Batch Queue page: an operation type selector
 * (transcode / extract audio / compress image), a transcoder backend selector
 * (from TRANSCODER_TYPES), a suffix text field used to build auto-generated
 * output names, and "Add Files" / "Cancel All" action buttons.
 *
 * The three configuration controls are uncontrolled inputs that write their
 * current value into mutable refs (`operationRef`, `transcoderRef`,
 * `suffixRef`) supplied by the parent, so the parent always reads the latest
 * selection without the children needing to lift state. The buttons fire the
 * `onAddFiles` (open the file picker) and `onCancelAll` (clear the queue)
 * callbacks respectively.
 *
 * Props (see {@link BatchControlsProps}):
 *  - operationRef: ref receiving the selected batch operation value.
 *  - transcoderRef: ref receiving the selected TranscoderType.
 *  - suffixRef: ref receiving the current output-name suffix text.
 *  - onAddFiles / onCancelAll: action callbacks for the two buttons.
 */

import { Button, MenuItem } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faBroom } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX } from '../../shared/media-options';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import type { TranscoderType } from '../../shared/types';
import type { BatchControlsProps } from './types';
import { ControlsPaper, ControlsStack, OperationSelect, TranscoderSelect, SuffixField } from '../styles/BatchControls.styles';

/**
 * Renders the batch queue configuration toolbar.
 *
 * Builds a horizontal stack of MUI controls inside a paper surface. The
 * operation and transcoder selects use their first BATCH_OPERATIONS /
 * TRANSCODER_TYPES entry as the default and push every change into the
 * corresponding ref. The suffix field defaults to DEFAULT_SUFFIX. The two
 * outlined buttons (plus icon / broom icon) delegate to the parent callbacks.
 * @param {BatchControlsProps} props - Component props.
 * @param {React.RefObject<string>} props.operationRef - Ref written with the
 *   selected operation value ('transcode' | 'extract_audio' | 'compress_image').
 * @param {React.RefObject<TranscoderType>} props.transcoderRef - Ref written
 *   with the selected transcoder backend.
 * @param {React.RefObject<string>} props.suffixRef - Ref written with the
 *   current output suffix text.
 * @param {() => void} props.onAddFiles - Fired by the "Add Files" button.
 * @param {() => void} props.onCancelAll - Fired by the "Cancel All" button.
 * @returns {JSX.Element} The controls paper.
 */
export default function BatchControls({ operationRef, transcoderRef, suffixRef, onAddFiles, onCancelAll }: BatchControlsProps) {
  const { t } = useTranslation();

  /**
   * Localized display labels keyed by batch operation value.
   * @const {Record<string, string>} operationLabels
   */
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
