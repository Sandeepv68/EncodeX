/**
 * @fileoverview Provider-agnostic product-analytics facade (singleton).
 *
 * This module is the ONLY surface application code uses to record
 * product-analytics events. It delegates to an {@link AnalyticsProvider}
 * adapter chosen at startup, keeping call sites free of any concrete backend
 * (Aptabase today) knowledge so backends can be swapped by adding one adapter
 * file and changing the provider factory.
 *
 * The taxonomy lives in {@link events.ts}; this module routes typed events to
 * the active provider. Design (documented in `plans/APTABASE_ANALYTICS_PLAN.md`):
 *  - **Provider-agnostic.** Events ride a dedicated analytics channel owned by
 *    whichever provider the factory resolved (Aptabase by default); the old
 *    breadcrumb coupling to the monitoring facade is gone.
 *  - **Consent is central.** When the user disabled telemetry
 *    (`analytics-consent.json` -> `{"enabled": false}`) every track is a
 *    no-op, so `recordAnalyticsEvent` emits nothing.
 *  - **Zero PII by construction.** Payloads are constrained by the taxonomy in
 *    `events.ts` (categorical values only) and are JSON-serializable.
 *  - **Never throws.** Analytics must never take the app down; all failures are
 *    swallowed and logged.
 *  - **Journey badge.** An optional `ctx.route` / `ctx.jobKind` pair (set from
 *    the last `tool_opened`) is stamped onto outgoing props so per-journey
 *    breakdowns stay correct even if a call site forgets a prop.
 *
 * Guarantees provided to callers (mirrors `MonitoringService`):
 *  - Every method is safe to call before {@link initAnalytics} completes:
 *    calls are absorbed by an internal no-op provider.
 *  - No method ever throws.
 *  - Consent is enforced centrally: when disabled, all tracks become no-ops.
 *
 * The class form is used to keep `AnalyticsService` a stable, mockable unit in
 * tests while the module also exports a shared default instance.
 */

import { Logger } from '../logger';
import {
  LOG_ANALYTICS_CLOSE_FAILED,
  LOG_ANALYTICS_FLUSH_FAILED,
  LOG_ANALYTICS_INIT_FAILED,
  LOG_ANALYTICS_INITIALIZING,
  LOG_ANALYTICS_PROVIDER_ACTIVE,
  LOG_ANALYTICS_SET_ENABLED,
  LOG_ANALYTICS_TRACK_FAILED,
} from '../log-constants';
import type { AnalyticsEvent } from './events';
import { NoopProvider } from './noopProvider';
import type { AnalyticsConfig, AnalyticsProvider, AnalyticsProviderFactory } from './types';

/** Per-module logger for the analytics facade. @const {Logger} */
const log = new Logger('shared/analytics');

/** Currently active provider; never undefined after module load. @type {AnalyticsProvider} */
let activeProvider: AnalyticsProvider = new NoopProvider();

/** Whether init has completed successfully at least once. @type {boolean} */
let initialized = false;

/** Whether {@link initAnalytics} was called at least once (consent decided). @type {boolean} */
let bootstrapped = false;

/** Events recorded before bootstrap resolves; replayed on successful init. @type {AnalyticsEvent[]} */
let preInitBuffer: AnalyticsEvent[] = [];

/** Cap on buffered pre-init events so a boot-loop can never grow unboundedly. @const {number} */
const PRE_INIT_BUFFER_LIMIT = 100;

/** Last accepted configuration, retained for consent re-enable re-inits. @type {AnalyticsConfig | null} */
let lastConfig: AnalyticsConfig | null = null;

/** Factory used during the last successful init, for re-enable flows. @type {AnalyticsProviderFactory | null} */
let lastFactory: AnalyticsProviderFactory | null = null;

/** Active journey badge stamped onto every outgoing event (see §5.3 of the plan). @type {{route?: string, jobKind?: string}} */
let activeBadge: { route?: string; jobKind?: string } = {};

/**
 * Swaps the active provider safely: closes the previous backend best-effort,
 * installs the next one, and downgrades any failure to a warning log.
 * @param {AnalyticsProvider} next - Provider to install as active.
 * @returns {Promise<void>} Resolves once the swap attempt has finished.
 */
async function swapProvider(next: AnalyticsProvider): Promise<void> {
  const previous = activeProvider;
  activeProvider = next;
  if (previous !== next && typeof previous.close === 'function') {
    try {
      await previous.close();
    } catch (err) {
      log.warn(LOG_ANALYTICS_CLOSE_FAILED, err);
    }
  }
}

/**
 * Initializes application analytics with the given configuration.
 *
 * When `config.enabled` is false (user consent withdrawn) no backend is
 * started at all - the facade stays on its no-op path until a later
 * {@link setAnalyticsEnabled}(true) re-runs this flow with the stored factory.
 *
 * @param {AnalyticsConfig} config - Startup configuration incl. consent.
 * @param {AnalyticsProviderFactory} [resolveProvider] - Factory selecting the
 *   concrete adapter; omitted or null-returning factories fall back to the
 *   no-op provider.
 * @returns {Promise<void>} Resolves when initialization attempts have settled.
 */
export async function initAnalytics(config: AnalyticsConfig, resolveProvider?: AnalyticsProviderFactory): Promise<void> {
  try {
    log.info(LOG_ANALYTICS_INITIALIZING, config.provider ?? 'auto', `enabled=${String(config.enabled)}`);
    bootstrapped = true;
    lastConfig = config;
    lastFactory = resolveProvider ?? null;

    if (!config.enabled) {
      await swapProvider(new NoopProvider(false));
      return;
    }

    let provider: AnalyticsProvider | undefined | null;
    try {
      provider = resolveProvider ? resolveProvider(config) : undefined;
      if (provider && typeof provider.init === 'function') {
        await provider.init(config);
      } else {
        provider = new NoopProvider(true);
      }
    } catch (err) {
      log.error(LOG_ANALYTICS_INIT_FAILED, err);
      provider = new NoopProvider(true);
    }

    await swapProvider(provider);
    initialized = true;
    drainPreInitBuffer();
    log.info(LOG_ANALYTICS_PROVIDER_ACTIVE, activeProvider.name);
  } catch (err) {
    // Absolute safety net: analytics must never break bootstrap.
    log.error(LOG_ANALYTICS_INIT_FAILED, err);
  }
}

/**
 * Replays events buffered before {@link initAnalytics} settled (e.g.
 * `cli_invoked` recorded at module load) against the freshly activated
 * provider. Never throws.
 * @returns {void}
 */
function drainPreInitBuffer(): void {
  if (preInitBuffer.length === 0) return;
  const buffered = preInitBuffer;
  preInitBuffer = [];
  for (const event of buffered) {
    try {
      activeProvider.track(badgeEvent(event));
    } catch (err) {
      log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
    }
  }
}

/**
 * Toggles recording at runtime (user consent switch).
 *
 * Disabling closes the active backend and swaps in a no-op so even buffered
 * instrumentation stops reporting. Re-enabling re-runs the stored factory +
 * configuration from startup.
 *
 * @param {boolean} enabled - Whether events should be recorded again.
 * @returns {Promise<void>} Resolves when the transition settles.
 */
export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  log.info(LOG_ANALYTICS_SET_ENABLED, String(enabled));
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
    await initAnalytics({ ...lastConfig, enabled: true }, lastFactory);
  } catch (err) {
    log.warn(LOG_ANALYTICS_SET_ENABLED, 'transition failed:', err);
  }
}

/**
 * @returns {boolean} Whether a real (non-noop) backend is currently active.
 */
export function isAnalyticsEnabled(): boolean {
  return activeProvider.isEnabled();
}

/**
 * @returns {string} Name of the currently active adapter ('noop' before init).
 */
export function getAnalyticsBackendName(): string {
  return activeProvider.name;
}

/**
 * Sets the journey badge that is stamped onto every subsequent event as
 * `ctx.route` / `ctx.jobKind` (derived from the last `tool_opened`). Pass an
 * empty object to clear it. Never throws.
 * @param {{route?: string, jobKind?: string}} context - Active journey context.
 * @returns {void}
 */
export function setAnalyticsContext(context: { route?: string; jobKind?: string }): void {
  activeBadge = context;
}

/**
 * Merges the active journey badge into an event's props using flat, dotted
 * keys (`ctx.route`, `ctx.jobKind`) so providers with string-key props accept
 * them while they stay grep-able and never collide with taxonomy fields.
 * @param {AnalyticsEvent} event - The original typed event.
 * @returns {AnalyticsEvent} A copy carrying the stamped badge (when set).
 */
function badgeEvent(event: AnalyticsEvent): AnalyticsEvent {
  const route = activeBadge.route;
  const jobKind = activeBadge.jobKind;
  if (route === undefined && jobKind === undefined) return event;
  const stamped: Record<string, string> = {};
  if (route !== undefined) stamped['ctx.route'] = route;
  if (jobKind !== undefined) stamped['ctx.jobKind'] = jobKind;
  // Stamped keys are plain string props (Aptabase-compatible); cast through
  // the union because the taxonomy cannot statically name the dotted keys.
  return { ...event, props: { ...event.props, ...stamped } as AnalyticsEvent['props'] };
}

/**
 * Records a typed product event through the active provider. Respects
 * telemetry consent implicitly (disabled => no-op). Never throws.
 * @param {AnalyticsEvent} event - A taxa-validated event (see `events.ts`).
 * @returns {void}
 */
export function trackAnalyticsEvent(event: AnalyticsEvent): void {
  try {
    if (!bootstrapped) {
      // Pre-bootstrap (e.g. `cli_invoked` at module load): buffer, then replay
      // on successful init. Consent-off events (bootstrapped=true) are always
      // dropped, never buffered and replayed after an opt-in.
      if (preInitBuffer.length < PRE_INIT_BUFFER_LIMIT) preInitBuffer.push(event);
      return;
    }
    if (!activeProvider.isEnabled()) return;
    activeProvider.track(badgeEvent(event));
    log.debug('analytics event:', event.name, JSON.stringify(event.props));
  } catch (err) {
    log.debug(LOG_ANALYTICS_TRACK_FAILED, err);
  }
}

/**
 * Flushes queued backend events within the timeout. Never rejects.
 * @param {number} [timeoutMs] - Max milliseconds to wait.
 * @returns {Promise<boolean>} True when flushed cleanly (noop => true).
 */
export async function flushAnalytics(timeoutMs?: number): Promise<boolean> {
  try {
    if (typeof activeProvider.flush === 'function') return await activeProvider.flush(timeoutMs);
    return true;
  } catch (err) {
    log.debug(LOG_ANALYTICS_FLUSH_FAILED, err);
    return false;
  }
}

/**
 * Shuts analytics down, draining pending events first. Used on app quit.
 * Never rejects.
 * @param {number} [timeoutMs] - Max milliseconds to wait.
 * @returns {Promise<boolean>} True when closed cleanly (noop => true).
 */
export async function closeAnalytics(timeoutMs?: number): Promise<boolean> {
  try {
    const result = typeof activeProvider.close === 'function' ? await activeProvider.close(timeoutMs) : true;
    initialized = false;
    await swapProvider(new NoopProvider(false));
    return result;
  } catch (err) {
    log.warn(LOG_ANALYTICS_CLOSE_FAILED, err);
    return false;
  }
}

/**
 * Resets all facade state to pristine defaults. Intended for unit tests only;
 * production code must not call this.
 * @returns {void}
 */
export function resetAnalyticsForTests(): void {
  activeProvider = new NoopProvider();
  initialized = false;
  bootstrapped = false;
  preInitBuffer = [];
  lastConfig = null;
  lastFactory = null;
  activeBadge = {};
}

/**
 * Test-only accessor exposing which adapter is currently active.
 * Production code must rely on behavior, not identity.
 * @returns {AnalyticsProvider} The active provider instance.
 */
export function getActiveAnalyticsProviderForTests(): AnalyticsProvider {
  return activeProvider;
}

/**
 * @returns {boolean} Whether init completed successfully at least once.
 */
export function isAnalyticsInitialized(): boolean {
  return initialized;
}

/**
 * The product-analytics facade. Application code should use the exported
 * singleton {@link analyticsService} instead of constructing its own instance.
 */
export class AnalyticsService {
  /**
   * Records a typed product event through the active provider. Respects
   * telemetry consent implicitly (disabled => no-op). Never throws.
   *
   * @param {AnalyticsEvent} event - A taxa-validated event (see `events.ts`).
   * @returns {void}
   */
  recordEvent(event: AnalyticsEvent): void {
    trackAnalyticsEvent(event);
  }
}

/** Shared analytics facade instance used across the application. @type {AnalyticsService} */
export const analyticsService = new AnalyticsService();

/**
 * Convenience helper for call sites that want a one-liner:
 * `recordAnalyticsEvent(createAnalyticsEvent('app_launched', {...}))`.
 * @param {AnalyticsEvent} event - The typed event to record.
 * @returns {void}
 */
export function recordAnalyticsEvent(event: AnalyticsEvent): void {
  analyticsService.recordEvent(event);
}
