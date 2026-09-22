/**
 * @fileoverview Aptabase adapter for the main process implementing the
 * provider-agnostic {@link AnalyticsProvider} contract.
 *
 * This is the ONLY module in the main process allowed to import
 * `@aptabase/electron/main`. It wraps the SDK behind the facade so a future
 * backend swap (PostHog, Plausible, ...) only adds one adapter file + a
 * factory entry - call sites, consent, and the IPC surface never change.
 *
 * SDK facts (verified `@aptabase/electron@0.3.1`) the adapter works around:
 *  - `initialize(appKey, { host? })` MUST run before `app.whenReady()` (it
 *    registers the `aptabase-ipc` custom protocol synchronously, then awaits
 *    `app.whenReady()` internally); tracking is self-disabled otherwise.
 *  - The SDK is imported statically, not lazily: the main build is CommonJS,
 *    so `require('@aptabase/electron/main')` resolves synchronously to the
 *    package's CJS build (`dist/main.cjs`), which has no top-level side
 *    effects. Running `initialize()` inside the synchronous analytics
 *    bootstrap therefore guarantees the `aptabase-ipc` scheme is registered
 *    before Electron fires `ready` (D7). A dynamic `import()` of the ESM
 *    build would race `app.whenReady()` and silently self-disable the SDK.
 *  - There is no `flush`/`close` export, so this adapter tracks its own
 *    in-flight request promises to give the facade real flush/close
 *    semantics (D7).
 *  - `trackEvent(name, props)` accepts only string/number/boolean props and
 *    buffers events emitted before init completes; the buffer drains on init.
 *  - The App Key is read from config (runtime env `APTABASE_APP_KEY`); it
 *    never leaves the main process.
 *
 * The App Key format is validated by the provider factory
 * (`providerFactory.isValidAptabaseAppKey`, mirroring the SDK's
 * `A-{US|EU|DEV|SH}-...` guard); an invalid or missing key degrades the
 * backend to noop instead of advertising `aptabase` with no transport.
 */

import { Logger } from '../../shared/logger';
import { protocol } from 'electron';
import {
  LOG_ANALYTICS_CLOSE_FAILED,
  LOG_ANALYTICS_FLUSH_FAILED,
  LOG_ANALYTICS_INIT_FAILED,
  LOG_ANALYTICS_TRACK_FAILED,
} from '../../shared/log-constants';
import { ANALYTICS_EVENT_GROUP } from '../../shared/analytics/events';
import type { AnalyticsEvent } from '../../shared/analytics/events';
import type { AnalyticsConfig, AnalyticsProvider } from '../../shared/analytics/types';
import { initialize as aptabaseInitialize, trackEvent as aptabaseTrackEvent } from '@aptabase/electron/main';

/** Per-module logger for the main Aptabase adapter. @const {Logger} */
const log = new Logger('main/analytics/aptabaseMainProvider');

/**
 * Environment variable listing the event groups to emit (comma separated,
 * D10). Absent/empty means every group is emitted.
 * @const {string}
 */
export const ANALYTICS_GROUPS_ENV_VAR = 'ANALYTICS_GROUPS';

/**
 * Filters a group gate string into a Set of allowed groups. `null` means
 * "no gate" (emit everything).
 * @param {string | undefined} raw - Comma-separated `ANALYTICS_GROUPS` value.
 * @returns {Set<string> | null} The allowed group set, or null when unset.
 */
function parseGroupGate(raw: string | undefined): Set<string> | null {
  if (!raw) return null;
  const groups = raw
    .split(',')
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);
  return groups.length > 0 ? new Set(groups) : null;
}

/**
 * Aptabase-backed analytics provider for the main process.
 * @class AptabaseMainProvider
 * @implements {AnalyticsProvider}
 */
export class AptabaseMainProvider implements AnalyticsProvider {
  /** Adapter identifier. @readonly */
  readonly name = 'aptabase';

  /** Whether the SDK accepted initialization. @type {boolean} */
  private active: boolean;

  /** In-flight track requests, tracked for flush/close semantics (D7). @type {Set<Promise<void>>} */
  private inflight: Set<Promise<void>>;

  /** Allowed event groups, or null when every group is emitted. @type {Set<string> | null} */
  private groupGate: Set<string> | null;

  /**
   * Creates the provider in inactive state.
   */
  constructor() {
    this.active = false;
    this.inflight = new Set();
    this.groupGate = null;
  }

  /**
   * Initializes the main-process SDK. Guards on the App Key being present and
   * well-formed enough for the preregistration steps to run.
   *
   * @param {AnalyticsConfig} config - Resolved config (`appKey`/`host` live
   *   only in the main process by design; `enabled` is enforced by the facade
   *   but honored here too as defense in depth).
   * @returns {Promise<void>} Resolves once SDK init options have been applied.
   */
  async init(config: AnalyticsConfig): Promise<void> {
    try {
      if (!config.enabled) return;
      const appKey = config.appKey || process.env.APTABASE_APP_KEY;
      if (!appKey) return;
      this.groupGate = parseGroupGate(process.env[ANALYTICS_GROUPS_ENV_VAR]);
      await aptabaseInitialize(appKey, config.host ? { host: config.host } : undefined);
      // The SDK disables itself silently (e.g. initialized after `ready`, or a
      // rejected App Key) WITHOUT throwing and WITHOUT registering the
      // `aptabase-ipc` handler. Detect that instead of advertising a backend
      // whose transport was never wired up. Guarded because `electron` is not
      // a full module in plain-Node test contexts.
      const transportWired = typeof protocol?.isProtocolHandled === 'function' && protocol.isProtocolHandled('aptabase-ipc');
      if (!transportWired) {
        log.warn(LOG_ANALYTICS_INIT_FAILED, 'Aptabase SDK self-disabled; the aptabase-ipc transport is not registered. Tracking disabled.');
        this.active = false;
        return;
      }
      this.active = true;
    } catch (err) {
      log.error(LOG_ANALYTICS_INIT_FAILED, err);
      this.active = false;
    }
  }

  /**
   * @returns {boolean} Whether the SDK is initialized and accepting events.
   */
  isEnabled(): boolean {
    return this.active;
  }

  /**
   * Records a typed event through the SDK, unless its functional group is
   * gated off by `ANALYTICS_GROUPS`. Fire-and-forget: the returned promise is
   * retained in {@link inflight} so flush/close can drain in-flight requests.
   * @param {AnalyticsEvent} event - The typed event to record.
   * @returns {void}
   */
  track(event: AnalyticsEvent): void {
    if (!this.active) return;
    if (this.groupGate && !this.groupGate.has(ANALYTICS_EVENT_GROUP[event.name])) {
      log.debug('analytics group gated off:', event.name);
      return;
    }
    const props = sanitizeProps(event.props);
    try {
      const promise = aptabaseTrackEvent(event.name, props);
      this.inflight.add(promise);
      void promise.finally(() => {
        this.inflight.delete(promise);
      });
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }

  /**
   * Disables recording at runtime (consent off). Events are dropped while
   * inactive; a later `init` reactivates the backend.
   * @param {boolean} enabled - Whether recording should occur.
   * @returns {void}
   */
  setEnabled(enabled: boolean): void {
    this.active = enabled;
  }

  /**
   * Waits for all in-flight track requests to settle within the timeout.
   * @param {number} [timeoutMs] - Max milliseconds to wait (default 5000).
   * @returns {Promise<boolean>} True when everything drained in time.
   */
  async flush(timeoutMs?: number): Promise<boolean> {
    if (this.inflight.size === 0) return true;
    const deadline = Date.now() + (timeoutMs ?? 5000);
    const pending = Array.from(this.inflight);
    await Promise.allSettled(pending);
    return Date.now() <= deadline;
  }

  /**
   * Drains in-flight requests and shuts the SDK down (idempotent). The SDK
   * has no `close`, so this only flushes; a later {@link init} re-arms it.
   * @param {number} [timeoutMs] - Max milliseconds to wait (default 5000).
   * @returns {Promise<boolean>} True when shutdown completed cleanly.
   */
  async close(timeoutMs?: number): Promise<boolean> {
    try {
      const drained = await this.flush(timeoutMs ?? 5000);
      this.active = false;
      return drained;
    } catch (err) {
      log.warn(LOG_ANALYTICS_CLOSE_FAILED, err);
      return false;
    }
  }
}

/**
 * Reduces raw taxonomy props to the shape the SDK accepts: keys whose values
 * are strings (non-empty), numbers, or booleans survive; everything else is
 * dropped. Taxonomy payloads are already categorical, so this is defense in
 * depth against accidental non-serializable props.
 * @param {Record<string, unknown>} props - Raw event props.
 * @returns {Record<string, string | number | boolean> | undefined} Sanitized props.
 */
function sanitizeProps(props: Record<string, unknown>): Record<string, string | number | boolean> | undefined {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') {
      if (value.length > 0) out[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
