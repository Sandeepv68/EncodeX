/**
 * @fileoverview Provider-agnostic product-analytics contracts for the application.
 *
 * These types define the "port" of a ports-and-adapters design for usage
 * analytics. Application code depends only on the {@link AnalyticsProvider}
 * interface (via the `analyticsService` facade in `AnalyticsService.ts`) and
 * never on a concrete backend such as Aptabase. Swapping backends means
 * implementing this interface once and registering it with the provider
 * factory - no call sites change.
 *
 * The contract mirrors the monitoring contracts in
 * `src/shared/monitoring/types.ts`: adapters are defensive (never throw),
 * consent is enforced centrally by the facade, and everything that crosses
 * process boundaries stays JSON-serializable.
 */

import type { AnalyticsEvent } from './events';

/**
 * State exposed to the renderer about the analytics subsystem.
 */
export interface AnalyticsState {
  /** Whether usage analytics are consented/enabled for this installation. */
  enabled: boolean;
  /** Active backend adapter name in main ('aptabase' | 'noop'), so the
   *  renderer initializes its matching counterpart or stays idle. */
  backend: string;
}

/**
 * Configuration accepted by {@link AnalyticsProvider.init}. Providers ignore
 * fields they do not understand so new options can be added without breaking
 * existing adapters.
 */
export interface AnalyticsConfig {
  /**
   * Explicit provider selection ('aptabase' | 'noop' today). When omitted the
   * host factory auto-detects from other config (e.g. App Key presence).
   */
  provider?: string;
  /** Backend project key (`A-{US|EU|DEV|SH}-...` for Aptabase). Absent
   *  usually means "disabled". Kept main-process only by design - the
   *  renderer never receives it. */
  appKey?: string;
  /** Custom ingest endpoint; required only for self-hosted (`A-SH-*`) keys. */
  host?: string;
  /** Master switch reflecting user consent. Providers must respect it. */
  enabled: boolean;
  /** Environment label, e.g. 'development' | 'production'. */
  environment?: string;
  /** Release identifier, typically the app version. */
  release?: string;
  /** Verbose SDK diagnostics for local debugging. */
  debug?: boolean;
}

/**
 * The contract every analytics backend adapter must implement.
 *
 * Implementations MUST be defensive: they are invoked from application paths
 * that must never crash, so adapters must not throw. The facade also guards
 * calls, but adapters should uphold the same guarantee themselves.
 */
export interface AnalyticsProvider {
  /** Identifier of this adapter, e.g. 'noop' or 'aptabase'. */
  readonly name: string;

  /**
   * Initializes the backend. Called once at application startup (per process)
   * before any {@link track} calls are expected to work.
   * @param {AnalyticsConfig} config - Resolved configuration incl. consent.
   */
  init(config: AnalyticsConfig): void | Promise<void>;

  /**
   * Records a single, already-taxonomy-validated event.
   * @param {AnalyticsEvent} event - A typed event (see `events.ts`).
   */
  track(event: AnalyticsEvent): void | Promise<void>;

  /**
   * Enables/disables recording at runtime (user consent toggle). Disabling
   * must stop ALL future tracks, including any buffered internal events.
   * @param {boolean} enabled - Whether recording should occur.
   */
  setEnabled(enabled: boolean): void | Promise<void>;

  /**
   * @returns {boolean} Whether the provider is initialized and accepting events.
   */
  isEnabled(): boolean;

  /**
   * Flushes queued/buffered events within the timeout.
   * @param {number} [timeoutMs] - Max time to wait in milliseconds.
   * @returns {Promise<boolean>} True when everything was sent in time.
   */
  flush?(timeoutMs?: number): Promise<boolean>;

  /**
   * Shuts the backend down, draining pending events first. After close the
   * provider may be re-initialized via {@link init}.
   * @param {number} [timeoutMs] - Max time to wait in milliseconds.
   * @returns {Promise<boolean>} True when shutdown completed cleanly.
   */
  close?(timeoutMs?: number): Promise<boolean>;
}

/**
 * Factory that resolves the concrete provider for a given configuration.
 * Returning `undefined`/`null` selects the no-op fallback.
 * @param {AnalyticsConfig} config - Resolved startup configuration.
 * @returns {AnalyticsProvider | undefined | null} The adapter to activate.
 */
export type AnalyticsProviderFactory = (config: AnalyticsConfig) => AnalyticsProvider | undefined | null;
