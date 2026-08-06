/**
 * @fileoverview Hook for querying the FFmpeg encoder and hardware acceleration
 * capabilities detected by the main process.
 *
 * Capabilities are requested once through the preload bridge via
 * `window.electronAPI.getCapabilities()` and cached at module scope, so every
 * consumer shares a single IPC round-trip per session. The cached result filters
 * the full VIDEO_CODECS / AUDIO_CODECS option lists down to the encoders actually
 * available on the system, falling back to the complete lists when probing
 * failed or reported no matching encoders.
 */

import { useEffect, useState } from 'react';
import { AUDIO_CODECS, VIDEO_CODECS } from '../../shared/media-options';
import type { EncoderCapabilities } from '../../shared/types';
import type { CodecOption } from './types';

/**
 * Module-scoped cache of the last capability probe result.
 * `undefined` means "not yet probed", `null` means the probe failed or reported
 * no capabilities, and a value object means probing succeeded.
 * @type {EncoderCapabilities | null | undefined}
 */
let cached: EncoderCapabilities | null | undefined;

/**
 * In-flight (or already settled) capability probe promise.
 * Reusing this promise guarantees that exactly one IPC request is issued even
 * when multiple components mount at the same time. It is cleared to null by
 * resetCapabilitiesCache() so the next mount probes again.
 * @type {Promise<EncoderCapabilities | null> | null}
 */
let loadPromise: Promise<EncoderCapabilities | null> | null = null;

/**
 * Loads encoder capabilities from the main process exactly once per session.
 * Returns the already-started promise when a probe is in flight or has settled.
 * On failure the cache is set to null (i.e. no capabilities) and the rejection
 * is swallowed, so callers always receive null instead of an unhandled error.
 * @returns {Promise<EncoderCapabilities | null>} The probed capabilities, or
 *   null if the probe failed.
 */
function loadCapabilities(): Promise<EncoderCapabilities | null> {
  if (!loadPromise) {
    loadPromise = window.electronAPI
      .getCapabilities()
      .then((caps) => {
        cached = caps;
        return caps;
      })
      .catch(() => {
        cached = null;
        return null;
      });
  }
  return loadPromise;
}

/**
 * Invalidates the module-level capabilities cache.
 * Resets both the cached result and the in-flight probe promise so the next
 * useCapabilities() mount re-queries the main process. Useful after capabilities
 * change (e.g. FFmpeg reinstallation) or for tests.
 * @returns {void}
 */
export function resetCapabilitiesCache(): void {
  cached = undefined;
  loadPromise = null;
}

/**
 * Filters a full codec option list down to the encoders the system provides.
 * A missing, empty, or non-matching `available` list results in the full list
 * being returned, so the user is never left without selectable choices.
 * @param {readonly CodecOption[]} all - The complete, unfiltered codec list.
 * @param {string[]} [available] - Encoder names reported as available by probing.
 * @returns {CodecOption[]} A filtered copy of `all`, or a copy of `all` unchanged
 *   when nothing matches.
 */
function filterCodecs(all: readonly CodecOption[], available: string[] | undefined): CodecOption[] {
  if (!available || available.length === 0) return [...all];
  const set = new Set(available);
  const filtered = all.filter((c) => set.has(c.value));
  return filtered.length > 0 ? filtered : [...all];
}

/**
 * React hook exposing the system's detected video and audio encoder capabilities.
 *
 * State managed:
 *  - `capabilities`: the probe result, initialised from the module cache so a
 *    previously-fetched value is available synchronously on the first render.
 *
 * Side effects / dependencies:
 *  - On mount (empty dependency array) it starts a capability probe through
 *    `window.electronAPI.getCapabilities()` when the cache has not been
 *    populated yet. The state is only updated while the component is still
 *    mounted; the cleanup function flips a flag that discards late probe results.
 *  - The returned codec lists are recomputed on every render by filtering the
 *    shared VIDEO_CODECS / AUDIO_CODECS constants against the probed encoder
 *    names (see filterCodecs()).
 *
 * @returns {Object} An object with the probed capabilities and the filtered
 *   codec option lists:
 * @property {CodecOption[]} videoCodecs - Video encoders available on the system
 *   (the full VIDEO_CODECS list when probing is unavailable or unmatched).
 * @property {CodecOption[]} audioCodecs - Audio encoders available on the system
 *   (the full AUDIO_CODECS list when probing is unavailable or unmatched).
 * @property {EncoderCapabilities | null} capabilities - The probed capabilities,
 *   or null while probing has not produced a result.
 */
export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<EncoderCapabilities | null | undefined>(cached);

  useEffect(() => {
    if (cached !== undefined) return;
    let mounted = true;
    loadCapabilities().then((caps) => {
      if (mounted) setCapabilities(caps);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const videoCodecs = filterCodecs(VIDEO_CODECS, capabilities?.videoEncoders);
  const audioCodecs = filterCodecs(AUDIO_CODECS, capabilities?.audioEncoders);

  return { videoCodecs, audioCodecs, capabilities: capabilities ?? null };
}
