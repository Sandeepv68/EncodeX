/**
 * @fileoverview Zustand store for user application settings.
 * Manages the active transcoder backend, hardware acceleration preferences
 * (persisted to localStorage under 'encodex-hwaccel'), the always-on-top
 * window flag (persisted under 'encodex-always-on-top'), the launch-at-login
 * preference (persisted under 'encodex-launch-at-login'), the batch queue
 * concurrency (persisted under 'encodex-queue-concurrency'), and the batch
 * queue "when done" power-action config (persisted under 'encodex-when-done').
 *
 * State held:
 *  - transcoder: the active transcoder backend ('FFMPEG' | 'FFTOOL' | 'BMF')
 *  - hardwareAcceleration / hwaccelMode / encoderType: hardware acceleration
 *    preferences, initialized from the persisted snapshot
 *  - alwaysOnTop: whether the window stays on top of other windows
 *  - launchAtLogin: whether the app launches at OS startup
 *  - queueConcurrency: batch jobs run in parallel (1-4)
 *  - whenDone: {enabled, action, force} power action for when the batch queue drains
 *
 * Behavior notes:
 *  - Hardware acceleration setters persist the new values to localStorage
 *    before updating state; reads validate against the known option lists and
 *    fall back to the defaults from HWACCEL_DEFAULTS / ENCODER_TYPE_DEFAULT.
 *  - setAlwaysOnTop persists the flag, forwards it to the main process via
 *    window.electronAPI.windowSetAlwaysOnTop, and then updates state.
 *  - setLaunchAtLogin persists the flag, forwards it to the main process via
 *    window.electronAPI.setLaunchAtLogin, and then updates state.
 *  - setQueueConcurrency persists the value, forwards it to the main process
 *    via window.electronAPI.queueSetConcurrency, and then updates state.
 *  - setWhenDone persists the config, forwards it to the main process via
 *    window.electronAPI.queueSetWhenDone, and then updates state.
 *
 * Consumers:
 *  - Settings UI panels and the conversion form (which reads the transcoder and
 *    hardware acceleration settings)
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { HWACCEL_DEFAULTS, HWACCEL_MODES, HWACCEL_STORAGE_KEY, ENCODER_TYPES, ENCODER_TYPE_DEFAULT } from '../../shared/hwaccel-settings';
import type { HwAccelMode, EncoderType, WhenDoneAction } from '../../shared/types';
import type { HwAccelStored, SettingsState } from './types';
import {
  WINDOW_ALWAYS_ON_TOP_STORAGE_KEY,
  QUEUE_CONCURRENCY_STORAGE_KEY,
  LAUNCH_AT_LOGIN_STORAGE_KEY,
  WHEN_DONE_STORAGE_KEY,
  DEFAULT_QUEUE_CONCURRENCY,
  MAX_QUEUE_CONCURRENCY,
  DEFAULT_WHEN_DONE_ACTION,
  WHEN_DONE_ACTIONS,
} from '../../shared/constants';
import { ANALYTICS_STORAGE_KEY, DEFAULT_ANALYTICS_ENABLED } from '../../shared/analytics/analytics-constants';
import { setAnalyticsEnabled as setAnalyticsEnabledFlag } from '../../shared/analytics/provider';
import { analytics } from '../../shared/analytics/analytics';
import {
  LOG_FAILED_TO_PERSIST_ALWAYS_ON_TOP_SETTING,
  LOG_FAILED_TO_PERSIST_HARDWARE_ACCELERATION_SETTINGS,
  LOG_FAILED_TO_PERSIST_LAUNCH_AT_LOGIN_SETTING,
  LOG_FAILED_TO_PERSIST_QUEUE_CONCURRENCY,
  LOG_FAILED_TO_PERSIST_WHEN_DONE_CONFIG,
  LOG_FAILED_TO_READ_STORED_ALWAYS_ON_TOP_SETTING,
  LOG_FAILED_TO_READ_STORED_HARDWARE_ACCELERATION_SETTINGS,
  LOG_FAILED_TO_READ_STORED_LAUNCH_AT_LOGIN_SETTING,
  LOG_FAILED_TO_READ_STORED_QUEUE_CONCURRENCY,
  LOG_FAILED_TO_READ_STORED_WHEN_DONE_CONFIG,
  LOG_SET_ALWAYS_ON_TOP,
  LOG_SET_ENCODER_TYPE,
  LOG_SET_HARDWARE_ACCELERATION,
  LOG_SET_HWACCEL_MODE,
  LOG_SET_LAUNCH_AT_LOGIN,
  LOG_SET_QUEUE_CONCURRENCY,
  LOG_SET_TRANSCODER,
  LOG_SET_WHEN_DONE,
} from '../../shared/log-constants';

/**
 * Per-store logger for the settings store.
 * @const {Logger} log
 */
const log = new Logger('renderer/stores/settingsStore');

/**
 * Reads and validates the persisted hardware acceleration settings from
 * localStorage ('encodex-hwaccel'). Each field is validated against the known
 * option lists; invalid or missing values fall back to HWACCEL_DEFAULTS /
 * ENCODER_TYPE_DEFAULT. On storage/parse failure the defaults are returned.
 * @returns {HwAccelStored} The validated settings snapshot.
 */
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
    log.warn(LOG_FAILED_TO_READ_STORED_HARDWARE_ACCELERATION_SETTINGS, err);
  }
  return { hardwareAcceleration: HWACCEL_DEFAULTS.ENABLED, hwaccelMode: HWACCEL_DEFAULTS.MODE, encoderType: ENCODER_TYPE_DEFAULT };
}

/**
 * Serializes the hardware acceleration settings to localStorage
 * ('encodex-hwaccel'). Failures are logged and swallowed so a full storage
 * quota never breaks the settings UI.
 * @param {boolean} hardwareAcceleration - Whether hardware acceleration is enabled.
 * @param {HwAccelMode} hwaccelMode - The acceleration mode ('auto' | 'encode').
 * @param {EncoderType} encoderType - The encoder preference.
 * @returns {void}
 */
function persistHwAccel(hardwareAcceleration: boolean, hwaccelMode: HwAccelMode, encoderType: EncoderType): void {
  try {
    localStorage.setItem(HWACCEL_STORAGE_KEY, JSON.stringify({ hardwareAcceleration, hwaccelMode, encoderType }));
  } catch (err) {
    log.warn(LOG_FAILED_TO_PERSIST_HARDWARE_ACCELERATION_SETTINGS, err);
  }
}

/**
 * The validated hardware acceleration snapshot read from localStorage at
 * module load, used to initialize the store.
 * @type {HwAccelStored}
 */
const stored = readStoredHwAccel();

// Sync the analytics enabled flag from localStorage at module load time
setAnalyticsEnabledFlag(readStoredAnalyticsEnabled());

/**
 * Reads the persisted always-on-top flag from localStorage
 * ('encodex-always-on-top'); a stored value of 'true' means enabled. Storage
 * failures are logged and treated as false.
 * @returns {boolean} True when the window should start always-on-top.
 */
function readStoredAlwaysOnTop(): boolean {
  try {
    return localStorage.getItem(WINDOW_ALWAYS_ON_TOP_STORAGE_KEY) === 'true';
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_STORED_ALWAYS_ON_TOP_SETTING, err);
    return false;
  }
}

/**
 * Persists the always-on-top flag to localStorage ('encodex-always-on-top').
 * Failures are logged and swallowed.
 * @param {boolean} flag - The flag value to persist.
 * @returns {void}
 */
function persistAlwaysOnTop(flag: boolean): void {
  try {
    localStorage.setItem(WINDOW_ALWAYS_ON_TOP_STORAGE_KEY, String(flag));
  } catch (err) {
    log.warn(LOG_FAILED_TO_PERSIST_ALWAYS_ON_TOP_SETTING, err);
  }
}

/**
 * Reads the persisted launch-at-login flag from localStorage
 * ('encodex-launch-at-login'); a stored value of 'true' means enabled. Storage
 * failures are logged and treated as false.
 * @returns {boolean} True when the app should launch at OS startup.
 */
function readStoredLaunchAtLogin(): boolean {
  try {
    return localStorage.getItem(LAUNCH_AT_LOGIN_STORAGE_KEY) === 'true';
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_STORED_LAUNCH_AT_LOGIN_SETTING, err);
    return false;
  }
}

/**
 * Persists the launch-at-login flag to localStorage
 * ('encodex-launch-at-login'). Failures are logged and swallowed.
 * @param {boolean} enabled - The flag value to persist.
 * @returns {void}
 */
function persistLaunchAtLogin(enabled: boolean): void {
  try {
    localStorage.setItem(LAUNCH_AT_LOGIN_STORAGE_KEY, String(enabled));
  } catch (err) {
    log.warn(LOG_FAILED_TO_PERSIST_LAUNCH_AT_LOGIN_SETTING, err);
  }
}

/**
 * Reads the persisted batch queue concurrency from localStorage
 * ('encodex-queue-concurrency'); the value is clamped to 1..MAX_QUEUE_CONCURRENCY
 * and defaults to DEFAULT_QUEUE_CONCURRENCY when missing or unparsable. Storage
 * failures are logged and treated as the default.
 * @returns {number} The validated concurrency value (1-4).
 */
export function readStoredQueueConcurrency(): number {
  try {
    const raw = localStorage.getItem(QUEUE_CONCURRENCY_STORAGE_KEY);
    if (raw) {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isInteger(parsed)) {
        return Math.min(Math.max(parsed, 1), MAX_QUEUE_CONCURRENCY);
      }
    }
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_STORED_QUEUE_CONCURRENCY, err);
  }
  return DEFAULT_QUEUE_CONCURRENCY;
}

/**
 * Persists the batch queue concurrency to localStorage
 * ('encodex-queue-concurrency'). Failures are logged and swallowed.
 * @param {number} concurrency - The concurrency value to persist.
 * @returns {void}
 */
function persistQueueConcurrency(concurrency: number): void {
  try {
    localStorage.setItem(QUEUE_CONCURRENCY_STORAGE_KEY, String(concurrency));
  } catch (err) {
    log.warn(LOG_FAILED_TO_PERSIST_QUEUE_CONCURRENCY, err);
  }
}

/**
 * Reads the persisted analytics opt-in preference from localStorage
 * ('encodex-analytics-enabled'); a stored value of 'false' means disabled.
 * Storage failures are logged and treated as enabled (the default).
 * @returns {boolean} True when analytics is enabled.
 */
function readStoredAnalyticsEnabled(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_STORAGE_KEY) !== 'false';
  } catch {
    return DEFAULT_ANALYTICS_ENABLED;
  }
}

/**
 * Persists the analytics opt-in preference to localStorage
 * ('encodex-analytics-enabled'). Failures are logged and swallowed.
 * @param {boolean} enabled - Whether analytics tracking is enabled.
 * @returns {void}
 */
function persistAnalyticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ANALYTICS_STORAGE_KEY, String(enabled));
  } catch {
    // storage failure is non-critical
  }
}

/**
 * Reads the persisted when-done config from localStorage
 * ('encodex-when-done') and validates it field-by-field: `enabled` must be a
 * boolean, `action` must be one of the known WhenDoneAction values, and
 * `force` must be a boolean. Invalid or missing fields fall back to the
 * defaults (disabled, DEFAULT_WHEN_DONE_ACTION, force off). Storage failures
 * are logged and treated as the defaults.
 * @returns {{enabled: boolean, action: WhenDoneAction, force: boolean}} The
 *   validated when-done config snapshot.
 */
export function readStoredWhenDone(): { enabled: boolean; action: WhenDoneAction; force: boolean } {
  try {
    const raw = localStorage.getItem(WHEN_DONE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<{ enabled: boolean; action: WhenDoneAction; force: boolean }>;
      const action =
        parsed.action && (WHEN_DONE_ACTIONS as readonly string[]).includes(parsed.action) ? parsed.action : DEFAULT_WHEN_DONE_ACTION;
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
        action,
        force: typeof parsed.force === 'boolean' ? parsed.force : false,
      };
    }
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_STORED_WHEN_DONE_CONFIG, err);
  }
  return { enabled: false, action: DEFAULT_WHEN_DONE_ACTION, force: false };
}

/**
 * Persists the when-done config to localStorage ('encodex-when-done'). Failures
 * are logged and swallowed.
 * @param {{enabled: boolean, action: WhenDoneAction, force: boolean}} config -
 *   The when-done config to persist.
 * @returns {void}
 */
function persistWhenDone(config: { enabled: boolean; action: WhenDoneAction; force: boolean }): void {
  try {
    localStorage.setItem(WHEN_DONE_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    log.warn(LOG_FAILED_TO_PERSIST_WHEN_DONE_CONFIG, err);
  }
}

/**
 * Zustand store for user application settings.
 * Holds the transcoder backend, hardware acceleration preferences (persisted to
 * localStorage and validated at load via readStoredHwAccel), the always-on-top
 * flag, and the batch queue concurrency cap. Implemented as a module-level
 * singleton consumed by the settings UI and the conversion form.
 * @const {UseBoundStore<StoreApi<SettingsState>>} useSettingsStore
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  transcoder: TRANSCODER_TYPES[0],
  /**
   * Sets the active transcoder backend.
   * @param {string} t - Transcoder identifier ('FFMPEG' | 'FFTOOL' | 'BMF').
   */
  setTranscoder: (t) => {
    log.debug(LOG_SET_TRANSCODER, t);
    analytics.settingChanged('transcoder', t);
    set({ transcoder: t });
  },
  hardwareAcceleration: stored.hardwareAcceleration,
  hwaccelMode: stored.hwaccelMode,
  encoderType: stored.encoderType,
  /**
   * Enables or disables hardware acceleration and persists the change to
   * localStorage, keeping the current mode and encoder type.
   * @param {boolean} enabled - True to enable hardware acceleration.
   */
  setHardwareAcceleration: (enabled) => {
    log.debug(LOG_SET_HARDWARE_ACCELERATION, enabled);
    analytics.settingChanged('hardwareAcceleration', String(enabled));
    set((state) => {
      persistHwAccel(enabled, state.hwaccelMode, state.encoderType);
      return { hardwareAcceleration: enabled };
    });
  },
  /**
   * Sets the hardware acceleration mode and persists the change to localStorage,
   * keeping the current enabled flag and encoder type.
   * @param {HwAccelMode} mode - The acceleration mode ('auto' | 'encode').
   */
  setHwaccelMode: (mode) => {
    log.debug(LOG_SET_HWACCEL_MODE, mode);
    analytics.settingChanged('hwaccelMode', mode);
    set((state) => {
      persistHwAccel(state.hardwareAcceleration, mode, state.encoderType);
      return { hwaccelMode: mode };
    });
  },
  /**
   * Sets the encoder preference and persists the change to localStorage, keeping
   * the current enabled flag and mode.
   * @param {EncoderType} type - The encoder preference ('auto' | 'hardware' |
   *   'software').
   */
  setEncoderType: (type) => {
    log.debug(LOG_SET_ENCODER_TYPE, type);
    analytics.settingChanged('encoderType', type);
    set((state) => {
      persistHwAccel(state.hardwareAcceleration, state.hwaccelMode, type);
      return { encoderType: type };
    });
  },
  alwaysOnTop: readStoredAlwaysOnTop(),
  /**
   * Sets whether the window stays on top of other windows. Persists the flag to
   * localStorage and forwards it to the main process via
   * window.electronAPI.windowSetAlwaysOnTop.
   * @param {boolean} flag - True to keep the window always-on-top.
   */
  setAlwaysOnTop: (flag) => {
    log.debug(LOG_SET_ALWAYS_ON_TOP, flag);
    analytics.settingChanged('alwaysOnTop', String(flag));
    persistAlwaysOnTop(flag);
    window.electronAPI?.windowSetAlwaysOnTop(flag);
    set({ alwaysOnTop: flag });
  },
  launchAtLogin: readStoredLaunchAtLogin(),
  /**
   * Sets whether the app launches at OS startup. Persists the flag to
   * localStorage and forwards it to the main process via
   * window.electronAPI.setLaunchAtLogin, which adds or removes the app from the
   * OS login items.
   * @param {boolean} enabled - True to launch the app at startup.
   */
  setLaunchAtLogin: (enabled) => {
    log.debug(LOG_SET_LAUNCH_AT_LOGIN, enabled);
    analytics.settingChanged('launchAtLogin', String(enabled));
    persistLaunchAtLogin(enabled);
    window.electronAPI?.setLaunchAtLogin(enabled);
    set({ launchAtLogin: enabled });
  },
  queueConcurrency: readStoredQueueConcurrency(),
  /**
   * Sets the batch queue concurrency. Persists the value to localStorage and
   * forwards it to the main process via window.electronAPI.queueSetConcurrency.
   * @param {number} concurrency - Number of jobs to run in parallel (1-4).
   */
  setQueueConcurrency: (concurrency) => {
    log.debug(LOG_SET_QUEUE_CONCURRENCY, concurrency);
    analytics.settingChanged('queueConcurrency', String(concurrency));
    persistQueueConcurrency(concurrency);
    window.electronAPI?.queueSetConcurrency(concurrency);
    set({ queueConcurrency: concurrency });
  },
  whenDone: readStoredWhenDone(),
  /**
   * Sets the batch queue when-done config. Persists it to localStorage and
   * forwards it to the main process via window.electronAPI.queueSetWhenDone,
   * which performs the selected power action once the queue drains while the
   * feature is enabled.
   * @param {{enabled: boolean, action: WhenDoneAction, force: boolean}} config -
   *   Whether to act when the queue drains, which power action to run, and
   *   whether open processes should be force-closed.
   */
  setWhenDone: (config) => {
    log.debug(LOG_SET_WHEN_DONE, JSON.stringify(config));
    analytics.settingChanged('whenDone', `${config.action}:${config.enabled}`);
    persistWhenDone(config);
    window.electronAPI?.queueSetWhenDone(config);
    set({ whenDone: config });
  },
  analyticsEnabled: readStoredAnalyticsEnabled(),
  /**
   * Enables or disables analytics tracking. Persists the preference to
   * localStorage and updates the provider-level enabled flag so subsequent
   * track calls are gated.
   * @param {boolean} enabled - True to enable analytics, false to disable.
   */
  setAnalyticsEnabled: (enabled) => {
    log.debug('setAnalyticsEnabled', enabled);
    persistAnalyticsEnabled(enabled);
    setAnalyticsEnabledFlag(enabled);
    set({ analyticsEnabled: enabled });
    if (enabled) {
      analytics.settingChanged('analytics', 'enabled');
    }
  },
}));
