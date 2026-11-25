import { useEffect, useState } from 'react';

const E2E_FLAGS: Record<string, boolean | string | number> = window.__ENCODEX_E2E__ === true ? { automations_page: true } : {};

const DEFAULT_FLAGS: Record<string, boolean | string | number> = {
  automations_page: import.meta.env.DEV || window.__ENCODEX_E2E__ === true,
};

const PRODUCTION_FLAGS: Record<string, boolean | string | number> =
  import.meta.env.PROD && window.__ENCODEX_E2E__ !== true ? { automations_page: false } : {};

let cachedFlags: Record<string, boolean | string | number> | null = null;
let inflight: Promise<Record<string, boolean | string | number>> | null = null;

async function loadFeatureFlags(): Promise<Record<string, boolean | string | number>> {
  if (cachedFlags) return cachedFlags;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const state = await window.electronAPI?.analyticsGetState?.();
      cachedFlags = { ...DEFAULT_FLAGS, ...(state?.featureFlags ?? {}), ...PRODUCTION_FLAGS, ...E2E_FLAGS };
    } catch {
      cachedFlags = { ...DEFAULT_FLAGS, ...PRODUCTION_FLAGS, ...E2E_FLAGS };
    } finally {
      inflight = null;
    }
    return cachedFlags;
  })();
  return inflight;
}

export function useFeatureFlags(): Record<string, boolean | string | number> {
  const [flags, setFlags] = useState<Record<string, boolean | string | number>>(cachedFlags ?? DEFAULT_FLAGS);

  useEffect(() => {
    let mounted = true;
    void loadFeatureFlags().then((next) => {
      if (mounted) setFlags(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return flags;
}

export function useFeatureFlag(name: string, fallback = false): boolean {
  const flags = useFeatureFlags();
  const value = flags[name];
  return typeof value === 'boolean' ? value : fallback;
}

export function resetFeatureFlagsForTests(): void {
  cachedFlags = null;
  inflight = null;
}
