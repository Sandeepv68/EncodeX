/**
 * @fileoverview Type definitions for the usage-analytics layer.
 * Describes the on-disk shape of the analytics consent document that the
 * bootstrap paths read before any renderer exists.
 */

/**
 * In-memory shape of the consent file.
 */
export interface AnalyticsConsentFile {
  /** Whether the user consents to usage analytics. */
  enabled: boolean;
}
