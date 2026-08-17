/**
 * @fileoverview High-level analytics API for EncodeX.
 *
 * This is the only module that business logic should import. It provides
 * domain-specific tracking methods (conversionStarted, errorOccurred, etc.)
 * that delegate to the active AnalyticsProvider via getAnalytics().
 *
 * To swap analytics backends in the future, this file and all call sites
 * remain untouched. Only the provider implementation and initialization
 * callsite need to change.
 *
 * Every method gates on isAnalyticsEnabled() so calls are silent no-ops
 * when the user has opted out.
 */

import { getAnalytics, isAnalyticsEnabled } from './provider';

/**
 * Domain-specific analytics event API.
 *
 * All methods are fire-and-forget: they call the provider's track() in the
 * background and never return a promise. Custom properties are limited to
 * strings and numbers per the Aptabase SDK contract.
 *
 * @const {object} analytics
 */
export const analytics = {
  /**
   * Tracks application startup. Call once when the main process boots.
   */
  appStarted(): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('app_started');
  },

  /**
   * Tracks application quit. Call in the will-quit handler.
   */
  appQuit(): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('app_quit');
  },

  /**
   * Tracks a screen/page navigation event.
   * @param {string} screen - The route path (e.g. '/convert', '/settings').
   */
  screenView(screen: string): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('screen_view', { screen });
  },

  /**
   * Tracks when a media conversion starts.
   * @param {string} codec - The video codec used (e.g. 'libx264').
   * @param {string} inputFormat - The input container format (e.g. 'mp4').
   */
  conversionStarted(codec: string, inputFormat: string): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('conversion_started', { codec, inputFormat });
  },

  /**
   * Tracks when a media conversion completes successfully.
   * @param {string} codec - The video codec used.
   * @param {number} durationSec - Conversion wall-clock duration in seconds.
   */
  conversionCompleted(codec: string, durationSec: number): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('conversion_completed', { codec, durationSec });
  },

  /**
   * Tracks when a media conversion fails.
   * @param {string} code - The application error code (e.g. 'CONVERSION_FAILED').
   * @param {string} codec - The video codec used.
   */
  conversionFailed(code: string, codec: string): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('conversion_failed', { code, codec });
  },

  /**
   * Tracks when a media conversion is cancelled by the user.
   * @param {string} codec - The video codec used.
   */
  conversionCancelled(codec: string): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('conversion_cancelled', { codec });
  },

  /**
   * Tracks when a batch queue is started.
   * @param {number} jobCount - Number of jobs in the batch.
   */
  batchStarted(jobCount: number): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('batch_started', { jobCount });
  },

  /**
   * Tracks when a batch queue completes all jobs.
   * @param {number} jobCount - Number of jobs processed.
   * @param {number} durationSec - Total batch wall-clock duration in seconds.
   */
  batchCompleted(jobCount: number, durationSec: number): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('batch_completed', { jobCount, durationSec });
  },

  /**
   * Tracks a non-fatal application error.
   * @param {string} code - The application error code.
   * @param {string} context - Brief context about where the error occurred.
   */
  errorOccurred(code: string, context: string): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('error_occurred', { code, context: context.substring(0, 100) });
  },

  /**
   * Tracks a user settings change.
   * @param {string} setting - The setting name (e.g. 'theme', 'hwaccel').
   * @param {string} value - The new value.
   */
  settingChanged(setting: string, value: string): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('setting_changed', { setting, value });
  },

  /**
   * Tracks usage of a specific feature.
   * @param {string} feature - The feature name (e.g. 'media_info', 'video_cut').
   */
  featureUsed(feature: string): void {
    if (!isAnalyticsEnabled()) return;
    getAnalytics().track('feature_used', { feature });
  },
} as const;
