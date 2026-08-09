/**
 * @fileoverview Window-close confirmation dialog.
 *
 * Coordinates with the main process when a window close is requested: the main
 * process intercepts every close attempt (title-bar X, Alt+F4, taskbar close)
 * and pushes a `onWindowCloseRequested` event. This component checks every page
 * for in-progress jobs; if none are running it confirms the close immediately,
 * otherwise it surfaces a localized `ConfirmDialog` so the user can choose
 * between canceling the close and closing anyway (which abandons the jobs).
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
import { useVideoCutStore } from '../stores/videoCutStore';
import { useQueueStore } from '../stores/queueStore';
import { useTaskStore } from '../stores/taskStore';

/**
 * Reports whether any page currently has a job in progress.
 *
 * Checks the single-source stores for each page that runs long-lived work:
 * the Convert page (`useConversionStore.isConverting`), the Image Compress and
 * Video Cut pages (mirrored into `useTaskStore` by `useMediaTask`), the Audio
 * Extract page (`useAudioExtractStore.isConverting`), the Video Cut page
 * (`useVideoCutStore.isCutting`), and the Batch Queue (any job still queued or
 * running). A paused conversion still counts because it is only recoverable
 * while the app stays open.
 *
 * @returns {boolean} True when closing the app would abandon active work.
 */
export function hasActiveJobs(): boolean {
  if (useConversionStore.getState().isConverting) return true;
  if (useAudioExtractStore.getState().isConverting) return true;
  if (useVideoCutStore.getState().isCutting) return true;
  if (useTaskStore.getState().isConverting) return true;
  return useQueueStore.getState().jobs.some((job) => job.status === QUEUE_STATUS.QUEUED || job.status === QUEUE_STATUS.RUNNING);
}

/**
 * Renders the window-close confirmation dialog.
 *
 * Subscribes to `window.electronAPI.onWindowCloseRequested`. When a close is
 * requested and no jobs are in progress, it immediately confirms the close via
 * `windowCloseConfirmed()`; when jobs are active it opens the confirmation
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
   * attempt is routed through the active-job check.
   * @returns {void}
   */
  useEffect(() => {
    const cleanup = window.electronAPI?.onWindowCloseRequested(() => {
      if (hasActiveJobs()) {
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
