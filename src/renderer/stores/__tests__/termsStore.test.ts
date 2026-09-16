import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TERMS_VERSION } from '../../../shared/terms';
import { TERMS_ACCEPTED_STORAGE_KEY } from '../../../shared/constants';
import type { useTermsStore as UseTermsStoreType } from '../termsStore';

const STORAGE_KEY = TERMS_ACCEPTED_STORAGE_KEY;
const CURRENT_VERSION = TERMS_VERSION;

const rejectTermsMock = vi.mocked(window.electronAPI.rejectTerms);

type TermsStore = typeof UseTermsStoreType;

/**
 * Reloads the terms store module so its initial state re-reads the current
 * localStorage contents (the store reads the acceptance record exactly once at
 * module load).
 * @returns {Promise<TermsStore>} The freshly loaded store hook.
 */
async function freshStore(): Promise<TermsStore> {
  vi.resetModules();
  const mod = await import('../termsStore');
  return mod.useTermsStore;
}

describe('termsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('requires acceptance and opens the dialog on first run', async () => {
    const store = await freshStore();
    const s = store.getState();
    expect(s.acceptedVersion).toBeNull();
    expect(s.requiresAcceptance).toBe(true);
    expect(s.dialogOpen).toBe(true);
    expect(s.mode).toBe('accept');
  });

  it('does not require acceptance when the stored version matches', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CURRENT_VERSION, acceptedAt: '2026-09-01T00:00:00.000Z' }));
    const store = await freshStore();
    const s = store.getState();
    expect(s.acceptedVersion).toBe(CURRENT_VERSION);
    expect(s.requiresAcceptance).toBe(false);
    expect(s.dialogOpen).toBe(false);
  });

  it('requires acceptance again when the stored version is outdated', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: '2000-01-01', acceptedAt: '2026-01-01T00:00:00.000Z' }));
    const store = await freshStore();
    const s = store.getState();
    expect(s.requiresAcceptance).toBe(true);
    expect(s.dialogOpen).toBe(true);
  });

  it('treats a malformed record as not accepted', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    const store = await freshStore();
    expect(store.getState().requiresAcceptance).toBe(true);
    expect(store.getState().acceptedVersion).toBeNull();
  });

  it('accept() persists the current version and closes the dialog', async () => {
    const store = await freshStore();
    store.getState().accept();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { version: string; acceptedAt: string };
    expect(stored.version).toBe(CURRENT_VERSION);
    expect(typeof stored.acceptedAt).toBe('string');
    const s = store.getState();
    expect(s.acceptedVersion).toBe(CURRENT_VERSION);
    expect(s.requiresAcceptance).toBe(false);
    expect(s.dialogOpen).toBe(false);
  });

  it('rejectTerms() asks the main process to quit', async () => {
    const store = await freshStore();
    store.getState().rejectTerms();
    expect(rejectTermsMock).toHaveBeenCalled();
  });

  it('openViewer() opens in read-only view mode and closeDialog dismisses it', async () => {
    const store = await freshStore();
    expect(store.getState().dialogOpen).toBe(true);
    store.getState().openViewer();
    expect(store.getState().dialogOpen).toBe(true);
    expect(store.getState().mode).toBe('view');
    store.getState().closeDialog();
    expect(store.getState().dialogOpen).toBe(false);
  });
});
