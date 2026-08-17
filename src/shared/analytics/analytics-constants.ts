/**
 * @fileoverview Constants for the analytics subsystem.
 * localStorage key for the analytics opt-out preference and the default value.
 */

/**
 * localStorage key used to persist the user's analytics opt-in/opt-out choice.
 * @const {string} ANALYTICS_STORAGE_KEY
 */
export const ANALYTICS_STORAGE_KEY = 'encodex-analytics-enabled';

/**
 * Default analytics state when no persisted preference exists (enabled).
 * @const {boolean} DEFAULT_ANALYTICS_ENABLED
 */
export const DEFAULT_ANALYTICS_ENABLED = true;
