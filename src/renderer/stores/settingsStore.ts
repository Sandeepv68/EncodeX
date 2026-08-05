/**
 * @fileoverview Zustand store for user application settings.
 * Manages user preferences, theme, hardware acceleration, and other settings.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { HWACCEL_DEFAULTS, HWACCEL_MODES, HWACCEL_STORAGE_KEY, ENCODER_TYPES, ENCODER_TYPE_DEFAULT } from '../../shared/hwaccel-settings';
import type { HwAccelMode, EncoderType } from '../../shared/hwaccel-settings';
import { WINDOW_ALWAYS_ON_TOP_STORAGE_KEY } from '../../shared/constants';

const log = new Logger('renderer/stores/settingsStore');

interface HwAccelStored {
  hardwareAcceleration: boolean;
  hwaccelMode: HwAccelMode;
  encoderType: EncoderType;
}

export function readStoredHwAccel(): HwAccelStored {
  try {
    const raw = localStorage.getItem(HWACCEL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HwAccelStored>;
      return {
        hardwareAcceleration: typeof parsed.hardwareAcceleration === 'boolean' ? parsed.hardwareAcceleration : HWACCEL_DEFAULTS.ENABLED,
        hwaccelMode: parsed.hwaccelMode && HWACCEL_MODES.includes(parsed.hwaccelMode) ? parsed.hwaccelMode : HWACCEL_DEFAULTS.MODE,
        encoderType: parsed.encoderType && ENCODER_TYPES.includes(parsed.encoderType) ? parsed.encoderType : ENCODER_TYPE_DEFAULT,
      };
    }
  } catch (err) {
    log.warn('Failed to read stored hardware acceleration settings:', err);
  }
  return { hardwareAcceleration: HWACCEL_DEFAULTS.ENABLED, hwaccelMode: HWACCEL_DEFAULTS.MODE, encoderType: ENCODER_TYPE_DEFAULT };
}

function persistHwAccel(hardwareAcceleration: boolean, hwaccelMode: HwAccelMode, encoderType: EncoderType): void {
  try {
    localStorage.setItem(HWACCEL_STORAGE_KEY, JSON.stringify({ hardwareAcceleration, hwaccelMode, encoderType }));
  } catch (err) {
    log.warn('Failed to persist hardware acceleration settings:', err);
  }
}

const stored = readStoredHwAccel();

function readStoredAlwaysOnTop(): boolean {
  try {
    return localStorage.getItem(WINDOW_ALWAYS_ON_TOP_STORAGE_KEY) === 'true';
  } catch (err) {
    log.warn('Failed to read stored always-on-top setting:', err);
    return false;
  }
}

function persistAlwaysOnTop(flag: boolean): void {
  try {
    localStorage.setItem(WINDOW_ALWAYS_ON_TOP_STORAGE_KEY, String(flag));
  } catch (err) {
    log.warn('Failed to persist always-on-top setting:', err);
  }
}

interface SettingsState {
  transcoder: string;
  setTranscoder: (t: string) => void;
  hardwareAcceleration: boolean;
  hwaccelMode: HwAccelMode;
  encoderType: EncoderType;
  setHardwareAcceleration: (enabled: boolean) => void;
  setHwaccelMode: (mode: HwAccelMode) => void;
  setEncoderType: (type: EncoderType) => void;
  alwaysOnTop: boolean;
  setAlwaysOnTop: (flag: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  transcoder: TRANSCODER_TYPES[0],
  setTranscoder: (t) => {
    log.debug('setTranscoder:', t);
    set({ transcoder: t });
  },
  hardwareAcceleration: stored.hardwareAcceleration,
  hwaccelMode: stored.hwaccelMode,
  encoderType: stored.encoderType,
  setHardwareAcceleration: (enabled) => {
    log.debug('setHardwareAcceleration:', enabled);
    set((state) => {
      persistHwAccel(enabled, state.hwaccelMode, state.encoderType);
      return { hardwareAcceleration: enabled };
    });
  },
  setHwaccelMode: (mode) => {
    log.debug('setHwaccelMode:', mode);
    set((state) => {
      persistHwAccel(state.hardwareAcceleration, mode, state.encoderType);
      return { hwaccelMode: mode };
    });
  },
  setEncoderType: (type) => {
    log.debug('setEncoderType:', type);
    set((state) => {
      persistHwAccel(state.hardwareAcceleration, state.hwaccelMode, type);
      return { encoderType: type };
    });
  },
  alwaysOnTop: readStoredAlwaysOnTop(),
  setAlwaysOnTop: (flag) => {
    log.debug('setAlwaysOnTop:', flag);
    persistAlwaysOnTop(flag);
    window.electronAPI?.windowSetAlwaysOnTop(flag);
    set({ alwaysOnTop: flag });
  },
}));
