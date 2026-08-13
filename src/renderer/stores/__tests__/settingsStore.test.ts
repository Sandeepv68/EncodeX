import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore, readStoredHwAccel, readStoredQueueConcurrency, readStoredWhenDone } from '../settingsStore';
import { TRANSCODER_TYPES } from '../../../shared/transcoder-constants';
import {
  HWACCEL_DEFAULTS,
  HWACCEL_MODES,
  HWACCEL_STORAGE_KEY,
  ENCODER_TYPES,
  ENCODER_TYPE_DEFAULT,
} from '../../../shared/hwaccel-settings';
import {
  QUEUE_CONCURRENCY_STORAGE_KEY,
  DEFAULT_QUEUE_CONCURRENCY,
  MAX_QUEUE_CONCURRENCY,
  LAUNCH_AT_LOGIN_STORAGE_KEY,
  WHEN_DONE_STORAGE_KEY,
  DEFAULT_WHEN_DONE_ACTION,
} from '../../../shared/constants';

describe('settingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({
      transcoder: TRANSCODER_TYPES[0],
      hardwareAcceleration: HWACCEL_DEFAULTS.ENABLED,
      hwaccelMode: HWACCEL_DEFAULTS.MODE,
      encoderType: ENCODER_TYPE_DEFAULT,
      alwaysOnTop: false,
      launchAtLogin: false,
      queueConcurrency: DEFAULT_QUEUE_CONCURRENCY,
      whenDone: { enabled: false, action: DEFAULT_WHEN_DONE_ACTION, force: false },
    });
  });

  it('defaults transcoder to the first type', () => {
    expect(useSettingsStore.getState().transcoder).toBe(TRANSCODER_TYPES[0]);
  });

  it('setTranscoder updates the value', () => {
    useSettingsStore.getState().setTranscoder('BMF');
    expect(useSettingsStore.getState().transcoder).toBe('BMF');
  });

  it('defaults hardware acceleration to enabled with automatic mode', () => {
    expect(useSettingsStore.getState().hardwareAcceleration).toBe(HWACCEL_DEFAULTS.ENABLED);
    expect(useSettingsStore.getState().hwaccelMode).toBe(HWACCEL_DEFAULTS.MODE);
    expect(useSettingsStore.getState().encoderType).toBe(ENCODER_TYPE_DEFAULT);
  });

  it('setHardwareAcceleration updates the value and persists it', () => {
    useSettingsStore.getState().setHardwareAcceleration(false);
    expect(useSettingsStore.getState().hardwareAcceleration).toBe(false);
    const stored = JSON.parse(localStorage.getItem(HWACCEL_STORAGE_KEY) as string);
    expect(stored.hardwareAcceleration).toBe(false);
  });

  it('setHwaccelMode updates the value and persists it', () => {
    useSettingsStore.getState().setHwaccelMode('encode');
    expect(useSettingsStore.getState().hwaccelMode).toBe('encode');
    const stored = JSON.parse(localStorage.getItem(HWACCEL_STORAGE_KEY) as string);
    expect(stored.hwaccelMode).toBe('encode');
  });

  it('setEncoderType updates the value and persists it', () => {
    useSettingsStore.getState().setEncoderType('hardware');
    expect(useSettingsStore.getState().encoderType).toBe('hardware');
    const stored = JSON.parse(localStorage.getItem(HWACCEL_STORAGE_KEY) as string);
    expect(stored.encoderType).toBe('hardware');
  });

  it('defaults queue concurrency to one', () => {
    expect(useSettingsStore.getState().queueConcurrency).toBe(DEFAULT_QUEUE_CONCURRENCY);
  });

  it('defaults launch-at-login to false', () => {
    expect(useSettingsStore.getState().launchAtLogin).toBe(false);
  });

  it('setLaunchAtLogin updates the value and persists it', () => {
    const spy = vi.fn();
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, setLaunchAtLogin: spy },
      writable: true,
    });
    useSettingsStore.getState().setLaunchAtLogin(true);
    expect(useSettingsStore.getState().launchAtLogin).toBe(true);
    expect(localStorage.getItem(LAUNCH_AT_LOGIN_STORAGE_KEY)).toBe('true');
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('setQueueConcurrency updates the value and persists it', () => {
    useSettingsStore.getState().setQueueConcurrency(3);
    expect(useSettingsStore.getState().queueConcurrency).toBe(3);
    expect(localStorage.getItem(QUEUE_CONCURRENCY_STORAGE_KEY)).toBe('3');
  });

  it('defaults the when-done config to disabled with the default action', () => {
    expect(useSettingsStore.getState().whenDone).toEqual({
      enabled: false,
      action: DEFAULT_WHEN_DONE_ACTION,
      force: false,
    });
  });

  it('setWhenDone updates the value, persists it, and forwards it to the main process', () => {
    const spy = vi.fn();
    Object.defineProperty(globalThis, 'electronAPI', {
      value: { ...window.electronAPI, queueSetWhenDone: spy },
      writable: true,
    });
    const config = { enabled: true, action: 'sleep' as const, force: true };
    useSettingsStore.getState().setWhenDone(config);
    expect(useSettingsStore.getState().whenDone).toEqual(config);
    expect(JSON.parse(localStorage.getItem(WHEN_DONE_STORAGE_KEY) as string)).toEqual(config);
    expect(spy).toHaveBeenCalledWith(config);
  });
});

describe('readStoredHwAccel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing is stored', () => {
    expect(readStoredHwAccel()).toEqual({ hardwareAcceleration: true, hwaccelMode: 'auto', encoderType: 'auto' });
  });

  it('reads persisted hardware acceleration settings', () => {
    localStorage.setItem(
      HWACCEL_STORAGE_KEY,
      JSON.stringify({ hardwareAcceleration: false, hwaccelMode: 'encode', encoderType: 'software' }),
    );
    expect(readStoredHwAccel()).toEqual({ hardwareAcceleration: false, hwaccelMode: 'encode', encoderType: 'software' });
  });

  it('falls back to defaults for an unknown stored mode', () => {
    localStorage.setItem(HWACCEL_STORAGE_KEY, JSON.stringify({ hardwareAcceleration: true, hwaccelMode: 'bogus', encoderType: 'bogus' }));
    const stored = readStoredHwAccel();
    expect(stored.hwaccelMode).toBe(HWACCEL_DEFAULTS.MODE);
    expect(stored.encoderType).toBe(ENCODER_TYPE_DEFAULT);
    expect(HWACCEL_MODES).toContain(stored.hwaccelMode);
    expect(ENCODER_TYPES).toContain(stored.encoderType);
  });

  it('falls back to defaults for corrupted storage', () => {
    localStorage.setItem(HWACCEL_STORAGE_KEY, '{ not json');
    expect(readStoredHwAccel()).toEqual({ hardwareAcceleration: true, hwaccelMode: 'auto', encoderType: 'auto' });
  });
});

describe('readStoredQueueConcurrency', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the default when nothing is stored', () => {
    expect(readStoredQueueConcurrency()).toBe(DEFAULT_QUEUE_CONCURRENCY);
  });

  it('reads a persisted concurrency value', () => {
    localStorage.setItem(QUEUE_CONCURRENCY_STORAGE_KEY, '3');
    expect(readStoredQueueConcurrency()).toBe(3);
  });

  it('clamps an out-of-range stored value to the maximum', () => {
    localStorage.setItem(QUEUE_CONCURRENCY_STORAGE_KEY, String(MAX_QUEUE_CONCURRENCY + 10));
    expect(readStoredQueueConcurrency()).toBe(MAX_QUEUE_CONCURRENCY);
  });

  it('clamps a stored value below one to the minimum', () => {
    localStorage.setItem(QUEUE_CONCURRENCY_STORAGE_KEY, '0');
    expect(readStoredQueueConcurrency()).toBe(DEFAULT_QUEUE_CONCURRENCY);
  });

  it('falls back to the default for a non-numeric value', () => {
    localStorage.setItem(QUEUE_CONCURRENCY_STORAGE_KEY, 'abc');
    expect(readStoredQueueConcurrency()).toBe(DEFAULT_QUEUE_CONCURRENCY);
  });
});

describe('readStoredWhenDone', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the defaults when nothing is stored', () => {
    expect(readStoredWhenDone()).toEqual({ enabled: false, action: DEFAULT_WHEN_DONE_ACTION, force: false });
  });

  it('reads a persisted when-done config', () => {
    localStorage.setItem(WHEN_DONE_STORAGE_KEY, JSON.stringify({ enabled: true, action: 'hibernate', force: true }));
    expect(readStoredWhenDone()).toEqual({ enabled: true, action: 'hibernate', force: true });
  });

  it('falls back to the default action for an unknown action', () => {
    localStorage.setItem(WHEN_DONE_STORAGE_KEY, JSON.stringify({ enabled: true, action: 'bogus', force: false }));
    const stored = readStoredWhenDone();
    expect(stored.enabled).toBe(true);
    expect(stored.action).toBe(DEFAULT_WHEN_DONE_ACTION);
  });

  it('falls back to defaults for corrupted storage', () => {
    localStorage.setItem(WHEN_DONE_STORAGE_KEY, '{ not json');
    expect(readStoredWhenDone()).toEqual({ enabled: false, action: DEFAULT_WHEN_DONE_ACTION, force: false });
  });
});
