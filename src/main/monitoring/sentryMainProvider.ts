/**
 * @fileoverview Sentry adapter for the main process implementing the
 * provider-agnostic {@link MonitorProvider} contract.
 *
 * This is the ONLY module in the codebase allowed to import
 * `@sentry/electron/main`. Application code goes through the shared facade so
 * the backend can be swapped by writing another adapter and changing the
 * factory - no call sites change.
 *
 * Full-feature mode: error + global-handler capture, native crash minidumps,
 * performance tracing, renderer ANR (event-loop block) detection,
 * release-health sessions, screenshots attached to events, renderer profiling
 * header injection, and Spotlight debugging in development. The DSN never
 * leaves this process.
 *
 * The SDK is imported lazily inside {@link init} so the app runs fine when the
 * package is absent or unconfigured.
 */

import { Logger } from '../../shared/logger';
import {
  LOG_MONITORING_CAPTURE_FAILED,
  LOG_MONITORING_CLOSE_FAILED,
  LOG_MONITORING_INIT_FAILED,
  LOG_MONITORING_INITIALIZING,
} from '../../shared/log-constants';
import type {
  MonitorBreadcrumb,
  MonitorContext,
  MonitorFeedback,
  MonitoringConfig,
  MonitoringLevel,
  MonitorProvider,
  MonitorUser,
} from '../../shared/monitoring/types';

/** Per-module logger for the Sentry adapter. @const {Logger} */
const log = new Logger('main/monitoring/sentryMainProvider');

/**
 * Minimal structural type of the `@sentry/electron/main` module surface this
 * adapter uses. Declaring it locally keeps the file free of a static import
 * (the real module is loaded lazily) while still giving type safety.
 */
interface SentryMainSdk {
  init(options: Record<string, unknown>): void;
  captureException(error: unknown, hint?: Record<string, unknown>): string | undefined;
  captureMessage(message: string, level?: string, hint?: Record<string, unknown>): string | undefined;
  captureFeedback(feedback: { message: string; name?: string; email?: string }, hint?: Record<string, unknown>): string | undefined;
  setTag(key: string, value: string): void;
  setUser(user: Record<string, unknown> | null): void;
  addBreadcrumb(breadcrumb: Record<string, unknown>): void;
  /**
   * Renderer ANR detection: captures App Not Responding events from renderer
   * processes (the main-process `anrIntegration` is not part of the Electron
   * SDK's supported surface in v7).
   */
  rendererEventLoopBlockIntegration(options?: { captureNativeStacktrace?: boolean }): Record<string, unknown>;
  flush(timeout?: number): Promise<boolean>;
  close(timeout?: number): Promise<boolean>;
}

/**
 * Maps an optional {@link MonitorUser} to the backend's user record.
 * @param {MonitorUser | undefined} user - User info or undefined.
 * @returns {Record<string, unknown> | undefined} Backend user or undefined.
 */
function mapUser(user: MonitorUser | undefined): Record<string, unknown> | undefined {
  if (!user) return undefined;
  const mapped: Record<string, unknown> = {};
  if (user.id !== undefined) mapped.id = user.id;
  if (user.email !== undefined) mapped.email = user.email;
  if (user.username !== undefined) mapped.username = user.username;
  if (user.data !== undefined) mapped.data = user.data;
  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

/**
 * Maps facade-level context into the backend hint shape.
 * @param {MonitorContext | undefined} context - Structured context.
 * @returns {Record<string, unknown> | undefined} Hint object or undefined.
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
 * Sentry-backed monitoring provider for the Electron main process.
 * @class SentryMainProvider
 * @implements {MonitorProvider}
 */
export class SentryMainProvider implements MonitorProvider {
  /** Adapter identifier consumed by the factory/facade logs. @readonly */
  readonly name = 'sentry';

  /** Lazily loaded SDK module; null until init succeeds. @type {SentryMainSdk | null} */
  private sdk: SentryMainSdk | null = null;

  /** Whether the SDK accepted initialization. @type {boolean} */
  private active: boolean;

  /** Config used for the last successful init; enables re-init on toggle-on. @type {MonitoringConfig | null} */
  private lastConfig: MonitoringConfig | null;

  /**
   * Creates the provider in inactive state.
   */
  constructor() {
    this.active = false;
    this.lastConfig = null;
  }

  /**
   * Loads `@sentry/electron/main` dynamically.
   * @returns {Promise<SentryMainSdk>} The SDK module namespace.
   * @throws {Error} When the package cannot be resolved.
   */
  private async loadSdk(): Promise<SentryMainSdk> {
    return (await import('@sentry/electron/main')) as unknown as SentryMainSdk;
  }

  /**
   * Initializes Sentry for the main process with full-feature options.
   * @param {MonitoringConfig} config - Resolved config incl. DSN/env/release/consent/rates.
   * @returns {Promise<void>} Resolves once init options have been applied.
   */
  async init(config: MonitoringConfig): Promise<void> {
    log.info(LOG_MONITORING_INITIALIZING, this.name);
    if (!config.dsn) {
      throw new Error('SentryMainProvider requires a DSN');
    }
    const sdk = await this.loadSdk();

    const isDev = process.env.NODE_ENV === 'development';

    const options: Record<string, unknown> = {
      dsn: config.dsn,
      environment: config.environment ?? (isDev ? 'development' : 'production'),
      release: config.release,
      debug: config.debug ?? false,
      // Performance monitoring: trace all transactions unless overridden.
      tracesSampleRate: config.tracesSampleRate ?? 1.0,
      // Privacy: do not send cookies/headers by default.
      sendDefaultPii: false,
      // Attach a screenshot to JavaScript error events (opt-in upstream).
      attachScreenshot: true,
      // Inject 'js-profiling' document policy headers for renderer profiles.
      enableRendererProfiling: true,
      // Local round-trip debugging through Sentry Spotlight in dev only.
      ...(isDev && !config.release ? { spotlight: process.env.SENTRY_SPOTLIGHT_URL || true } : {}),
      integrations: (defaults: Array<Record<string, unknown>>) => {
        const list = [...defaults];
        // Renderer ANR (event-loop hang) detection with native call stacks.
        list.push(sdk.rendererEventLoopBlockIntegration({ captureNativeStacktrace: true }) as unknown as Record<string, unknown>);
        return list;
      },
    };

    sdk.init(options);
    this.sdk = sdk;
    this.lastConfig = config;
    this.active = true;
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
   * @returns {string | undefined} Sentry event id or undefined when inactive.
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
   * @returns {string | undefined} Sentry event id or undefined when inactive.
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
   * @returns {string | undefined} Sentry id or undefined when inactive.
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
   * Disables capturing at runtime by shutting down the client (consent off).
   * Re-enabling re-initializes from the stored configuration.
   * @param {boolean} enabled - Whether capturing should occur.
   * @returns {Promise<void>} Resolves after the transition settles.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled === this.active) return;
    if (!enabled) {
      await this.shutdown();
      return;
    }
    if (this.lastConfig) {
      await this.init(this.lastConfig);
    }
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
   * Shuts the SDK down, flushing first. The provider can be re-initialized.
   * @param {number} [timeoutMs] - Max milliseconds to wait (default 2000).
   * @returns {Promise<boolean>} True when closed cleanly.
   */
  async close(timeoutMs?: number): Promise<boolean> {
    if (!this.sdk) return true;
    try {
      const result = await this.sdk.close(timeoutMs ?? 2000);
      return result;
    } catch (err) {
      log.warn(LOG_MONITORING_CLOSE_FAILED, err);
      return false;
    } finally {
      this.active = false;
      this.sdk = null;
    }
  }

  /**
   * Internal shutdown helper used by setEnabled(false).
   * @returns {Promise<void>} Resolves after close attempt.
   */
  private async shutdown(): Promise<void> {
    await this.close();
  }
}
