/**
 * @fileoverview Renderer session cleanup.
 *
 * Ensures no transient saved data (e.g. the video cut draft) survives a
 * complete app close while the user's preferences are kept.
 *
 * On window unload, {@link clearTransientStorage} removes every localStorage
 * entry except the persisted preference keys (theme, language, always-on-top,
 * hardware acceleration). {@link setupSessionCleanup} wires that cleanup to the
 * window's `beforeunload` event; main.tsx calls it once at startup. Because the
 * renderer's `beforeunload` fires whenever the BrowserWindow closes (window
 * close button, `app.quit()`, Cmd+Q on macOS), drafts are wiped exactly when
 * the app is being closed and never leak into the next launch.
 */

import { Logger } from '../shared/logger';
import { THEME_STORAGE_KEY } from '../shared/app-constants';
import { LANGUAGE_STORAGE_KEY, WINDOW_ALWAYS_ON_TOP_STORAGE_KEY } from '../shared/constants';
import { HWACCEL_STORAGE_KEY } from '../shared/hwaccel-settings';
import { LOG_FAILED_TO_CLEAR_TRANSIENT_STORAGE } from '../shared/log-constants';

/** Logger instance used by this module. @const {Logger} */
const log = new Logger('renderer/sessionCleanup');

/**
 * localStorage keys that are user preferences and therefore survive an app
 * close. Every other key is considered transient and is removed on unload.
 * @const {ReadonlySet<string>} PREFERENCE_STORAGE_KEYS
 */
const PREFERENCE_STORAGE_KEYS: ReadonlySet<string> = new Set([
  THEME_STORAGE_KEY,
  LANGUAGE_STORAGE_KEY,
  WINDOW_ALWAYS_ON_TOP_STORAGE_KEY,
  HWACCEL_STORAGE_KEY,
]);

/**
 * Removes every localStorage entry that is not a persisted preference (theme,
 * language, always-on-top, hardware acceleration). Drafts and any other
 * non-preference data written during the session are dropped, so the next app
 * launch starts from a clean slate. Storage failures are logged and swallowed
 * so a broken storage backend can never prevent the window from closing.
 * @returns {void}
 */
export function clearTransientStorage(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!PREFERENCE_STORAGE_KEYS.has(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    log.warn(LOG_FAILED_TO_CLEAR_TRANSIENT_STORAGE, err);
  }
}

/**
 * Registers {@link clearTransientStorage} on the window's `beforeunload` event
 * so transient data is wiped whenever the app is completely closed.
 * @returns {() => void} A function that removes the listener.
 */
export function setupSessionCleanup(): () => void {
  const onBeforeUnload = () => {
    clearTransientStorage();
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  return () => {
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}
