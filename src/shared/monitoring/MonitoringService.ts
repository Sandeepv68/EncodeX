/**
 * @fileoverview Provider-agnostic monitoring facade (singleton).
 *
 * This module is the ONLY surface application code should use for error
 * monitoring and telemetry. It delegates to a {@link MonitorProvider} adapter
 * chosen at startup, keeping call sites free of any concrete backend
 * (Sentry today) knowledge so backends can be swapped by adding one adapter
 * file and changing the provider factory.
 *
 * Guarantees provided to callers:
 *  - Every method is safe to call before {@link initMonitoring} completes:
 *    calls are absorbed by an internal no-op provider.
 *  - No method ever throws; internal failures are logged via the shared
 *    Logger and swallowed so monitoring can never take the app down.
 *  - Consent is enforced centrally: when disabled, all captures become no-ops
 *    regardless of what the underlying adapter does.
 */

import { Logger, registerLoggerErrorSink } from '../logger';
import {
  LOG_MONITORING_CAPTURE_FAILED,
  LOG_MONITORING_CLOSE_FAILED,
  LOG_MONITORING_INIT_FAILED,
  LOG_MONITORING_INITIALIZING,
  LOG_MONITORING_PROVIDER_ACTIVE,
  LOG_MONITORING_SET_ENABLED,
} from '../log-constants';
import type {
  MonitorBreadcrumb,
  MonitorContext,
  MonitorFeedback,
  MonitoringConfig,
  MonitoringLevel,
  MonitorProvider,
  MonitorUser,
} from './types';
import { NoopProvider } from './noopProvider';

/** Per-module logger for the monitoring facade. @const {Logger} */
const log = new Logger('shared/monitoring');

/**
 * Factory that resolves the concrete provider for a given configuration.
 * Returning `undefined`/`null` selects the no-op fallback.
 * @param {MonitoringConfig} config - Resolved startup configuration.
 * @returns {MonitorProvider | undefined | null} The adapter to activate.
 */
export type MonitorProviderFactory = (config: MonitoringConfig) => MonitorProvider | undefined | null;

/** Currently active provider; never undefined after module load. @type {MonitorProvider} */
let activeProvider: MonitorProvider = new NoopProvider();

/** Whether init has completed successfully at least once. @type {boolean} */
let initialized = false;

/** Last accepted configuration, retained for consent re-enable re-inits. @type {MonitoringConfig | null} */
let lastConfig: MonitoringConfig | null = null;

/** Factory used during the last successful init, for re-enable flows. @type {MonitorProviderFactory | null} */
let lastFactory: MonitorProviderFactory | null = null;

/**
 * Swaps the active provider safely: closes the previous backend best-effort,
 * installs the next one, and downgrades any failure to a warning log.
 * @param {MonitorProvider} next - Provider to install as active.
 * @returns {Promise<void>} Resolves once the swap attempt has finished.
 */
async function swapProvider(next: MonitorProvider): Promise<void> {
  const previous = activeProvider;
  activeProvider = next;
  if (previous !== next && typeof previous.close === 'function') {
    try {
      await previous.close();
    } catch (err) {
      log.warn(LOG_MONITORING_CLOSE_FAILED, err);
    }
  }
}

/**
 * Initializes application monitoring with the given configuration.
 *
 * When `config.enabled` is false (user consent withdrawn) no backend is
 * started at all - the facade stays on its no-op path until a later
 * {@link setMonitoringEnabled}(true) re-runs this flow with the stored
 * factory.
 *
 * @param {MonitoringConfig} config - Startup configuration incl. DSN/env/release/consent.
 * @param {MonitorProviderFactory} [resolveProvider] - Factory selecting the concrete adapter;
 *   omitted or null-returning factories fall back to the no-op provider.
 * @returns {Promise<void>} Resolves when initialization attempts have settled.
 */
export async function initMonitoring(config: MonitoringConfig, resolveProvider?: MonitorProviderFactory): Promise<void> {
  try {
    log.info(LOG_MONITORING_INITIALIZING, config.provider ?? 'auto', `enabled=${String(config.enabled)}`);
    lastConfig = config;
    lastFactory = resolveProvider ?? null;

    if (!config.enabled) {
      await swapProvider(new NoopProvider(false));
      return;
    }

    let provider: MonitorProvider | undefined | null;
    try {
      provider = resolveProvider ? resolveProvider(config) : undefined;
      if (provider && typeof provider.init === 'function') {
        await provider.init(config);
      } else {
        provider = new NoopProvider(true);
      }
    } catch (err) {
      log.error(LOG_MONITORING_INIT_FAILED, err);
      provider = new NoopProvider(true);
    }

    await swapProvider(provider);
    initialized = true;
    log.info(LOG_MONITORING_PROVIDER_ACTIVE, activeProvider.name);
  } catch (err) {
    // Absolute safety net: monitoring must never break bootstrap.
    log.error(LOG_MONITORING_INIT_FAILED, err);
  }
}

/**
 * Toggles capturing at runtime (user consent switch).
 *
 * Disabling closes the active backend and swaps in a no-op so even automatic
 * instrumentation stops reporting. Re-enabling re-runs the stored factory +
 * configuration from startup.
 *
 * @param {boolean} enabled - Whether events should be captured again.
 * @returns {Promise<void>} Resolves when the transition settles.
 */
export async function setMonitoringEnabled(enabled: boolean): Promise<void> {
  log.info(LOG_MONITORING_SET_ENABLED, String(enabled));
  try {
    if (!enabled) {
      await swapProvider(new NoopProvider(false));
      return;
    }
    if (!lastConfig || !lastFactory) {
      // Nothing configured yet; stay noop but record intent via enabled flag.
      await swapProvider(new NoopProvider(true));
      return;
    }
    await initMonitoring({ ...lastConfig, enabled: true }, lastFactory);
  } catch (err) {
    log.warn(LOG_MONITORING_SET_ENABLED, 'transition failed:', err);
  }
}

/**
 * @returns {boolean} Whether a real (non-noop) backend is currently active.
 */
export function isMonitoringEnabled(): boolean {
  return activeProvider.isEnabled();
}

/**
 * @returns {string} Name of the currently active adapter ('noop' before init).
 */
export function getMonitoringBackendName(): string {
  return activeProvider.name;
}

/**
 * Captures an exception through the active provider. Never throws.
 * @param {unknown} error - Any throwable value.
 * @param {MonitorContext} [context] - Optional tags/extras/user context.
 * @returns {string | undefined} Backend event id when captured, else undefined.
 */
export function captureException(error: unknown, context?: MonitorContext): string | undefined {
  try {
    return activeProvider.captureException(error, context);
  } catch (err) {
    log.debug(LOG_MONITORING_CAPTURE_FAILED, err);
    return undefined;
  }
}

/**
 * Captures a textual message through the active provider. Never throws.
 * @param {string} message - Message text.
 * @param {MonitoringLevel} [level] - Severity; defaults per provider ('error').
 * @param {MonitorContext} [context] - Optional structured context.
 * @returns {string | undefined} Backend event id when captured, else undefined.
 */
export function captureMessage(message: string, level?: MonitoringLevel, context?: MonitorContext): string | undefined {
  try {
    return activeProvider.captureMessage(message, level, context);
  } catch (err) {
    log.debug(LOG_MONITORING_CAPTURE_FAILED, err);
    return undefined;
  }
}

/**
 * Captures user-submitted feedback through the active provider. Never throws.
 * @param {MonitorFeedback} feedback - User's report content.
 * @param {MonitorContext} [context] - Optional structured context.
 * @returns {string | undefined} Backend id when captured, else undefined.
 */
export function captureUserFeedback(feedback: MonitorFeedback, context?: MonitorContext): string | undefined {
  try {
    return activeProvider.captureFeedback(feedback, context);
  } catch (err) {
    log.debug(LOG_MONITORING_CAPTURE_FAILED, err);
    return undefined;
  }
}

/**
 * Applies a process-wide tag to subsequent events. Never throws.
 * @param {string} key - Tag name.
 * @param {string} value - Tag value.
 * @returns {void}
 */
export function setMonitoringTag(key: string, value: string): void {
  try {
    activeProvider.setTag(key, value);
  } catch (err) {
    log.debug(LOG_MONITORING_CAPTURE_FAILED, err);
  }
}

/**
 * Sets or clears the acting user identity. Never throws.
 * @param {MonitorUser | null} user - User info or null to clear.
 * @returns {void}
 */
export function setMonitoringUser(user: MonitorUser | null): void {
  try {
    activeProvider.setUser(user);
  } catch (err) {
    log.debug(LOG_MONITORING_CAPTURE_FAILED, err);
  }
}

/**
 * Records a breadcrumb describing something that just happened. Never throws.
 * @param {MonitorBreadcrumb} breadcrumb - Trail entry.
 * @returns {void}
 */
export function addMonitoringBreadcrumb(breadcrumb: MonitorBreadcrumb): void {
  try {
    activeProvider.addBreadcrumb(breadcrumb);
  } catch (err) {
    log.debug(LOG_MONITORING_CAPTURE_FAILED, err);
  }
}

/**
 * Flushes queued backend events within the timeout. Never rejects.
 * @param {number} [timeoutMs] - Max milliseconds to wait.
 * @returns {Promise<boolean>} True when flushed cleanly (noop => true).
 */
export async function flushMonitoring(timeoutMs?: number): Promise<boolean> {
  try {
    if (typeof activeProvider.flush === 'function') return await activeProvider.flush(timeoutMs);
    return true;
  } catch (err) {
    log.debug(LOG_MONITORING_CAPTURE_FAILED, err);
    return false;
  }
}

/**
 * Shuts monitoring down, flushing pending events first. Used on app quit.
 * Never rejects.
 * @param {number} [timeoutMs] - Max milliseconds to wait.
 * @returns {Promise<boolean>} True when closed cleanly (noop => true).
 */
export async function closeMonitoring(timeoutMs?: number): Promise<boolean> {
  try {
    const result = typeof activeProvider.close === 'function' ? await activeProvider.close(timeoutMs) : true;
    initialized = false;
    await swapProvider(new NoopProvider(false));
    return result;
  } catch (err) {
    log.warn(LOG_MONITORING_CLOSE_FAILED, err);
    return false;
  }
}

/**
 * Resets all facade state to pristine defaults. Intended for unit tests only;
 * production code must not call this.
 * @returns {void}
 */
export function resetMonitoringForTests(): void {
  activeProvider = new NoopProvider();
  initialized = false;
  lastConfig = null;
  lastFactory = null;
}

/**
 * Test-only accessor exposing which adapter is currently active.
 * Production code must rely on behavior, not identity.
 * @returns {MonitorProvider} The active provider instance.
 */
export function getActiveMonitorProviderForTests(): MonitorProvider {
  return activeProvider;
}

/**
 * @returns {boolean} Whether init completed successfully at least once.
 */
export function isMonitoringInitialized(): boolean {
  return initialized;
}

/**
 * Bridges ERROR-level application logs into the active backend so issues
 * developers see in the app console surface in the provider's issue feed.
 * Skipped while monitoring is uninitialized or consent is off (the active
 * provider reports disabled), and guarded against re-entrancy so a capture
 * that itself logs can never recurse. Errors passed as `Error` instances are
 * reported with full stack traces; anything else becomes a message event.
 */
let bridgingLogError = false;
registerLoggerErrorSink((context, args) => {
  if (!initialized || bridgingLogError || !activeProvider.isEnabled()) return;
  bridgingLogError = true;
  try {
    const errorArg = args.find((arg) => arg instanceof Error);
    if (errorArg) {
      captureException(errorArg, { tags: { handler: 'logger-error' }, extra: { loggerContext: context } });
    } else {
      captureMessage(`${context}: ${args.map((arg) => String(arg)).join(' ')}`, 'error', {
        tags: { handler: 'logger-error' },
        extra: { loggerContext: context },
      });
    }
  } finally {
    bridgingLogError = false;
  }
});
