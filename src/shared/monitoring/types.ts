/**
 * @fileoverview Provider-agnostic monitoring contracts for the application.
 *
 * These types define the "port" of a ports-and-adapters design for error
 * monitoring and telemetry. Application code depends only on the
 * {@link MonitorProvider} interface (via the `monitor` facade) and never on a
 * concrete backend such as Sentry. Swapping backends means implementing this
 * interface once and registering it with the provider factory - no call sites
 * change.
 *
 * Everything defined here must be serializable-safe where it crosses process
 * boundaries (renderer -> main), so contexts avoid class instances, Maps,
 * Sets, functions, or circular structures.
 */

/**
 * Severity levels understood by every monitoring provider. Mirrors common
 * backend conventions (e.g. Sentry's severity scale).
 * @enum {string} MonitoringLevel - Ordered from least to most severe.
 */
export type MonitoringLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

/**
 * Identity information attached to captured events.
 * All fields are optional; providers map these onto their native user model.
 */
export interface MonitorUser {
  /** Stable application-specific user identifier (avoid PII). */
  id?: string;
  /** User email address. Only set when explicitly provided by the user. */
  email?: string;
  /** Human-readable display name. */
  username?: string;
  /** Provider-specific additional fields (kept as plain values). */
  data?: Record<string, unknown>;
}

/**
 * Structured context attached to a single captured event.
 * `tags` are indexed key/value pairs for search & aggregation; `extra` is
 * unindexed diagnostic payload. Values must be JSON-serializable.
 */
export interface MonitorContext {
  /** Indexed tags for filtering/grouping (e.g. `{ page: 'convert' }`). */
  tags?: Record<string, string>;
  /** Unindexed diagnostic data (e.g. `{ filePath: '...' }`). */
  extra?: Record<string, unknown>;
  /** User identity to associate with the event. */
  user?: MonitorUser;
}

/**
 * A breadcrumb: a short trace of an event that happened before an error,
 * giving providers a timeline leading up to a failure.
 */
export interface MonitorBreadcrumb {
  /** Human readable description of the event. */
  message?: string;
  /** Dot-namespaced category, e.g. 'ipc', 'ui.click', 'queue'. */
  category?: string;
  /** Severity of the breadcrumb itself. Defaults to provider convention. */
  level?: MonitoringLevel;
  /** Arbitrary serializable metadata for the event. */
  data?: Record<string, unknown>;
  /** Epoch milliseconds of the event; defaults to now. */
  timestamp?: number;
}

/**
 * User-submitted feedback, typically attached to an error dialog flow or
 * collected after a crash report.
 */
export interface MonitorFeedback {
  /** The feedback message supplied by the user. */
  message: string;
  /** Optional display name of the reporter. */
  name?: string;
  /** Optional contact email of the reporter. */
  email?: string;
  /** Optional URL/identifier associating feedback with an event. */
  url?: string;
}

/**
 * Configuration accepted by {@link MonitorProvider.init}. Providers ignore
 * fields they do not understand so new options can be added without breaking
 * existing adapters.
 */
export interface MonitoringConfig {
  /**
   * Explicit provider selection ('sentry' | 'noop' today). When omitted the
   * host factory auto-detects from other config (e.g. DSN presence).
   */
  provider?: string;
  /** Backend endpoint / project key. Absent usually means "disabled". */
  dsn?: string;
  /** Environment label, e.g. 'development' | 'production'. */
  environment?: string;
  /** Release identifier, typically the app version. */
  release?: string;
  /** Master switch reflecting user consent. Providers must respect it. */
  enabled: boolean;
  /** Verbose SDK diagnostics for local debugging. */
  debug?: boolean;
  /** Fraction [0..1] of transactions traced for performance monitoring. */
  tracesSampleRate?: number;
  /** Fraction [0..1] of sampled transactions additionally profiled. */
  profilesSampleRate?: number;
}

/**
 * The contract every monitoring backend adapter must implement.
 *
 * Implementations MUST be defensive: they are invoked from error paths and
 * must not throw. The facade also guards calls, but adapters should uphold
 * the same guarantee themselves.
 */
export interface MonitorProvider {
  /** Identifier of this adapter, e.g. 'noop' or 'sentry'. */
  readonly name: string;

  /**
   * Initializes the backend. Called once at application startup (per process)
   * before any capture methods are expected to work.
   * @param {MonitoringConfig} config - Resolved configuration incl. consent.
   */
  init(config: MonitoringConfig): void | Promise<void>;

  /**
   * Captures an exception/error.
   * @param {unknown} error - Any throwable value (Error, string, unknown).
   * @param {MonitorContext} [context] - Optional tags/extras/user context.
   * @returns {string | undefined} Backend event id, if one was generated.
   */
  captureException(error: unknown, context?: MonitorContext): string | undefined;

  /**
   * Captures a textual message as an event.
   * @param {string} message - Message text.
   * @param {MonitoringLevel} [level] - Severity; defaults to 'error'.
   * @param {MonitorContext} [context] - Optional structured context.
   * @returns {string | undefined} Backend event id, if one was generated.
   */
  captureMessage(message: string, level?: MonitoringLevel, context?: MonitorContext): string | undefined;

  /**
   * Captures user-submitted feedback.
   * @param {MonitorFeedback} feedback - The user's report.
   * @param {MonitorContext} [context] - Optional structured context.
   * @returns {string | undefined} Backend id, if one was generated.
   */
  captureFeedback(feedback: MonitorFeedback, context?: MonitorContext): string | undefined;

  /**
   * Applies a global tag to all subsequent events in this process.
   * @param {string} key - Tag name.
   * @param {string} value - Tag value.
   */
  setTag(key: string, value: string): void;

  /**
   * Sets (or clears with null) the acting user identity.
   * @param {MonitorUser | null} user - User info or null to clear.
   */
  setUser(user: MonitorUser | null): void;

  /**
   * Records a breadcrumb describing something that just happened.
   * @param {MonitorBreadcrumb} breadcrumb - The trail entry.
   */
  addBreadcrumb(breadcrumb: MonitorBreadcrumb): void;

  /**
   * Enables/disables capturing at runtime (user consent toggle). Disabling
   * must stop ALL future captures including automatically instrumented ones.
   * @param {boolean} enabled - Whether capturing should occur.
   */
  setEnabled(enabled: boolean): void | Promise<void>;

  /**
   * @returns {boolean} Whether the provider is initialized and accepting events.
   */
  isEnabled(): boolean;

  /**
   * Flushes queued events within the timeout.
   * @param {number} [timeoutMs] - Max time to wait in milliseconds.
   * @returns {Promise<boolean>} True when everything was sent in time.
   */
  flush?(timeoutMs?: number): Promise<boolean>;

  /**
   * Shuts the backend down, flushing pending events first. After close the
   * provider may be re-initialized via {@link init}.
   * @param {number} [timeoutMs] - Max time to wait in milliseconds.
   * @returns {Promise<boolean>} True when shutdown completed cleanly.
   */
  close?(timeoutMs?: number): Promise<boolean>;
}
