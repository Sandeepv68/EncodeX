/**
 * @fileoverview Development-only UI screenshot capture.
 *
 * Mounts a single global `keydown` listener that captures the current window
 * contents whenever the developer presses `Ctrl+Alt+S` (Cmd+Alt+S on macOS).
 * The capture is performed by the main process via
 * `electronAPI.captureDevScreenshot()` and written to
 * `<project root>/screenshots/dev/encodex-dev-<timestamp>.png`; a toast shows
 * the saved path on success or the failure reason on error.
 *
 * Everything here is inert unless Vite's `import.meta.env.DEV` is true, i.e.
 * only while running against the dev server (`npm run dev` /
 * `npm run electron:dev`). Production builds never attach the listener.
 */

import { useEffect } from 'react';
import { parseShortcut, shortcutMatches } from '../constants/shortcuts';
import { useToastStore } from '../stores/toastStore';

/** Canonical chord that triggers a dev screenshot ('Ctrl' = Cmd on macOS). */
const DEV_SCREENSHOT_CHORD = 'Ctrl+Alt+S';

/**
 * True when the module runs inside a Vite development build/dev server.
 * @type {boolean}
 */
const IS_DEV: boolean = import.meta.env.DEV;

/**
 * Registers the dev-screenshot hotkey for the lifetime of the component.
 *
 * A no-op outside of development builds. The chord is parsed once; every
 * window keydown is matched exactly (modifiers included) so the capture never
 * fires while unrelated modifier combos are held. Bare-key shortcuts are not
 * consulted because this chord always carries modifiers, so it also works
 * while an input has focus.
 *
 * @returns {void} Nothing is returned.
 */
export function useDevScreenshot(): void {
  useEffect(() => {
    if (!IS_DEV) return undefined;

    const parsed = parseShortcut(DEV_SCREENSHOT_CHORD);

    /**
     * Matches keydown events against the dev screenshot chord and triggers the
     * IPC capture + toast feedback.
     * @param {KeyboardEvent} event - The window keydown event.
     * @returns {void} Nothing is returned.
     */
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || !shortcutMatches(parsed, event)) {
        return;
      }
      event.preventDefault();
      void captureNow();
    };

    /**
     * Invokes the main-process capture and surfaces the outcome as a toast.
     * @returns {Promise<void>} Resolves when the toast has been enqueued.
     */
    async function captureNow(): Promise<void> {
      try {
        if (!window.electronAPI?.captureDevScreenshot) {
          throw new Error('captureDevScreenshot API unavailable');
        }
        const savedPath = await window.electronAPI.captureDevScreenshot();
        useToastStore.getState().success('Dev screenshot saved', savedPath);
      } catch (err) {
        useToastStore.getState().error('Dev screenshot failed', err instanceof Error ? err.message : String(err));
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
