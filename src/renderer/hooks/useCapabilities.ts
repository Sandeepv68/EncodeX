import { useEffect, useState } from 'react';
import { AUDIO_CODECS, VIDEO_CODECS } from '../../shared/media-options';
import type { EncoderCapabilities } from '../../shared/types';
import type { CodecOption } from './types';

let cached: EncoderCapabilities | null | undefined;
let loadPromise: Promise<EncoderCapabilities | null> | null = null;

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

export function resetCapabilitiesCache(): void {
  cached = undefined;
  loadPromise = null;
}

function filterCodecs(all: readonly CodecOption[], available: string[] | undefined): CodecOption[] {
  if (!available || available.length === 0) return [...all];
  const set = new Set(available);
  const filtered = all.filter((c) => set.has(c.value));
  return filtered.length > 0 ? filtered : [...all];
}

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
