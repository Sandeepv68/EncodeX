/**
 * @fileoverview Window-close confirmation dialog.
 *
 * Coordinates with the main process when a window close is requested: the main
 * process intercepts every close attempt (title-bar X, Alt+F4, taskbar close)
 * and pushes a `onWindowCloseRequested` event. This component checks every page
 * for pending work (jobs in progress, jobs ready to run, or unsaved form
 * changes); if none is pending it confirms the close immediately, otherwise it
 * surfaces a localized `ConfirmDialog` so the user can choose between canceling
 * the close and closing anyway (which abandons the work).
 *
 * Mounted once inside `AppLayout` so it lives for the whole app lifetime,
 * independent of the currently routed page.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from './ConfirmDialog';
import { QUEUE_STATUS } from '../../shared/media-options';
import { useConversionStore } from '../stores/conversionStore';
import { useAudioExtractStore } from '../stores/audioExtractStore';
import { useVideoCutStore, isVideoCutDirty } from '../stores/videoCutStore';
import { useQueueStore } from '../stores/queueStore';
import { useTaskStore } from '../stores/taskStore';

/**
 * Reports whether closing the window would abandon pending work on any page.
 *
 * "Pending work" covers three cases per page: a job currently running, a job
 * fully configured but not started (ready), or a form the user has edited but
 * not run (dirty):
 *  - Convert: `isConverting` (running) or `isDirty` (any edit; `resetForm()`
 *    clears it after a successful conversion).
 *  - Image Compress: `isConverting` (mirrored into `useTaskStore` by
 *    `useMediaTask`) or `hasPendingWork` (input selected; published by the
 *    page).
 *  - Audio Extract: `isConverting` or `isDirty` (input/output/codec/bitrate
 *    edited; cleared by `clearSelection`).
 *  - Video Cut: `isCutting` or `isVideoCutDirty(...)` (draft differs from
 *    defaults, including a persisted draft restored on startup).
 *  - Batch Queue: any job still queued or running.
 *
 * A paused conversion still counts because it is only recoverable while the
 * app stays open. A completed extraction/cut keeps its configured form, so it
 * still counts as ready work.
 *
 * @returns {boolean} True when closing the app would abandon pending work.
 */
export function hasPendingWork(): boolean {
  if (useConversionStore.getState().isConverting) return true;
  if (useConversionStore.getState().isDirty) return true;
  if (useAudioExtractStore.getState().isConverting) return true;
  if (useAudioExtractStore.getState().isDirty) return true;
  if (useVideoCutStore.getState().isCutting) return true;
  if (isVideoCutDirty(useVideoCutStore.getState())) return true;
  if (useTaskStore.getState().isConverting) return true;
  if (useTaskStore.getState().hasPendingWork) return true;
  return useQueueStore.getState().jobs.some((job) => job.status === QUEUE_STATUS.QUEUED || job.status === QUEUE_STATUS.RUNNING);
}

/**
 * Renders the window-close confirmation dialog.
 *
 * Subscribes to `window.electronAPI.onWindowCloseRequested`. When a close is
 * requested and no work is pending, it immediately confirms the close via
 * `windowCloseConfirmed()`; when work is pending it opens the confirmation
 * dialog. Confirming sends `windowCloseConfirmed()`; canceling (backdrop click,
 * Escape, or the cancel button) just dismisses the dialog and keeps the app
 * running.
 *
 * @returns {JSX.Element} The confirmation dialog, rendered only while open.
 */
export default function CloseConfirmDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  /**
   * Subscribes to window close requests from the main process so every close
   * attempt is routed through the pending-work check.
   * @returns {void}
   */
  useEffect(() => {
    const cleanup = window.electronAPI?.onWindowCloseRequested(() => {
      if (hasPendingWork()) {
        setOpen(true);
      } else {
        window.electronAPI?.windowCloseConfirmed();
      }
    });
    return () => cleanup?.();
  }, []);

  /**
   * Confirms the close and dismisses the dialog; the main process completes the
   * window teardown.
   * @returns {void}
   */
  const handleConfirm = () => {
    setOpen(false);
    window.electronAPI?.windowCloseConfirmed();
  };

  /**
   * Cancels the close and dismisses the dialog, leaving the window open and all
   * jobs running.
   * @returns {void}
   */
  const handleClose = () => {
    setOpen(false);
  };

  return (
    <ConfirmDialog
      open={open}
      title={t('closeConfirm.title')}
      message={t('closeConfirm.message')}
      confirmLabel={t('closeConfirm.confirmLabel')}
      cancelLabel={t('closeConfirm.cancelLabel')}
      onClose={handleClose}
      onConfirm={handleConfirm}
    />
  );
}
