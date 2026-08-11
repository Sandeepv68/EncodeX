/**
 * @fileoverview Drag-and-drop and click-to-browse file selection zone.
 *
 * Renders a tappable drop target that lets the user choose a single media file
 * either by dragging it onto the zone or by clicking to open the native file
 * dialog. The resolved file path is forwarded to the parent via `onFileSelect`.
 *
 * The zone visually highlights while a file is dragged over it, and supports an
 * optional accept filter that restricts the native dialog to specific file
 * extensions. Used wherever a source file must be picked (e.g. the Convert and
 * Media Info pages).
 *
 * Props (see {@link FileDropZoneProps}):
 *  - onFileSelect: callback receiving the selected file path.
 *  - label: optional custom text shown inside the zone.
 *  - accept: optional comma-separated list of file extensions for the dialog.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { faCloudArrowUp } from '@fortawesome/free-solid-svg-icons';
import { Logger } from '../../shared/logger';
import type { FileDropZoneProps } from './types';
import { DropZoneRoot, UploadIcon } from '../styles/FileDropZone.styles';
import { LOG_FILE_DROPPED, LOG_FILE_SELECTED, LOG_OPENING_FILE_DIALOG_ACCEPT } from '../../shared/log-constants';

/**
 * Logger instance for this module, scoped to the FileDropZone component.
 * @type {Logger}
 */
const log = new Logger('renderer/components/FileDropZone');

/**
 * Renders the file drop zone.
 *
 * Renders a styled drop target with a cloud upload icon and a label (either the
 * `label` prop or a localized default). Dragging a file over the zone sets the
 * `dragging` state to style the root; dropping a file resolves its path through
 * `window.electronAPI.getPathForFile` and reports it via `onFileSelect`.
 * Clicking the zone invokes {@link handleClick} to open the native file dialog.
 *
 * @param {FileDropZoneProps} props - Component props.
 * @param {(path: string) => void} props.onFileSelect - Callback invoked with
 *   the absolute path of the selected file.
 * @param {string} [props.label] - Optional label to display inside the zone;
 *   defaults to the localized `fileDropZone.defaultLabel`.
 * @param {string} [props.accept] - Optional comma-separated extension list used
 *   to filter the native file dialog.
 * @returns {JSX.Element} The drop zone root.
 */
export default function FileDropZone({ onFileSelect, label, accept }: FileDropZoneProps) {
  const { t } = useTranslation();
  const resolvedLabel = label || t('fileDropZone.defaultLabel');
  const [dragging, setDragging] = useState(false);

  /**
   * Handles dropping a file onto the zone.
   *
   * Prevents the browser default (which would navigate to the file), clears the
   * dragging state, and forwards the first dropped file to `onFileSelect` after
   * resolving its absolute path. Logs the drop for diagnostics.
   * @param {React.DragEvent} e - The drop event carrying the transferred files.
   * @returns {void}
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        const path = window.electronAPI.getPathForFile(file);
        log.info(LOG_FILE_DROPPED, path);
        onFileSelect(path);
      }
    },
    [onFileSelect],
  );

  /**
   * Opens the native file dialog and forwards the chosen file.
   *
   * Builds an extension filter from the `accept` prop when present (splitting on
   * commas and trimming each extension), calls `window.electronAPI.selectFile`,
   * and reports the selected path to `onFileSelect`. Logs both the dialog intent
   * and the resulting selection.
   * @returns {Promise<void>}
   */
  const handleClick = async () => {
    const extList = accept ? [{ name: 'Files', extensions: accept.split(',').map((s) => s.trim()) }] : undefined;
    log.debug(LOG_OPENING_FILE_DIALOG_ACCEPT, accept);
    const file = await window.electronAPI?.selectFile(extList);
    if (file) {
      log.info(LOG_FILE_SELECTED, file);
      onFileSelect(file);
    }
  };

  return (
    <DropZoneRoot
      $dragging={dragging}
      data-testid="file-drop-zone"
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onClick={handleClick}
    >
      <UploadIcon icon={faCloudArrowUp} />
      <Typography color="text.secondary">{resolvedLabel}</Typography>
      <Typography variant="caption" color="text.secondary">
        {t('fileDropZone.dropHint')}
      </Typography>
    </DropZoneRoot>
  );
}
