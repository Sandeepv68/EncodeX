/**
 * @fileoverview React hook that wraps media task execution with a shared
 * progress and "is converting" lifecycle.
 *
 * The hook owns the live progress state of a single operation and subscribes
 * once (at mount) to the main process's `onConversionProgress` push events,
 * gating them with a ref so progress is only applied while a task is actually
 * running. The returned `runTask` helper sets the converting flags, awaits the
 * caller-supplied task, records 100% progress (COMPLETED_PROGRESS) on success,
 * and surfaces any thrown error through the global error store. It is consumed
 * by media panels (audio extraction, GIF creation, etc.) that want a common
 * progress/converting experience without duplicating subscription logic.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Logger } from '../../shared/logger';
import { COMPLETED_PROGRESS } from '../../shared/transcoder-constants';
import type { ConversionProgress } from '../../shared/types';
import { useErrorStore } from '../stores/errorStore';
import { LOG_SUBSCRIBING_TO_CONVERSION_PROGRESS, LOG_UNSUBSCRIBING_FROM_CONVERSION_PROGRESS } from '../../shared/log-constants';
import type { TaskProgress } from './types';

/**
 * Module-scoped logger for the media task hook.
 * @const {Logger} log
 */
const log = new Logger('renderer/hooks/useMediaTask');

/**
 * React hook providing a reusable media-task lifecycle (progress + running
 * state).
 *
 * State managed:
 *  - `progress`: the live task progress (TaskProgress), or null when no task
 *    has run.
 *  - `isConverting`: boolean flag set while a task is running.
 *  - `isConvertingRef`: a ref mirroring isConverting so the progress
 *    subscription callback can check it without re-subscribing.
 *
 * Side effects / dependencies:
 *  - On mount (empty dependency array) it subscribes to
 *    window.electronAPI.onConversionProgress and tears the subscription down on
 *    unmount via the returned unsubscribe function. Progress events are ignored
 *    unless a task is running (guarded by isConvertingRef). When
 *    `window.electronAPI` is unavailable (e.g. running outside Electron), the
 *    optional chain skips the subscription entirely.
 *  - `runTask` is memoized with useCallback and depends on the `showError`
 *    action selected from the error store.
 *
 * @returns {Object} Object exposing the progress state, its setter, and the
 *   task runner:
 * @property {TaskProgress | null} progress - Live task progress, or null when
 *   idle.
 * @property {(p: TaskProgress | null) => void} setProgress - Direct setter for
 *   the progress state, exposed so callers can update progress themselves.
 * @property {boolean} isConverting - True while a task is running.
 * @property {(task: () => Promise<void>) => Promise<void>} runTask - Runs a task
 *   with the shared lifecycle, setting progress to 100% on success.
 */
export function useMediaTask() {
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const isConvertingRef = useRef(false);
  const showError = useErrorStore((s) => s.showError);

  useEffect(() => {
    log.debug(LOG_SUBSCRIBING_TO_CONVERSION_PROGRESS);
    const cleanup = window.electronAPI?.onConversionProgress((data: { input: string; output: string; progress: ConversionProgress }) => {
      if (!isConvertingRef.current) return;
      const p = data.progress;
      setProgress({ percent: p.percent, time: p.time, speed: p.speed, eta: p.eta });
    });
    return () => {
      log.debug(LOG_UNSUBSCRIBING_FROM_CONVERSION_PROGRESS);
      cleanup?.();
    };
  }, []);

  const runTask = useCallback(
    async (task: () => Promise<void>) => {
      isConvertingRef.current = true;
      setIsConverting(true);
      try {
        await task();
        setProgress(COMPLETED_PROGRESS);
      } catch (err: unknown) {
        showError(err);
      } finally {
        isConvertingRef.current = false;
        setIsConverting(false);
      }
    },
    [showError],
  );

  return { progress, setProgress, isConverting, runTask };
}
