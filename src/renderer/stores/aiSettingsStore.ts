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
import type { AiSettingsSnapshot, AiSettingsState } from './types';

export type { AiSettingsSnapshot, AiSettingsState };

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
