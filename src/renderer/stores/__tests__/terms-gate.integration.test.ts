/**
 * @fileoverview Integration tests for the Terms & Conditions consent contract
 * between {@link useTermsStore} (renderer/stores/termsStore) and the session
 * cleanup logic (renderer/sessionCleanup).
 *
 * These two modules agree on one critical invariant: the accepted-terms record
 * stored under `encodex-terms-accepted` is a **preference** and MUST survive an
 * app close (clearTransientStorage), otherwise the blocking gate would reappear
 * on every launch. This suite verifies the full lifecycle - first run, accept,
 * persistence shape, session cleanup, reload-equivalent re-init, version bumps,
 * malformed records, and the reject-to-quit request.
 *
 * It runs in-process under both environments:
 *  - `npm test` (jsdom) via the default vitest include pattern, and
 *  - `npm run test:integration` (node) via the `*.integration.test.ts` pattern;
 * in node the global window/localStorage are installed as in-memory stubs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TERMS_ACCEPTED_STORAGE_KEY } from '../../../shared/constants';
import { TERMS_VERSION } from '../../../shared/terms';

const STORAGE_KEY = TERMS_ACCEPTED_STORAGE_KEY;

/**
 * Ensures the globals the modules touch exist. In jsdom (unit run) both
 * `window` and `localStorage` are provided by the environment and the
 * electronAPI stub comes from src/test-setup.ts; in node (integration run) an
 * in-memory localStorage and a minimal window+electronAPI are installed. The
 * node localStorage stores entries as own enumerable properties so
 * `Object.keys(localStorage)` inside clearTransientStorage() sees them.
 * @returns {{ rejectTerms: ReturnType<typeof vi.fn> }} The rejectTerms spy.
 */
function installEnvironment(): { rejectTerms: ReturnType<typeof vi.fn> } {
  if (typeof (globalThis as Record<string, unknown>).window === 'undefined') {
    (globalThis as { window: unknown }).window = {};
  }
  if (typeof (globalThis as Record<string, unknown>).localStorage === 'undefined') {
    const mem = Object.create(null) as Record<string, string>;
    Object.defineProperties(mem, {
      getItem: { value: (k: string) => (k in mem ? mem[k] : null) },
      setItem: {
        value: (k: string, v: string) => {
          mem[k] = String(v);
        },
      },
      removeItem: {
        value: (k: string) => {
          delete mem[k];
        },
      },
      clear: {
        value: () => {
          for (const k of Object.keys(mem)) delete mem[k];
        },
      },
      length: { get: () => Object.keys(mem).length },
    });
    Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true, writable: true });
  }

  const api = (window as { electronAPI?: { rejectTerms?: unknown } }).electronAPI;
  if (typeof api?.rejectTerms !== 'function') {
    (window as { electronAPI: { rejectTerms: ReturnType<typeof vi.fn> } }).electronAPI = { rejectTerms: vi.fn() };
  }
  return { rejectTerms: (window as unknown as { electronAPI: { rejectTerms: ReturnType<typeof vi.fn> } }).electronAPI.rejectTerms };
}

/** Re-imports the store so its module-scope `acceptedRecord` is re-read. */
async function loadStore(): Promise<typeof import('../termsStore')> {
  vi.resetModules();
  return import('../termsStore');
}

/** Re-imports sessionCleanup so its preference-key set is evaluated fresh. */
async function loadSessionCleanup(): Promise<typeof import('../../sessionCleanup')> {
  vi.resetModules();
  return import('../../sessionCleanup');
}

describe('Terms gate consent contract (store x session cleanup)', () => {
  beforeEach(() => {
    installEnvironment();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('opens the blocking gate when no consent is stored', async () => {
    installEnvironment();
    const { useTermsStore } = await loadStore();
    const state = useTermsStore.getState();
    expect(state.acceptedVersion).toBeNull();
    expect(state.requiresAcceptance).toBe(true);
    expect(state.dialogOpen).toBe(true);
    expect(state.mode).toBe('accept');
  });

  it('accept() persists the exact record shape used across launches', async () => {
    installEnvironment();
    const { useTermsStore } = await loadStore();
    useTermsStore.getState().accept();

    const staleTxKey = 'encodex-video-cut-draft';
    localStorage.setItem(staleTxKey, '{"input":"/in/video.mp4"}');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { version: string; acceptedAt: string };
    expect(stored.version).toBe(TERMS_VERSION);
    expect(typeof stored.acceptedAt).toBe('string');
    expect(useTermsStore.getState().dialogOpen).toBe(false);
    expect(useTermsStore.getState().acceptedVersion).toBe(TERMS_VERSION);

    const { clearTransientStorage } = await loadSessionCleanup();
    clearTransientStorage();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(staleTxKey)).toBeNull();
  });

  it('does not re-prompt after acceptance on a fresh module load (next launch)', async () => {
    installEnvironment();
    const first = await loadStore();
    first.useTermsStore.getState().accept();

    const second = await loadStore();
    expect(second.useTermsStore.getState().requiresAcceptance).toBe(false);
    expect(second.useTermsStore.getState().dialogOpen).toBe(false);
  });

  it('re-prompts when the stored version differs from TERMS_VERSION', async () => {
    installEnvironment();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: '2026-01-01', acceptedAt: new Date().toISOString() }));
    const { useTermsStore } = await loadStore();
    const state = useTermsStore.getState();
    expect(state.acceptedVersion).toBe('2026-01-01');
    expect(state.requiresAcceptance).toBe(true);
    expect(state.dialogOpen).toBe(true);
  });

  it('treats a malformed record as no consent and overwrites it on accept', async () => {
    installEnvironment();
    localStorage.setItem(STORAGE_KEY, '{not-json');
    const { useTermsStore } = await loadStore();
    expect(useTermsStore.getState().dialogOpen).toBe(true);

    useTermsStore.getState().accept();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { version: string };
    expect(stored.version).toBe(TERMS_VERSION);
  });

  it('sends the terms-reject quit request through the preload bridge', async () => {
    const { rejectTerms } = installEnvironment();
    const { useTermsStore } = await loadStore();
    useTermsStore.getState().rejectTerms();
    expect(rejectTerms).toHaveBeenCalledTimes(1);
    expect(useTermsStore.getState().dialogOpen).toBe(true);
  });

  it('opens and closes the read-only viewer without mutating consent', async () => {
    installEnvironment();
    const { useTermsStore } = await loadStore();
    useTermsStore.getState().openViewer();
    expect(useTermsStore.getState().mode).toBe('view');
    expect(useTermsStore.getState().dialogOpen).toBe(true);

    useTermsStore.getState().closeDialog();
    expect(useTermsStore.getState().dialogOpen).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
