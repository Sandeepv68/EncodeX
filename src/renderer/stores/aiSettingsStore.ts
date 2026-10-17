/**
 * @fileoverview Session-scoped cache of the AI-provider settings editor state.
 *
 * The AI-provider section lives on the Settings page, which unmounts on every
 * route change (there is no KeepAlive), so a plain `useState` editor forgets
 * the loaded view, the selected provider, and the connected status as soon as
 * the user navigates away. This store holds the last known {@link AiSettingsView}
 * plus the in-progress provider/model/base-URL selection so a remount hydrates
 * instantly from the snapshot instead of flashing the default (rules) UI.
 *
 * Behavior notes:
 *  - Session-only: nothing is written to localStorage. The main process
 *    (`userData/ai-settings.json`) stays the source of truth; this cache only
 *    survives in-app navigation, and a fresh app start re-fetches on expand.
 *  - The component writes through `patch` on every local change and may skip
 *    the `aiGetSettings` round-trip on expand when a cached view exists.
 *  - `reset()` restores the initial snapshot; the Settings test suite calls it
 *    in `beforeEach` because tests share this module state within a file.
 *  - The cache never contains the plaintext API key (only the sanitized view).
 *
 * Consumers:
 *  - AiProviderSettingsSection (hydrate on mount, patch on change, skip
 *    refetch on expand when the cache is warm, render the collapsed header
 *    status from the cached view).
 */

import { create } from 'zustand';
import type { AiSettingsView } from '../../shared/ai/settings';
import type { AIProviderId } from '../../shared/ai/types';

/**
 * The snapshot of the AI-provider editor cached for the session.
 * @interface AiSettingsSnapshot
 * @property {AiSettingsView | null} view - The last sanitized settings view,
 *   or null when nothing was ever loaded (or the bridge failed).
 * @property {AIProviderId} providerId - The provider tile currently selected
 *   in the editor (may differ from `view.providerId` before connecting).
 * @property {string} model - The in-progress model id.
 * @property {string} baseUrl - The in-progress base URL override.
 */
export interface AiSettingsSnapshot {
  view: AiSettingsView | null;
  providerId: AIProviderId;
  model: string;
  baseUrl: string;
}

/**
 * The store: the cached snapshot plus mutators.
 * @interface AiSettingsState
 * @property {AiSettingsView | null} view - See {@link AiSettingsSnapshot}.
 * @property {AIProviderId} providerId - See {@link AiSettingsSnapshot}.
 * @property {string} model - See {@link AiSettingsSnapshot}.
 * @property {string} baseUrl - See {@link AiSettingsSnapshot}.
 * @property {(partial: Partial<AiSettingsSnapshot>) => void} patch - Merges a
 *   partial snapshot into the cache (used by the section on every change).
 * @property {() => void} reset - Restores the initial snapshot (tests).
 */
export interface AiSettingsState extends AiSettingsSnapshot {
  patch: (partial: Partial<AiSettingsSnapshot>) => void;
  reset: () => void;
}

const INITIAL_SNAPSHOT: AiSettingsSnapshot = {
  view: null,
  providerId: 'rules',
  model: '',
  baseUrl: '',
};

/**
 * Zustand store holding the session cache of the AI-provider editor state.
 * @const {useAiSettingsStore}
 */
export const useAiSettingsStore = create<AiSettingsState>((set) => ({
  ...INITIAL_SNAPSHOT,
  patch: (partial) => set(partial),
  reset: () => set({ ...INITIAL_SNAPSHOT }),
}));
