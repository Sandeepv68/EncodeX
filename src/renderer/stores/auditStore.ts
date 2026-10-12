/**
 * @fileoverview Zustand store for the mutating-operation audit trail.
 *
 * Holds the in-memory ring of {@link AuditEntry} records the embedded MCP server
 * emits for every committed (or headlessly executed) mutating operation. The
 * record is surfaced in the Logs page so a user can see exactly what an agent
 * ran, under which safety tier, and whether it succeeded.
 *
 * State held:
 *  - entries: chronological list of AuditEntry objects
 *
 * Behavior notes:
 *  - addEntry appends a new record while trimming the oldest when the list
 *    reaches LOG_MAX_ENTRIES (2000), keeping memory bounded.
 *  - clear empties the list entirely.
 */

import { create } from 'zustand';
import { LOG_MAX_ENTRIES } from '../../shared/constants';
import type { AuditState } from './types';

/**
 * Zustand store for the audit trail.
 * Maintains a capped, chronological list of audit records and provides addEntry
 * and clear actions. A module-level singleton so the preload subscription in
 * App.tsx can push records via useAuditStore.getState().addEntry(...).
 * @const {UseBoundStore<StoreApi<AuditState>>} useAuditStore
 */
export const useAuditStore = create<AuditState>((set) => ({
  entries: [],
  /**
   * Appends an audit record, trimming the oldest entry when at capacity.
   * @param {AuditEntry} entry - The audit record to append.
   */
  addEntry: (entry) =>
    set((state) => ({
      entries: [...state.entries.slice(-(LOG_MAX_ENTRIES - 1)), entry],
    })),
  /**
   * Empties the audit trail.
   */
  clear: () => set({ entries: [] }),
}));
