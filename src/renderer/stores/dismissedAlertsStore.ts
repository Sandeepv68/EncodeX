/**
 * @fileoverview Zustand store for dismissed alert banners.
 * Remembers which inline alert banners the user dismissed so they stay hidden
 * while navigating between pages.
 *
 * State held:
 *  - dismissed: the list of dismissed alert keys
 *
 * Behavior notes:
 *  - The state is held in memory only (never persisted to localStorage), so
 *    dismissals survive page navigation but are reset when the app closes.
 *  - `isDismissed` is a pure lookup over the current `dismissed` list; `dismiss`
 *    is idempotent (re-dismissing a key is a no-op).
 *
 * Consumers:
 *  - Convert, VideoCut, and BatchQueue pages (hardware acceleration + codec
 *    compatibility alerts)
 *  - BatchEncodingPanel (batch options editable/locked alerts)
 */

import { create } from 'zustand';
import type { DismissedAlertsState } from './types';

/**
 * Alert keys used by the dismissed-alerts store. Kept in one place so pages and
 * the encoding panel agree on the identifiers.
 * @enum {string}
 */
export const DISMISSED_ALERT_KEYS = {
  HARDWARE_ACCEL: 'hardwareAccel',
  COMPAT: 'compat',
  OPTIONS_EDITABLE: 'optionsEditable',
  OPTIONS_LOCKED: 'optionsLocked',
} as const;

/**
 * Zustand store for dismissed alert banners.
 * Holds the session list of dismissed alert keys and provides the
 * `isDismissed` lookup plus the idempotent `dismiss` action. Implemented as a
 * module-level singleton so any renderer module can read or dismiss an alert.
 * @const {UseBoundStore<StoreApi<DismissedAlertsState>>} useDismissedAlertsStore
 */
export const useDismissedAlertsStore = create<DismissedAlertsState>((set, get) => ({
  dismissed: [],
  /**
   * Returns whether the alert with the given key has been dismissed this
   * session.
   * @param {string} key - The alert key to look up.
   * @returns {boolean} True when the alert was dismissed.
   */
  isDismissed: (key) => get().dismissed.includes(key),
  /**
   * Marks the alert with the given key as dismissed (idempotent).
   * @param {string} key - The alert key to dismiss.
   */
  dismiss: (key) => {
    if (get().dismissed.includes(key)) return;
    set((s) => ({ dismissed: [...s.dismissed, key] }));
  },
}));
