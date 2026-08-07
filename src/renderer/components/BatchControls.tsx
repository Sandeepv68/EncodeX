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
 * selection without the children needing to lift state. The concurrency select
 * is controlled through `concurrency` / `onConcurrencyChange` since it takes
 * effect immediately. The buttons fire the `onAddFiles` (open the file picker),
 * `onCancelAll` (clear the queue), and `onClearCompleted` (drop done/error
 * jobs, disabled via `hasCompleted`) callbacks respectively.
 *
 * Props (see {@link BatchControlsProps}):
 *  - operationRef: ref receiving the selected batch operation value.
 *  - transcoderRef: ref receiving the selected TranscoderType.
 *  - suffixRef: ref receiving the current output-name suffix text.
 *  - onAddFiles / onCancelAll / onClearCompleted: action callbacks for the buttons.
 *  - hasCompleted: true when the queue contains done or errored jobs.
 *  - concurrency / onConcurrencyChange: controlled parallel-job count (1-4).
 *  - paused: true while the queue is paused (shows Resume instead of Pause).
 *  - onPause / onResume: fired by the pause/resume toggle button.
 *  - hasActive: true when the queue contains queued or running jobs; the
 *    pause button is disabled when false (nothing to pause).
 *  - outputDir / onOutputDirChange: controlled output-folder field; empty
 *    means outputs are written next to their source files.
 *  - onBrowseDir: fired by the Browse button next to the output folder field.
 *  - overwrite / onOverwriteChange: controlled toggle allowing existing output
 *    files to be replaced when adding jobs.
 *  - onExport: fired by the Export button; the parent writes the queue to a
 *    JSON file via the main process.
 *  - onImport: fired by the Import button; the parent reads and enqueues a
 *    JSON queue file via the main process.
 */

import { Button, Checkbox, FormControlLabel, MenuItem } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faBroom,
  faCheckDouble,
  faPause,
  faPlay,
  faFolderOpen,
  faFileExport,
  faFileImport,
} from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX } from '../../shared/media-options';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { MAX_QUEUE_CONCURRENCY } from '../../shared/constants';
import type { TranscoderType } from '../../shared/types';
import type { BatchControlsProps } from './types';
import {
  ControlsPaper,
  ControlsStack,
  OperationSelect,
  TranscoderSelect,
  ConcurrencySelect,
  SuffixField,
  OutputDirField,
} from '../styles/BatchControls.styles';

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
 * @param {() => void} props.onClearCompleted - Fired by the "Clear Completed" button.
 * @param {boolean} props.hasCompleted - Enables the "Clear Completed" button when
 *   any done or errored job exists.
 * @param {number} props.concurrency - Current parallel-job count (1-4).
 * @param {(concurrency: number) => void} props.onConcurrencyChange - Fired with
 *   the new value when the concurrency select changes.
 * @param {boolean} props.paused - True while the queue is paused.
 * @param {() => void} props.onPause - Fired by the Pause button.
 * @param {() => void} props.onResume - Fired by the Resume button.
 * @param {boolean} props.hasActive - True when queued or running jobs exist;
 *   the pause button is disabled when false.
 * @param {string} props.outputDir - Current output folder; empty means
 *   outputs are written next to their source files.
 * @param {(dir: string) => void} props.onOutputDirChange - Fired with the new
 *   folder text when the output-folder field changes.
 * @param {() => void} props.onBrowseDir - Fired by the Browse button to open
 *   the native folder picker.
 * @param {boolean} props.overwrite - Whether existing output files may be
 *   replaced when adding jobs.
 * @param {(overwrite: boolean) => void} props.onOverwriteChange - Fired with
 *   the new value when the overwrite toggle changes.
 * @param {() => void} props.onExport - Fired by the Export button.
 * @param {() => void} props.onImport - Fired by the Import button.
 * @returns {JSX.Element} The controls paper.
 */
export default function BatchControls({
  operationRef,
  transcoderRef,
  suffixRef,
  onAddFiles,
  onCancelAll,
  onClearCompleted,
  hasCompleted,
  concurrency,
  onConcurrencyChange,
  paused,
  onPause,
  onResume,
  hasActive,
  outputDir,
  onOutputDirChange,
  onBrowseDir,
  overwrite,
  onOverwriteChange,
  onExport,
  onImport,
}: BatchControlsProps) {
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
        <OutputDirField
          size="small"
          value={outputDir}
          onChange={(e) => {
            onOutputDirChange(e.target.value);
          }}
          placeholder={t('batchQueue.outputDirPlaceholder')}
        />
        <Button variant="outlined" startIcon={<FontAwesomeIcon icon={faFolderOpen} />} onClick={onBrowseDir}>
          {t('batchQueue.browse')}
        </Button>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={overwrite}
              onChange={(e) => {
                onOverwriteChange(e.target.checked);
              }}
            />
          }
          label={t('batchQueue.overwrite')}
        />
        <ConcurrencySelect
          select
          size="small"
          label={t('batchQueue.concurrency')}
          value={concurrency}
          onChange={(e) => {
            onConcurrencyChange(Number(e.target.value));
          }}
        >
          {Array.from({ length: MAX_QUEUE_CONCURRENCY }, (_, i) => i + 1).map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </ConcurrencySelect>
        <Button variant="outlined" startIcon={<FontAwesomeIcon icon={faPlus} />} onClick={onAddFiles}>
          {t('batchQueue.addFiles')}
        </Button>
        <Button variant="outlined" color="error" startIcon={<FontAwesomeIcon icon={faBroom} />} onClick={onCancelAll}>
          {t('batchQueue.cancelAll')}
        </Button>
        {paused ? (
          <Button variant="outlined" color="success" startIcon={<FontAwesomeIcon icon={faPlay} />} onClick={onResume}>
            {t('batchQueue.resume')}
          </Button>
        ) : (
          <Button variant="outlined" color="warning" startIcon={<FontAwesomeIcon icon={faPause} />} onClick={onPause} disabled={!hasActive}>
            {t('batchQueue.pause')}
          </Button>
        )}
        <Button variant="outlined" startIcon={<FontAwesomeIcon icon={faCheckDouble} />} onClick={onClearCompleted} disabled={!hasCompleted}>
          {t('batchQueue.clearCompleted')}
        </Button>
        <Button variant="outlined" startIcon={<FontAwesomeIcon icon={faFileExport} />} onClick={onExport}>
          {t('batchQueue.exportQueue')}
        </Button>
        <Button variant="outlined" startIcon={<FontAwesomeIcon icon={faFileImport} />} onClick={onImport}>
          {t('batchQueue.importQueue')}
        </Button>
      </ControlsStack>
    </ControlsPaper>
  );
}
