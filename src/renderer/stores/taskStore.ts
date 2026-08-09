/**
 * @fileoverview Zustand store for global media-task activity.
 *
 * Holds a single `isConverting` flag that mirrors the running state of any
 * media task driven by `useMediaTask` (e.g. image compression, video cutting).
 * Pages that use `useMediaTask` keep their converting state in local component
 * state, which is invisible to the rest of the app; this store exposes that
 * state globally so cross-cutting features (such as the close-confirmation
 * dialog) can detect in-progress jobs without being mounted inside the page.
 *
 * Consumers:
 *  - `useMediaTask` sets/clears the flag around every `runTask` invocation.
 *  - The close-confirmation dialog reads it via `getState()` when the window
 *    close is requested.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { LOG_MEDIA_TASK_STARTED, LOG_MEDIA_TASK_FINISHED } from '../../shared/log-constants';

/**
 * Per-store logger for the media-task store.
 * @const {Logger} log
 */
const log = new Logger('renderer/stores/taskStore');

/**
 * Zustand store for global media-task activity.
 * Holds the single `isConverting` flag and its setter. Implemented as a
 * module-level singleton so hooks and components can read and mutate the flag
 * outside of React.
 * @const {UseBoundStore<StoreApi<MediaTaskState>>} useTaskStore
 */
export const useTaskStore = create<{
  /** Whether any `useMediaTask`-driven task is currently running. @type {boolean} */
  isConverting: boolean;
  /** Sets whether a media task is running. @param {boolean} v - The new running state. */
  setIsConverting: (v: boolean) => void;
}>((set) => ({
  isConverting: false,
  setIsConverting: (v) => {
    if (v) {
      log.debug(LOG_MEDIA_TASK_STARTED);
    } else {
      log.debug(LOG_MEDIA_TASK_FINISHED);
    }
    set({ isConverting: v });
  },
}));
