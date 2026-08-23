/**
 * @fileoverview Sentry adapter for the renderer process implementing the
 * provider-agnostic {@link MonitorProvider} contract.
 *
 * This is the ONLY module in the renderer allowed to import
 * `@sentry/electron/renderer`. It is initialized with the SDK's default
 * integrations EXCEPT its automatic global handlers (which are replaced by
 * explicit facade calls in `main.tsx` so a future backend swap keeps working).
 * Events flow to the main process over the SDK's own IPC transport, so the
 * DSN never enters the renderer bundle.
 */

import { Logger } from '../../shared/logger';
import { LOG_MONITORING_CAPTURE_FAILED, LOG_MONITORING_CLOSE_FAILED, LOG_MONITORING_INIT_FAILED } from '../../shared/log-constants';
import type {
  MonitorBreadcrumb,
  MonitorContext,
  MonitorFeedback,
  MonitoringConfig,
  MonitoringLevel,
  MonitorProvider,
  MonitorUser,
} from '../../shared/monitoring/types';

/** Per-module logger for the renderer Sentry adapter. @const {Logger} */
const log = new Logger('renderer/monitoring/sentryRendererProvider');

/**
 * Default integration names whose behavior this adapter replaces with
 * provider-agnostic equivalents (explicit handlers calling the facade).
 * @const {string[]}
 */
const REPLACED_DEFAULT_INTEGRATIONS = ['GlobalHandlers'];

/**
 * Minimal structural type of the `@sentry/electron/renderer` module surface
 * used by this adapter. Keeps the file free of static imports (the real
 * module loads lazily inside {@link init}) while retaining type safety.
 */
interface SentryRendererSdk {
  init(options?: Record<string, unknown>): void;
  captureException(error: unknown, hint?: Record<string, unknown>): string | undefined;
  captureMessage(message: string, level?: string, hint?: Record<string, unknown>): string | undefined;
  captureFeedback(feedback: { message: string; name?: string; email?: string }, hint?: Record<string, unknown>): string | undefined;
  setTag(key: string, value: string): void;
  setUser(user: Record<string, unknown> | null): void;
  addBreadcrumb(breadcrumb: Record<string, unknown>): void;
  flush(timeout?: number): Promise<boolean>;
  close(timeout?: number): Promise<boolean>;
}

/** Reuses the user mapping shape of the shared contracts. */
type MappedUser = Record<string, unknown>;

/**
 * Maps an optional {@link MonitorUser} onto the backend user record.
 * @param {MonitorUser | undefined} user - User info or undefined.
 * @returns {MappedUser | undefined} Backend user or undefined.
 */
function mapUser(user: MonitorUser | undefined): MappedUser | undefined {
  if (!user) return undefined;
  const mapped: MappedUser = {};
  if (user.id !== undefined) mapped.id = user.id;
  if (user.email !== undefined) mapped.email = user.email;
  if (user.username !== undefined) mapped.username = user.username;
  if (user.data !== undefined) mapped.data = user.data;
  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

/**
 * Maps facade-level context into the backend hint shape.
 * @param {MonitorContext | undefined} context - Structured context.
 * @returns {Record<string, unknown> | undefined} Hint or undefined.
 */
function mapHint(context: MonitorContext | undefined): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const hint: Record<string, unknown> = {};
  if (context.tags) hint.tags = context.tags;
  if (context.extra) hint.extra = context.extra;
  const user = mapUser(context.user);
  if (user) hint.user = user;
  return Object.keys(hint).length > 0 ? hint : undefined;
}

/**
 * Maps facade levels to backend severity strings.
 * @param {MonitoringLevel | undefined} level - Facade severity.
 * @returns {string} Backend severity ('error' when omitted).
 */
function mapLevel(level: MonitoringLevel | undefined): string {
  return level ?? 'error';
}

/**
 * Sentry-backed monitoring provider for the Electron renderer process.
 * @class SentryRendererProvider
 * @implements {MonitorProvider}
 */
export class SentryRendererProvider implements MonitorProvider {
  /** Adapter identifier. @readonly */
  readonly name = 'sentry';

  /** Lazily loaded SDK module; null until init succeeds. @type {SentryRendererSdk | null} */
  private sdk: SentryRendererSdk | null = null;

  /** Whether the SDK accepted initialization. @type {boolean} */
  private active: boolean;

  /** Config from the last successful init; enables re-init on toggle-on. @type {MonitoringConfig | null} */
  private lastConfig: MonitoringConfig | null = null;

  /**
   * Creates the provider in inactive state.
   */
  constructor() {
    this.active = false;
  }

  /**
   * Initializes the renderer SDK. Tracing stays enabled; automatic global
   * handlers are disabled (see {@link REPLACED_DEFAULT_INTEGRATIONS}) because
   * `main.tsx` wires equivalent handlers through the facade explicitly.
   *
   * @param {MonitoringConfig} config - Resolved config (dsn/release/environment ignored here;
   *   they live only in the main process by design).
   * @returns {Promise<void>} Resolves once init options have been applied.
   */
  async init(config: MonitoringConfig): Promise<void> {
    try {
      const mod = (await import('@sentry/electron/renderer')) as unknown as SentryRendererSdk;
      mod.init({
        debug: config.debug ?? false,
        tracesSampleRate: config.tracesSampleRate ?? 1.0,
        attachStacktrace: true,
        integrations: (defaults: Array<Record<string, unknown>>) =>
          defaults.filter((integration) => !REPLACED_DEFAULT_INTEGRATIONS.includes(String(integration.name))),
      });
      this.sdk = mod;
      this.lastConfig = config;
      this.active = true;
    } catch (err) {
      log.error(LOG_MONITORING_INIT_FAILED, err);
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
   * Captures an exception with optional structured context.
   * @param {unknown} error - Any throwable value.
   * @param {MonitorContext} [context] - Tags/extras/user context.
   * @returns {string | undefined} Event id or undefined when inactive.
   */
  captureException(error: unknown, context?: MonitorContext): string | undefined {
    if (!this.active || !this.sdk) return undefined;
    try {
      return this.sdk.captureException(error, mapHint(context));
    } catch (err) {
      log.warn(LOG_MONITORING_CAPTURE_FAILED, err);
      return undefined;
    }
  }

  /**
   * Captures a message event.
   * @param {string} message - Message text.
   * @param {MonitoringLevel} [level] - Severity; defaults to 'error'.
   * @param {MonitorContext} [context] - Structured context.
   * @returns {string | undefined} Event id or undefined when inactive.
   */
  captureMessage(message: string, level?: MonitoringLevel, context?: MonitorContext): string | undefined {
    if (!this.active || !this.sdk) return undefined;
    try {
      return this.sdk.captureMessage(message, mapLevel(level), mapHint(context));
    } catch (err) {
      log.warn(LOG_MONITORING_CAPTURE_FAILED, err);
      return undefined;
    }
  }

  /**
   * Captures user-submitted feedback.
   * @param {MonitorFeedback} feedback - User's report.
   * @param {MonitorContext} [context] - Structured context.
   * @returns {string | undefined} Backend id or undefined when inactive.
   */
  captureFeedback(feedback: MonitorFeedback, context?: MonitorContext): string | undefined {
    if (!this.active || !this.sdk) return undefined;
    try {
      return this.sdk.captureFeedback({ message: feedback.message, name: feedback.name, email: feedback.email }, mapHint(context));
    } catch (err) {
      log.warn(LOG_MONITORING_CAPTURE_FAILED, err);
      return undefined;
    }
  }

  /**
   * Applies a global tag.
   * @param {string} key - Tag name.
   * @param {string} value - Tag value.
   * @returns {void}
   */
  setTag(key: string, value: string): void {
    if (!this.active || !this.sdk) return;
    try {
      this.sdk.setTag(key, value);
    } catch (err) {
      log.warn(LOG_MONITORING_CAPTURE_FAILED, err);
    }
  }

  /**
   * Sets/clears the acting user identity.
   * @param {MonitorUser | null} user - User info or null to clear.
   * @returns {void}
   */
  setUser(user: MonitorUser | null): void {
    if (!this.active || !this.sdk) return;
    try {
      this.sdk.setUser(user ? (mapUser(user) ?? null) : null);
    } catch (err) {
      log.warn(LOG_MONITORING_CAPTURE_FAILED, err);
    }
  }

  /**
   * Records a breadcrumb in the backend's trail.
   * @param {MonitorBreadcrumb} breadcrumb - Trail entry.
   * @returns {void}
   */
  addBreadcrumb(breadcrumb: MonitorBreadcrumb): void {
    if (!this.active || !this.sdk) return;
    try {
      this.sdk.addBreadcrumb({
        ...(breadcrumb.message !== undefined ? { message: breadcrumb.message } : {}),
        ...(breadcrumb.category !== undefined ? { category: breadcrumb.category } : {}),
        ...(breadcrumb.level !== undefined ? { level: breadcrumb.level } : {}),
        ...(breadcrumb.data !== undefined ? { data: breadcrumb.data } : {}),
        ...(breadcrumb.timestamp !== undefined ? { timestamp: breadcrumb.timestamp } : {}),
      });
    } catch (err) {
      log.warn(LOG_MONITORING_CAPTURE_FAILED, err);
    }
  }

  /**
   * Disables capturing at runtime (consent off). The renderer-side toggle is
   * driven by the facade; re-enabling re-initializes from stored config.
   * @param {boolean} enabled - Whether capturing should occur.
   * @returns {Promise<void>} Resolves after the transition settles.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled === this.active) return;
    if (enabled && this.lastConfig) {
      await this.init(this.lastConfig);
      return;
    }
    await this.close();
  }

  /**
   * Flushes queued events within the timeout.
   * @param {number} [timeoutMs] - Max milliseconds to wait (default 5000).
   * @returns {Promise<boolean>} True when flushed in time.
   */
  async flush(timeoutMs?: number): Promise<boolean> {
    if (!this.active || !this.sdk) return true;
    try {
      return await this.sdk.flush(timeoutMs ?? 5000);
    } catch (err) {
      log.warn(LOG_MONITORING_CAPTURE_FAILED, err);
      return false;
    }
  }

  /**
   * Shuts the renderer SDK down. Can be re-initialized afterwards.
   * @param {number} [timeoutMs] - Max milliseconds to wait (default 2000).
   * @returns {Promise<boolean>} True when closed cleanly.
   */
  async close(timeoutMs?: number): Promise<boolean> {
    if (!this.sdk) return true;
    try {
      return await this.sdk.close(timeoutMs ?? 2000);
    } catch (err) {
      log.warn(LOG_MONITORING_CLOSE_FAILED, err);
      return false;
    } finally {
      this.active = false;
      this.sdk = null;
    }
  }
}
