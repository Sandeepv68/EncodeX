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
 *  - setMcpEnabled/setMcpPort/setMcpToken forward the whole embedded MCP server
 *    snapshot to the main process via window.electronAPI.mcpSetSettings (which
 *    persists it and live-reconciles the HTTP server) and adopt the sanitized
 *    result, so an out-of-range port or non-string token can never stick.
 *
 * Consumers:
 *  - Settings UI panels and the conversion form (which reads the transcoder and
 *    hardware acceleration settings)
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { loadJson, saveJson, loadString, saveString } from '../utils/storage';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { HWACCEL_DEFAULTS, HWACCEL_MODES, HWACCEL_STORAGE_KEY, ENCODER_TYPES, ENCODER_TYPE_DEFAULT } from '../../shared/hwaccel-settings';
import { defaultMcpSettings } from '../../shared/mcp-settings';
import type { McpSettings } from '../../shared/mcp-settings';
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
  LOG_SET_MONITORING_ENABLED,
  LOG_SET_TELEMETRY_ENABLED,
  LOG_SET_MCP_ENABLED,
  LOG_SET_MCP_PORT,
  LOG_SET_MCP_TOKEN,
} from '../../shared/log-constants';
import { clamp } from '../../shared/math';
import { recordAnalyticsEvent, setAnalyticsEnabled as enableAnalyticsFacade } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import pkg from '../../../package.json';

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
  const parsed = loadJson<Partial<HwAccelStored>>(HWACCEL_STORAGE_KEY, {}, (err) =>
    log.warn(LOG_FAILED_TO_READ_STORED_HARDWARE_ACCELERATION_SETTINGS, err),
  );
  return {
    hardwareAcceleration: typeof parsed.hardwareAcceleration === 'boolean' ? parsed.hardwareAcceleration : HWACCEL_DEFAULTS.ENABLED,
    hwaccelMode: parsed.hwaccelMode && HWACCEL_MODES.includes(parsed.hwaccelMode) ? parsed.hwaccelMode : HWACCEL_DEFAULTS.MODE,
    encoderType: parsed.encoderType && ENCODER_TYPES.includes(parsed.encoderType) ? parsed.encoderType : ENCODER_TYPE_DEFAULT,
  };
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
  saveJson(HWACCEL_STORAGE_KEY, { hardwareAcceleration, hwaccelMode, encoderType }, (err) =>
    log.warn(LOG_FAILED_TO_PERSIST_HARDWARE_ACCELERATION_SETTINGS, err),
  );
}

/**
 * The validated hardware acceleration snapshot read from localStorage at
 * module load, used to initialize the store.
 * @type {HwAccelStored}
 */
const stored = readStoredHwAccel();

/**
 * Default embedded MCP server settings used to initialize the store before the
 * main process (which owns the persisted file) hydrates the real values.
 * @type {McpSettings}
 */
const storedMcp = defaultMcpSettings();

/**
 * Reads the persisted always-on-top flag from localStorage
 * ('encodex-always-on-top'); a stored value of 'true' means enabled. Storage
 * failures are logged and treated as false.
 * @returns {boolean} True when the window should start always-on-top.
 */
function readStoredAlwaysOnTop(): boolean {
  return (
    loadString(WINDOW_ALWAYS_ON_TOP_STORAGE_KEY, 'false', (err) => log.warn(LOG_FAILED_TO_READ_STORED_ALWAYS_ON_TOP_SETTING, err)) ===
    'true'
  );
}

/**
 * Persists the always-on-top flag to localStorage ('encodex-always-on-top').
 * Failures are logged and swallowed.
 * @param {boolean} flag - The flag value to persist.
 * @returns {void}
 */
function persistAlwaysOnTop(flag: boolean): void {
  saveString(WINDOW_ALWAYS_ON_TOP_STORAGE_KEY, String(flag), (err) => log.warn(LOG_FAILED_TO_PERSIST_ALWAYS_ON_TOP_SETTING, err));
}

/**
 * Reads the persisted launch-at-login flag from localStorage
 * ('encodex-launch-at-login'); a stored value of 'true' means enabled. Storage
 * failures are logged and treated as false.
 * @returns {boolean} True when the app should launch at OS startup.
 */
function readStoredLaunchAtLogin(): boolean {
  return (
    loadString(LAUNCH_AT_LOGIN_STORAGE_KEY, 'false', (err) => log.warn(LOG_FAILED_TO_READ_STORED_LAUNCH_AT_LOGIN_SETTING, err)) === 'true'
  );
}

/**
 * Persists the launch-at-login flag to localStorage
 * ('encodex-launch-at-login'). Failures are logged and swallowed.
 * @param {boolean} enabled - The flag value to persist.
 * @returns {void}
 */
function persistLaunchAtLogin(enabled: boolean): void {
  saveString(LAUNCH_AT_LOGIN_STORAGE_KEY, String(enabled), (err) => log.warn(LOG_FAILED_TO_PERSIST_LAUNCH_AT_LOGIN_SETTING, err));
}

/**
 * Reads the persisted batch queue concurrency from localStorage
 * ('encodex-queue-concurrency'); the value is clamped to 1..MAX_QUEUE_CONCURRENCY
 * and defaults to DEFAULT_QUEUE_CONCURRENCY when missing or unparsable. Storage
 * failures are logged and treated as the default.
 * @returns {number} The validated concurrency value (1-4).
 */
export function readStoredQueueConcurrency(): number {
  const raw = loadString(QUEUE_CONCURRENCY_STORAGE_KEY, '', (err) => log.warn(LOG_FAILED_TO_READ_STORED_QUEUE_CONCURRENCY, err));
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed)) {
      return clamp(parsed, 1, MAX_QUEUE_CONCURRENCY);
    }
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
  saveString(QUEUE_CONCURRENCY_STORAGE_KEY, String(concurrency), (err) => log.warn(LOG_FAILED_TO_PERSIST_QUEUE_CONCURRENCY, err));
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
  const parsed = loadJson<Partial<{ enabled: boolean; action: WhenDoneAction; force: boolean }>>(WHEN_DONE_STORAGE_KEY, {}, (err) =>
    log.warn(LOG_FAILED_TO_READ_STORED_WHEN_DONE_CONFIG, err),
  );
  const action =
    parsed.action && (WHEN_DONE_ACTIONS as readonly string[]).includes(parsed.action) ? parsed.action : DEFAULT_WHEN_DONE_ACTION;
  return {
    enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
    action,
    force: typeof parsed.force === 'boolean' ? parsed.force : false,
  };
}

/**
 * Persists the when-done config to localStorage ('encodex-when-done'). Failures
 * are logged and swallowed.
 * @param {{enabled: boolean, action: WhenDoneAction, force: boolean}} config -
 *   The when-done config to persist.
 * @returns {void}
 */
function persistWhenDone(config: { enabled: boolean; action: WhenDoneAction; force: boolean }): void {
  saveJson(WHEN_DONE_STORAGE_KEY, config, (err) => log.warn(LOG_FAILED_TO_PERSIST_WHEN_DONE_CONFIG, err));
}

/**
 * Zustand store for user application settings.
 * Holds the transcoder backend, hardware acceleration preferences (persisted to
 * localStorage and validated at load via readStoredHwAccel), the always-on-top
 * flag, and the batch queue concurrency cap. Implemented as a module-level
 * singleton consumed by the settings UI and the conversion form.
 * @const {UseBoundStore<StoreApi<SettingsState>>} useSettingsStore
 */
/** App version used to stamp telemetry consent events. @const {string} */
const APP_VERSION = pkg.version;

export const useSettingsStore = create<SettingsState>((set) => ({
  transcoder: TRANSCODER_TYPES[0],
  /**
   * Sets the active transcoder backend.
   * @param {string} t - Transcoder identifier ('FFMPEG' | 'FFTOOL' | 'BMF').
   */
  setTranscoder: (t) => {
    log.debug(LOG_SET_TRANSCODER, t);
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
    set((state) => {
      persistHwAccel(enabled, state.hwaccelMode, state.encoderType);
      return { hardwareAcceleration: enabled };
    });
    recordAnalyticsEvent(createAnalyticsEvent('hwaccel_toggled', { enabled }));
  },
  /**
   * Sets the hardware acceleration mode and persists the change to localStorage,
   * keeping the current enabled flag and encoder type.
   * @param {HwAccelMode} mode - The acceleration mode ('auto' | 'encode').
   */
  setHwaccelMode: (mode) => {
    log.debug(LOG_SET_HWACCEL_MODE, mode);
    set((state) => {
      persistHwAccel(state.hardwareAcceleration, mode, state.encoderType);
      return { hwaccelMode: mode };
    });
    recordAnalyticsEvent(createAnalyticsEvent('hwaccel_mode_changed', { mode }));
  },
  /**
   * Sets the encoder preference and persists the change to localStorage, keeping
   * the current enabled flag and mode.
   * @param {EncoderType} type - The encoder preference ('auto' | 'hardware' |
   *   'software').
   */
  setEncoderType: (type) => {
    log.debug(LOG_SET_ENCODER_TYPE, type);
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
    persistLaunchAtLogin(enabled);
    window.electronAPI?.setLaunchAtLogin(enabled);
    set({ launchAtLogin: enabled });
  },
  monitoringEnabled: true,
  /**
   * Sets error-monitoring consent. Forwards the flag to the main process via
   * window.electronAPI.monitoringSetEnabled, which persists consent to disk
   * and live-toggles the backend, then adopts the authoritative result.
   * @param {boolean} enabled - True to allow error reporting.
   */
  setMonitoringEnabled: (enabled) => {
    log.debug(LOG_SET_MONITORING_ENABLED, enabled);
    window.electronAPI
      ?.monitoringSetEnabled(enabled)
      .then((result) => set({ monitoringEnabled: result.enabled }))
      .catch((err) => log.warn(LOG_SET_MONITORING_ENABLED, 'failed:', err));
  },
  analyticsEnabled: true,
  /**
   * Toggles the combined usage-telemetry consent (D1 single switch). Enabling
   * persists consent via the main process and re-activates both the analytics
   * and monitoring backends, then records the `telemetry_opt_in` event through
   * the now-active facade. Disabling records `telemetry_opt_out` first (so the
   * event is not lost once consent is off), then shuts both backends down. The
   * authoritative results from both IPC calls are adopted into the store.
   * @param {boolean} enabled - True to allow usage analytics + error reporting.
   */
  setTelemetryEnabled: (enabled) => {
    log.debug(LOG_SET_TELEMETRY_ENABLED, enabled);
    const apply = async () => {
      const [analyticsState, monitoringState] = await Promise.all([
        window.electronAPI?.analyticsSetEnabled(enabled) ?? Promise.resolve({ enabled, backend: 'noop' }),
        window.electronAPI?.monitoringSetEnabled(enabled) ?? Promise.resolve({ enabled }),
      ]);
      await enableAnalyticsFacade(enabled);
      set({ analyticsEnabled: analyticsState.enabled, monitoringEnabled: monitoringState.enabled });
    };
    if (enabled) {
      void apply()
        .then(() => {
          recordAnalyticsEvent(createAnalyticsEvent('telemetry_opt_in', { version: APP_VERSION }));
        })
        .catch((err) => log.warn(LOG_SET_TELEMETRY_ENABLED, 'failed:', err));
    } else {
      recordAnalyticsEvent(createAnalyticsEvent('telemetry_opt_out', { version: APP_VERSION }));
      void apply().catch((err) => log.warn(LOG_SET_TELEMETRY_ENABLED, 'failed:', err));
    }
  },
  mcpEnabled: storedMcp.enabled,
  mcpPort: storedMcp.port,
  mcpToken: storedMcp.token,
  /**
   * Enables or disables the embedded MCP server. Merges the flag into the
   * current snapshot and forwards it to the main process, which persists it and
   * live-reconciles the HTTP server; the sanitized result is adopted.
   * @param {boolean} enabled - True to start the loopback MCP server.
   */
  setMcpEnabled: (enabled) => {
    log.debug(LOG_SET_MCP_ENABLED, enabled);
    applyMcpSettings({ enabled });
  },
  /**
   * Sets the embedded MCP server port. The main process clamps it to the valid
   * 1024-65535 range and the sanitized value is adopted.
   * @param {number} port - The candidate TCP port.
   */
  setMcpPort: (port) => {
    log.debug(LOG_SET_MCP_PORT, port);
    applyMcpSettings({ port });
  },
  /**
   * Sets the optional bearer token MCP clients must send. The token value is
   * never logged. The sanitized result is adopted.
   * @param {string} token - The candidate bearer token ('' allows any local client).
   */
  setMcpToken: (token) => {
    log.debug(LOG_SET_MCP_TOKEN, { hasToken: token.length > 0 });
    applyMcpSettings({ token });
  },
  queueConcurrency: readStoredQueueConcurrency(),
  /**
   * Sets the batch queue concurrency. Persists the value to localStorage and
   * forwards it to the main process via window.electronAPI.queueSetConcurrency.
   * @param {number} concurrency - Number of jobs to run in parallel (1-4).
   */
  setQueueConcurrency: (concurrency) => {
    log.debug(LOG_SET_QUEUE_CONCURRENCY, concurrency);
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
    persistWhenDone(config);
    window.electronAPI?.queueSetWhenDone(config);
    set({ whenDone: config });
  },
}));

/**
 * Merges a partial embedded MCP server patch into the current snapshot, sends
 * the whole candidate to the main process via
 * window.electronAPI.mcpSetSettings (which persists it and live-reconciles the
 * HTTP server), and adopts the authoritative sanitized result. Declared as a
 * hoisted function so the store setters above can reference it.
 * @param {Partial<McpSettings>} patch - The fields to change.
 * @returns {void}
 */
function applyMcpSettings(patch: Partial<McpSettings>): void {
  const current = useSettingsStore.getState();
  const candidate: McpSettings = {
    enabled: current.mcpEnabled,
    port: current.mcpPort,
    token: current.mcpToken,
    ...patch,
  };
  window.electronAPI
    ?.mcpSetSettings(candidate)
    .then((result) => useSettingsStore.setState({ mcpEnabled: result.enabled, mcpPort: result.port, mcpToken: result.token }))
    .catch((err) => log.warn(LOG_SET_MCP_ENABLED, 'failed:', err));
}

/**
 * Hydrates the monitoring consent flag from the main process, which owns the
 * persisted consent file. Runs once at module load; failures leave the
 * optimistic default (enabled) in place.
 */
if (typeof window !== 'undefined' && window.electronAPI?.monitoringGetState) {
  window.electronAPI
    .monitoringGetState()
    .then((state) => useSettingsStore.setState({ monitoringEnabled: state.enabled }))
    .catch((err) => log.warn('Failed to hydrate monitoring consent:', err));
}

/**
 * Hydrates the usage-analytics consent flag from the main process, which owns
 * the persisted consent file. Runs once at module load; failures leave the
 * optimistic default (enabled) in place.
 */
if (typeof window !== 'undefined' && window.electronAPI?.analyticsGetState) {
  window.electronAPI
    .analyticsGetState()
    .then((state) => useSettingsStore.setState({ analyticsEnabled: state.enabled }))
    .catch((err) => log.warn('Failed to hydrate analytics consent:', err));
}

/**
 * Hydrates the embedded MCP server settings from the main process, which owns
 * the persisted `mcp-settings.json` file. Runs once at module load; failures
 * leave the disabled-by-default snapshot in place.
 */
if (typeof window !== 'undefined' && window.electronAPI?.mcpGetSettings) {
  window.electronAPI
    .mcpGetSettings()
    .then((settings) => useSettingsStore.setState({ mcpEnabled: settings.enabled, mcpPort: settings.port, mcpToken: settings.token }))
    .catch((err) => log.warn('Failed to hydrate MCP settings:', err));
}
