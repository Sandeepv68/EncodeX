/**
 * @fileoverview Type definitions for the analytics provider abstraction layer.
 * Defines the AnalyticsProvider interface contract that every analytics backend
 * must implement, and the AnalyticsConfig shape passed during initialization.
 *
 * The interface lives in src/shared so both the main and renderer processes can
 * import it. Concrete implementations (Aptabase, noop) are process-specific
 * and live in sibling files.
 */

/**
 * Contract implemented by all analytics provider backends.
 *
 * A provider receives a configuration during initialization, then accepts
 * fire-and-forget track calls with an event name and optional properties.
 * Shutdown is called on app quit to allow providers to flush buffered events.
 *
 * @interface AnalyticsProvider
 */
export interface AnalyticsProvider {
  /**
   * Initializes the provider with the given configuration. Must be called
   * once before any track calls.
   * @param {AnalyticsConfig} config - Provider configuration (app key, version, debug flag).
   */
  initialize(config: AnalyticsConfig): void;

  /**
   * Tracks an analytics event with optional properties. Runs in the
   * background; callers must not await the result.
   * @param {string} eventName - Name of the event to track.
   * @param {Record<string, string | number>} [properties] - Optional event properties.
   */
  track(eventName: string, properties?: Record<string, string | number>): void;

  /**
   * Flushes buffered events and releases resources. Called on app quit.
   */
  shutdown(): void;
}

/**
 * Configuration passed to an analytics provider during initialization.
 * @interface AnalyticsConfig
 * @property {string} appKey - The Aptabase (or equivalent) project app key.
 * @property {string} appVersion - The application version string.
 * @property {boolean} isDebug - Whether the app is running in debug mode.
 */
export interface AnalyticsConfig {
  appKey: string;
  appVersion: string;
  isDebug: boolean;
}
