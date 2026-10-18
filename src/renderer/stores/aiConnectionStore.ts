/**
 * @fileoverview Read-only mirror of the active AI connection, for surfaces that
 * are not the Settings editor.
 *
 * The Settings editor owns the {@link useAiSettingsStore} session cache and
 * fetches fresh settings when it expands. The Copilot page must stay inert on
 * mount (it never calls the preload bridge in render), yet it needs to show
 * which provider is connected. This store bridges the two:
 *
 *  - It hydrates itself **once at module load** from `aiGetSettings`, using the
 *    same benign-at-import pattern as `settingsStore.ts` (a synchronous bridge
 *    throw becomes a rejected promise rather than aborting the bundle).
 *  - The Settings editor patches it on every view it adopts, so a change made
 *    there is reflected on the Copilot page without a second round-trip.
 *
 * `useAiSettingsStore` deliberately does NOT hydrate at module scope: its cached
 * view is what lets the Settings editor skip the round-trip, and a hydration
 * that raced the test setup would make the editor skip a fetch it should make.
 * Keeping this concern in a separate store avoids that coupling.
 */

import { create } from 'zustand';
import type { AiActiveConnection, AiSettingsView } from '../../shared/ai/settings';
import { isAiProviderId } from '../../shared/ai/settings';
import { Logger } from '../../shared/logger';
import { bridgePromise } from '../utils/bridge-call';

/** Per-module logger for the AI connection mirror. @const {Logger} */
const log = new Logger('renderer/stores/aiConnectionStore');

/**
 * The store state: the last sanitized settings view seen by the app.
 * @interface AiConnectionState
 * @property {AiSettingsView | null} view - The last view, or null when nothing
 *   has loaded (or the bridge failed).
 * @property {(view: AiSettingsView) => void} patch - Adopts a freshly loaded or
 *   saved view.
 * @property {() => void} reset - Clears the mirror (tests).
 */
export interface AiConnectionState {
  view: AiSettingsView | null;
  patch: (view: AiSettingsView) => void;
  reset: () => void;
}

/**
 * Zustand store mirroring the AI settings view for the Copilot status.
 * @const {useAiConnectionStore}
 */
export const useAiConnectionStore = create<AiConnectionState>((set) => ({
  view: null,
  patch: (view) => set({ view }),
  reset: () => set({ view: null }),
}));

/**
 * Derives the active connection from a view, tolerating an older bridge/build
 * that only carries the selected-provider `connected`/`connectedModel` fields.
 * @param {AiSettingsView | null} view - The settings view, or null.
 * @returns {AiActiveConnection | null} The active connection, or null.
 */
export function activeConnectionOf(view: AiSettingsView | null): AiActiveConnection | null {
  if (!view) return null;
  if (view.activeConnection) return view.activeConnection;
  if (view.connected && view.connectedAt !== undefined) {
    return {
      providerId: view.providerId,
      ...(view.connectedModel !== undefined ? { model: view.connectedModel } : {}),
      at: view.connectedAt,
    };
  }
  return null;
}

// Hydrate once at module load. Guarded so a missing preload (SSR, tests without
// a bridge) leaves the mirror empty rather than throwing during evaluation.
if (typeof window !== 'undefined' && window.electronAPI?.aiGetSettings) {
  bridgePromise(() => window.electronAPI.aiGetSettings())
    .then((view) => {
      if (view && typeof view === 'object' && isAiProviderId(view.providerId)) {
        useAiConnectionStore.setState({ view });
      }
    })
    .catch((err) => log.warn('Failed to hydrate AI connection:', err));
}
