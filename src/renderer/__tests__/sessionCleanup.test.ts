import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearTransientStorage, setupSessionCleanup } from '../sessionCleanup';
import { THEME_STORAGE_KEY } from '../../shared/app-constants';
import {
  LANGUAGE_STORAGE_KEY,
  LAUNCH_AT_LOGIN_STORAGE_KEY,
  QUEUE_CONCURRENCY_STORAGE_KEY,
  VIDEO_CUT_DRAFT_STORAGE_KEY,
  WINDOW_ALWAYS_ON_TOP_STORAGE_KEY,
} from '../../shared/constants';
import { HWACCEL_STORAGE_KEY } from '../../shared/hwaccel-settings';

const PREFERENCE_KEYS = [
  THEME_STORAGE_KEY,
  LANGUAGE_STORAGE_KEY,
  WINDOW_ALWAYS_ON_TOP_STORAGE_KEY,
  HWACCEL_STORAGE_KEY,
  LAUNCH_AT_LOGIN_STORAGE_KEY,
  QUEUE_CONCURRENCY_STORAGE_KEY,
];

const seedStorage = () => {
  PREFERENCE_KEYS.forEach((key, i) => localStorage.setItem(key, `value-${i}`));
  localStorage.setItem(VIDEO_CUT_DRAFT_STORAGE_KEY, '{"input":"/in/video.mp4"}');
  localStorage.setItem('encodex-some-other-key', 'stale');
};

describe('sessionCleanup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps every persisted preference when clearing transient storage', () => {
    seedStorage();
    clearTransientStorage();
    PREFERENCE_KEYS.forEach((key, i) => expect(localStorage.getItem(key)).toBe(`value-${i}`));
  });

  it('removes the video cut draft and any other non-preference data', () => {
    seedStorage();
    clearTransientStorage();
    expect(localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('encodex-some-other-key')).toBeNull();
  });

  it('is a no-op when localStorage is empty', () => {
    clearTransientStorage();
    expect(localStorage.length).toBe(0);
  });

  it('logs a warning and leaves the data untouched when localStorage throws', () => {
    seedStorage();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage boom');
    });
    clearTransientStorage();
    expect(warnSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('clears transient data when the window unloads', () => {
    const detach = setupSessionCleanup();
    seedStorage();
    window.dispatchEvent(new Event('beforeunload'));
    expect(localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('encodex-some-other-key')).toBeNull();
    PREFERENCE_KEYS.forEach((key, i) => expect(localStorage.getItem(key)).toBe(`value-${i}`));
    detach();
  });

  it('does not clear transient data after the listener is detached', () => {
    const detach = setupSessionCleanup();
    seedStorage();
    detach();
    window.dispatchEvent(new Event('beforeunload'));
    expect(localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem('encodex-some-other-key')).not.toBeNull();
  });
});
