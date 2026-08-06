/**
 * @fileoverview Zustand store for application logs state.
 * Holds the in-memory ring of log entries rendered by the log viewer and the
 * actions to append entries and clear the log.
 *
 * State held:
 *  - entries: chronological list of LogEntry objects
 *
 * Behavior notes:
 *  - addEntry appends a new entry while trimming the oldest one when the list
 *    reaches LOG_MAX_ENTRIES (2000), keeping memory bounded.
 *  - clear empties the list entirely.
 *
 * Consumers:
 *  - The log viewer / log panel components (renderer)
 */

import { create } from 'zustand';
import { LogEntry } from '../../shared/types';
import { LOG_MAX_ENTRIES } from '../../shared/constants';
import type { LogState } from './types';

/**
 * Zustand store for application log state.
 * Maintains a capped, chronological list of log entries and provides addEntry
 * and clear actions. Implemented as a module-level singleton so any renderer
 * module (including components and other stores) can push log lines through
 * useLogStore.getState().addEntry(...).
 * @const {UseBoundStore<StoreApi<LogState>>} useLogStore
 */
export const useLogStore = create<LogState>((set) => ({
  entries: [],
  /**
   * Appends a log entry, trimming the oldest entry when the list is at capacity
   * (LOG_MAX_ENTRIES = 2000).
   * @param {LogEntry} entry - The log entry to append.
   */
  addEntry: (entry) =>
    set((state) => ({
      entries: [...state.entries.slice(-(LOG_MAX_ENTRIES - 1)), entry],
    })),
  /**
   * Empties the log.
   */
  clear: () => set({ entries: [] }),
}));
