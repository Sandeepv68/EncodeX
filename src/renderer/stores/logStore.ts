/**
 * @fileoverview Zustand store for application logs state.
 * Manages application log messages and filtering.
 */

import { create } from 'zustand';
import { LogEntry } from '../../shared/types';
import { LOG_MAX_ENTRIES } from '../../shared/constants';

interface LogState {
  entries: LogEntry[];
  addEntry: (entry: LogEntry) => void;
  clear: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  addEntry: (entry) =>
    set((state) => ({
      entries: [...state.entries.slice(-(LOG_MAX_ENTRIES - 1)), entry],
    })),
  clear: () => set({ entries: [] }),
}));
