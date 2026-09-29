/**
 * @fileoverview Hook that resolves a media file's preview thumbnail data URL.
 *
 * Wraps the preview cache so pages can bind a thumbnail to a file path
 * declaratively: an already-generated preview (this session or an earlier one,
 * persisted to disk by the main process) is served synchronously, and a cache
 * miss is filled in by the asynchronous extraction IPC.
 */

import { useEffect, useState } from 'react';
import { getPreviewThumbnail, getResolvedPreviewThumbnail } from '../utils/preview-cache';

/**
 * React hook resolving the preview thumbnail data URL for a media path.
 *
 * Re-resolves whenever `path` changes, clears to null for a falsy path, and
 * ignores a late IPC result for a path that is no longer current.
 *
 * @param {string} [path] - Absolute path of the file to preview, or undefined.
 * @returns {string | null} The preview data URL, or null while unavailable.
 */
export function usePreviewThumbnail(path?: string): string | null {
  const [src, setSrc] = useState<string | null>(() => (path ? getResolvedPreviewThumbnail(path) : null));

  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    setSrc(getResolvedPreviewThumbnail(path));
    getPreviewThumbnail(path).then((dataUrl) => {
      if (!cancelled) setSrc(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return src;
}
