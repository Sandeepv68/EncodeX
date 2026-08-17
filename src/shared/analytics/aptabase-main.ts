/**
 * @fileoverview Aptabase analytics provider for the Electron main process.
 *
 * This is the only file in the analytics layer that imports from
 * @aptabase/electron/main. The main-process initialize() call must happen
 * before app.whenReady() so the SDK can set up its IPC listeners for the
 * renderer process.
 *
 * To replace Aptabase with another provider, create a new file implementing
 * AnalyticsProvider and update the initialization callsite in src/main/index.ts.
 */

import type { AnalyticsProvider, AnalyticsConfig } from './types';
import { Logger } from '../logger';

/**
 * Logger instance scoped to the Aptabase main-process provider.
 * @const {Logger} log
 */
const log = new Logger('shared/analytics/aptabase-main');

/**
 * Lazily loaded Aptabase main-process SDK functions. Imported on first use
 * to avoid top-level import side effects.
 * @type {{ initialize?: Function, trackEvent?: Function } | null}
 */
let sdk: {
  initialize?: (key: string, opts?: Record<string, unknown>) => void;
  trackEvent?: (name: string, props?: Record<string, string | number>) => void;
} | null = null;

/**
 * Loads the @aptabase/electron/main module on demand. Returns true when the
 * module is available, false when the dependency is not installed (e.g. in
 * test environments).
 * @returns {boolean} Whether the SDK was loaded successfully.
 */
function loadSdk(): boolean {
  if (sdk) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = require('@aptabase/electron/main');
    return true;
  } catch {
    log.warn('Aptabase SDK not available; analytics will be silent');
    return false;
  }
}

/**
 * Aptabase analytics provider for the Electron main process.
 * Delegates to @aptabase/electron/main for initialize() and trackEvent().
 * @class AptabaseMainProvider
 * @implements {AnalyticsProvider}
 */
export class AptabaseMainProvider implements AnalyticsProvider {
  /**
   * Initializes the Aptabase SDK with the given configuration. The SDK
   * automatically detects debug/release mode from app.isPackaged.
   * @param {AnalyticsConfig} config - App key, version, and debug flag.
   */
  initialize(config: AnalyticsConfig): void {
    if (!loadSdk() || !sdk?.initialize) return;
    log.debug('Initializing Aptabase (main)', config.isDebug ? 'debug' : 'release');
    Promise.resolve(
      sdk.initialize(config.appKey, {
        appVersion: config.appVersion,
      }),
    ).catch((err) => {
      log.debug('Aptabase init failed (main)', err);
    });
  }

  /**
   * Tracks an analytics event via the Aptabase SDK. Runs in the background.
   * @param {string} eventName - Name of the event.
   * @param {Record<string, string | number>} [properties] - Event properties.
   */
  track(eventName: string, properties?: Record<string, string | number>): void {
    if (!sdk?.trackEvent) return;
    try {
      sdk.trackEvent(eventName, properties);
    } catch (err) {
      log.debug('Aptabase track failed (main)', err);
    }
  }

  /**
   * No-op for Aptabase; the SDK buffers internally and flushes on its own.
   */
  shutdown(): void {
    // Aptabase SDK handles cleanup internally
  }
}
