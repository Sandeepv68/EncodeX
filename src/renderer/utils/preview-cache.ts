/**
 * @fileoverview Session-scoped cache for media preview thumbnails.
 *
 * The batch queue renders one card per job, and previews are expensive: the
 * video preview IPC spawns ffmpeg to seek and re-encode a frame. Without
 * caching, that work is repeated every time a card remounts — dragging a card
 * (which mounts a drag-overlay clone), reordering, or navigating away and back
 * all re-generate thumbnails that were already produced.
 *
 * This module keeps a per-input-path Map so each unique file yields exactly one
 * preview IPC call per renderer session, no matter how often the UI remounts:
 *  - while a request is still in flight, concurrent callers (e.g. the live
 *    card and its drag-overlay clone) share the same promise;
 *  - once settled, the resolved data URL (or `null` for files with no usable
 *    preview) is stored so later lookups — including {@link
 *    getResolvedPreviewThumbnail} used to seed a remounted card's initial
 *    render — return the value synchronously without touching the IPC again.
 *
 * Durability across renderer reloads and app restarts is provided by the main
 * process: the preview IPC handlers back this cache with a disk-persisted
 * PreviewCache (src/main/preview-cache.ts) under `userData/previews`, so even
 * after this module's state is wiped the same data URL is served without
 * re-running ffmpeg.
 *
 * The cache is intentionally unbounded and never invalidated: the queue input
 * paths are stable and the explicit requirement is that a generated thumbnail
 * must never be regenerated within a session.
 *
 * `clearPreviewCache()` exists so tests can reset the module state between
 * cases.
 */

import { isImageFile, isVideoFile } from '../../shared/file-extensions';

/**
 * Resolved preview data URLs keyed by input path. A `null` value means the
 * file was already looked up and has no usable preview (so it is not
 * re-attempted).
 * @type {Map<string, string | null>}
 */
const resolved = new Map<string, string | null>();

/**
 * In-flight lookups keyed by input path, deduplicating concurrent callers so a
 * burst of requests for the same file performs a single IPC call.
 * @type {Map<string, Promise<string | null>>}
 */
const inflight = new Map<string, Promise<string | null>>();

/**
 * Returns a previously generated preview data URL synchronously, or `null`
 * when the file has not been previewed yet (or has no usable preview). Used to
 * seed a remounted card's initial render so a thumbnail that was already
 * generated shows instantly — no async gap on navigation, drag overlays, or
 * reordering.
 * @param {string} input - Absolute path of the job's input file.
 * @returns {string | null} The base64 data URL, or null.
 */
export function getResolvedPreviewThumbnail(input: string): string | null {
  return resolved.has(input) ? (resolved.get(input) as string | null) : null;
}

/**
 * Returns the preview data URL for an input file, dispatching to the image or
 * video preview IPC as appropriate (audio and other files have no preview and
 * resolve to `null` without an IPC call).
 *
 * Lookups are cached and deduplicated by input path: the first call for a path
 * performs the IPC (or resolves `null` for non-previewable files); every later
 * call — remounts, drag-overlay clones, navigation — resolves from the cache.
 * IPC rejections are normalized to `null` and cached, so a file that cannot be
 * previewed is not re-attempted on every remount.
 *
 * @param {string} input - Absolute path of the job's input file.
 * @returns {Promise<string | null>} The base64 data URL, or `null`.
 */
export function getPreviewThumbnail(input: string): Promise<string | null> {
  if (resolved.has(input)) return Promise.resolve(resolved.get(input) as string | null);
  const existing = inflight.get(input);
  if (existing) return existing;
  const loader = isImageFile(input)
    ? window.electronAPI.getImagePreview(input)
    : isVideoFile(input)
      ? window.electronAPI.getVideoPreview(input)
      : Promise.resolve<string | null>(null);
  const pending = loader
    .catch(() => null)
    .then((value) => {
      resolved.set(input, value);
      inflight.delete(input);
      return value;
    });
  inflight.set(input, pending);
  return pending;
}

/**
 * Removes all cached previews. Intended for tests (module state would otherwise
 * leak between cases that reuse the same input paths).
 * @returns {void}
 */
export function clearPreviewCache(): void {
  resolved.clear();
  inflight.clear();
}
