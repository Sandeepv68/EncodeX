/**
 * @fileoverview Desktop-integration helpers for the renderer.
 */

/**
 * Shows a native OS notification (via the HTML5 Notification API, which
 * Electron's renderer surfaces as a real system notification). Permission is
 * requested once when the browser has not yet decided; failures and
 * unavailable notification support are swallowed so they can never break the
 * UI. The OS notification complements the in-app batch-finished toast.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body text.
 * @returns {void}
 */
export function showNativeCompletionNotification(title: string, body: string): void {
  try {
    if (typeof Notification === 'undefined') return;
    const show = () => {
      try {
        new Notification(title, { body });
      } catch {
        // Notification construction failed; the in-app toast still informs.
      }
    };
    if (Notification.permission === 'granted') {
      show();
    } else if (Notification.permission === 'default' && typeof Notification.requestPermission === 'function') {
      Notification.requestPermission()
        .then((permission: string) => {
          if (permission === 'granted') show();
        })
        .catch(() => {
          // Permission request failed; fall back to the toast alone.
        });
    }
  } catch {
    // Notification support missing entirely; fall back to the toast alone.
  }
}
