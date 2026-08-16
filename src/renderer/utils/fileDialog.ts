/**
 * @fileoverview Shared native file-dialog helper.
 *
 * Wraps `window.electronAPI.selectFile` so pages that trigger the file picker
 * from a keyboard shortcut reuse the exact same accept-filter construction as
 * the drag-and-drop zones (`FileDropZone`): an optional comma-separated accept
 * string is split and trimmed into the extension filter array expected by the
 * preload API. Returns the chosen absolute path or null when the dialog is
 * cancelled.
 *
 * @example
 * const file = await openFileDialog(IMAGE_DROPZONE_ACCEPT);
 * if (file) handleFileSelect(file);
 */

/**
 * Opens the native file dialog, optionally filtered to the given extensions.
 * @param {string} [accept] - Comma-separated extension list (e.g.
 *   'mp4,mkv,mov'); undefined opens the dialog with no filter.
 * @returns {Promise<string | null>} The chosen absolute path, or null when the
 *   dialog is cancelled or the preload API is unavailable.
 */
export async function openFileDialog(accept?: string): Promise<string | null> {
  const extList = accept ? [{ name: 'Files', extensions: accept.split(',').map((s) => s.trim()) }] : undefined;
  return window.electronAPI?.selectFile(extList) ?? null;
}
