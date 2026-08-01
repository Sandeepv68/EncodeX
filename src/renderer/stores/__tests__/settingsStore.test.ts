import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, readStoredHwAccel } from '../settingsStore';
import { TRANSCODER_TYPES } from '../../../shared/transcoder-constants';
import {
  HWACCEL_DEFAULTS,
  HWACCEL_MODES,
  HWACCEL_STORAGE_KEY,
  ENCODER_TYPES,
  ENCODER_TYPE_DEFAULT,
} from '../../../shared/hwaccel-settings';

describe('settingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({
      transcoder: TRANSCODER_TYPES[0],
      hardwareAcceleration: HWACCEL_DEFAULTS.ENABLED,
      hwaccelMode: HWACCEL_DEFAULTS.MODE,
      encoderType: ENCODER_TYPE_DEFAULT,
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
