/**
 * @fileoverview Hook that resolves a media file's preview thumbnail lazily.
 *
 * Shared by the batch queue job card and the mux queue job card so both lists
 * behave the same way. The preview IPC is expensive (for videos it spawns
 * ffmpeg to seek and re-encode a frame), so the load is deferred until the card
 * scrolls near the viewport. Generated thumbnails are cached per input path for
 * the session (see {@link getPreviewThumbnail}) and re-seeded synchronously on
 * remount (see {@link getResolvedPreviewThumbnail}), so dragging, reordering,
 * or navigating away and back never regenerates a preview.
 */

import { useCallback, useEffect, useState } from 'react';
import { getPreviewThumbnail, getResolvedPreviewThumbnail } from '../utils/preview-cache';

/**
 * Resolves the preview thumbnail of a job input, loading it once the anchor
 * element scrolls into view (or immediately when there is no
 * `IntersectionObserver`, as in tests).
 *
 * Attach the returned `anchorRef` to the element whose visibility should gate
 * the load (the card body), and render the returned data URL when non-null.
 * Audio and other non-previewable files resolve to `null` without an IPC call.
 *
 * @param {string} input - Absolute path of the job's input file.
 * @returns {{ thumbnail: string | null; anchorRef: (node: HTMLDivElement | null) => void }}
 *   The current preview data URL (null while loading or unavailable) and the
 *   ref callback that marks the card as visible.
 */
export function useLazyThumbnail(input: string): {
  thumbnail: string | null;
  anchorRef: (node: HTMLDivElement | null) => void;
} {
  const [thumbnail, setThumbnail] = useState<string | null>(() => getResolvedPreviewThumbnail(input));
  const [inView, setInView] = useState(false);
  // The observer is created when the anchor is attached. The effect used to
  // run once on mount, so a card whose anchor was not attached yet never
  // observed anything and its thumbnail never loaded.
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    if (!anchor) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchor]);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    getPreviewThumbnail(input).then((dataUrl) => {
      if (!cancelled && dataUrl) setThumbnail(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [inView, input]);

  // The ref is filled in by the consumer, but the observer needs the element
  // itself, so the ref is mirrored into state.
  const setAnchorRef = useCallback((node: HTMLDivElement | null) => {
    setAnchor(node);
  }, []);

  return { thumbnail, anchorRef: setAnchorRef };
}
