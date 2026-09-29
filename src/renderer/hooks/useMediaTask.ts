/**
 * @fileoverview React hooks that wrap media task execution with a shared
 * progress and "is converting" lifecycle.
 *
 * Two variants are exported:
 *
 *  - `useMediaTask` — for tasks whose run state lives in local component state
 *    (Image Compress, Video Cut). It subscribes once (at mount) to the main
 *    process's `onConversionProgress` push events, gating them with a ref so
 *    progress is only applied while a task is actually running. The returned
 *    `runTask` helper sets the converting flags, awaits the caller-supplied
 *    task, records 100% progress (COMPLETED_PROGRESS) on success, and surfaces
 *    any thrown error through the global error store.
 *  - `useTaskRunControls` — for store-owned tasks (Remux, Demux) whose run
 *    state (isConverting / isPaused / progress / current) lives in a Zustand
 *    singleton store. It binds the common run-control surface directly to the
 *    passed store so pages share one set of selectors without duplicating
 *    subscription logic. Demux exposes its `current` sub-task label through the
 *    returned `current` value; Remux (single invocation) leaves it null. The
 *    store instance (and only the store instance) owns pause/resume/cancel, so
 *    these wrappers are read-only views over the store.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, type StoreApi, type UseBoundStore } from 'zustand';
import { Logger } from '../../shared/logger';
import { COMPLETED_PROGRESS } from '../../shared/transcoder-constants';
import type { ConversionProgress } from '../../shared/types';
import { toTaskProgress } from '../../shared/progress';
import { useErrorStore } from '../stores/errorStore';
import { useTaskStore } from '../stores/taskStore';
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
 *   with the shared lifecycle, setting progress to 100% on success. The running
 *   state is mirrored into the global task store so cross-cutting features
 *   (e.g. the close-confirmation dialog) can detect in-progress jobs.
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
      setProgress(toTaskProgress(data.progress));
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
      useTaskStore.getState().setIsConverting(true);
      try {
        await task();
        setProgress(COMPLETED_PROGRESS);
      } catch (err: unknown) {
        showError(err);
      } finally {
        isConvertingRef.current = false;
        setIsConverting(false);
        useTaskStore.getState().setIsConverting(false);
      }
    },
    [showError],
  );

  return { progress, setProgress, isConverting, runTask };
}

/**
 * Structural subset of a store-owned media task that `useTaskRunControls` binds
 * to. Both RemuxState and DemuxState satisfy it (Demux adds `current`, which is
 * optional here so Remux single-invocation tasks simply report null).
 * @typedef {Object} TaskRunStoreState
 * @property {TaskProgress | null} progress - Live task progress, or null when idle.
 * @property {boolean} isConverting - Whether a task is currently running.
 * @property {boolean} isPaused - Whether the running task is paused.
 * @property {string | null} [current] - Label of the current sub-task (Demux),
 *   or null when the task is a single invocation.
 * @property {() => Promise<void>} pause - Pauses the running task.
 * @property {() => Promise<void>} resume - Resumes the paused task.
 * @property {() => Promise<void>} cancel - Cancels the task.
 */
type TaskRunStoreState = {
  progress: TaskProgress | null;
  isConverting: boolean;
  isPaused: boolean;
  current?: string | null;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
};

/**
 * React hook exposing the shared run control surface of a store-owned media
 * task (Remux / Demux) from its Zustand store.
 *
 * Unlike `useMediaTask` (local component state), the run state lives in the
 * store itself, so this hook only reads the store's published fields — it never
 * manages progress or the converting flag. The returned fields are therefore a
 * consistent view over whichever store is passed; the `current` sub-task label
 * is surfaced for Demux (null for Remux). Pause/resume/cancel are bound to the
 * store actions, which delegate to the main process.
 *
 * @param {UseBoundStore<StoreApi<TaskRunStoreState>>} useStoreHook - The Zustand
 *   store hook for the task (e.g. `useRemuxStore` or `useDemuxStore`).
 * @returns {Object} The run control surface:
 * @property {TaskProgress | null} progress - Live task progress, or null when idle.
 * @property {boolean} isConverting - Whether a task is currently running.
 * @property {boolean} isPaused - Whether the running task is paused.
 * @property {string | null} current - Current sub-task label (null for Remux).
 * @property {() => Promise<void>} pause - Pauses the running task.
 * @property {() => Promise<void>} resume - Resumes the paused task.
 * @property {() => Promise<void>} cancel - Cancels the task.
 */
export function useTaskRunControls<TState extends TaskRunStoreState>(useStoreHook: UseBoundStore<StoreApi<TState>>) {
  const progress = useStore(useStoreHook, (s) => s.progress);
  const isConverting = useStore(useStoreHook, (s) => s.isConverting);
  const isPaused = useStore(useStoreHook, (s) => s.isPaused);
  const current = useStore(useStoreHook, (s) => s.current ?? null);
  const pause = useStore(useStoreHook, (s) => s.pause);
  const resume = useStore(useStoreHook, (s) => s.resume);
  const cancel = useStore(useStoreHook, (s) => s.cancel);

  return { progress, isConverting, isPaused, current, pause, resume, cancel };
}
