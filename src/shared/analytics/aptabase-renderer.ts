/**
 * @fileoverview Aptabase analytics provider for the Electron renderer process.
 *
 * This is the only file in the analytics layer that imports from
 * @aptabase/electron/renderer. The renderer-process trackEvent() calls go
 * through IPC to the main process, which batches and sends them to Aptabase.
 *
 * To replace Aptabase with another provider, create a new file implementing
 * AnalyticsProvider and update the initialization callsite in src/renderer/main.tsx.
 */

import type { AnalyticsProvider, AnalyticsConfig } from './types';
import { Logger } from '../logger';

/**
 * Logger instance scoped to the Aptabase renderer-process provider.
 * @const {Logger} log
 */
const log = new Logger('shared/analytics/aptabase-renderer');

/**
 * Lazily loaded Aptabase renderer-process SDK function. Imported on first use
 * to avoid top-level import side effects.
 * @type {{ trackEvent?: Function } | null}
 */
let trackEventFn: ((name: string, props?: Record<string, string | number>) => void) | null = null;

/**
 * Whether the renderer has been initialized.
 * @type {boolean}
 */
let initialized = false;

/**
 * Loads the @aptabase/electron/renderer module on demand. Returns true when
 * the module is available.
 * @returns {boolean} Whether the SDK was loaded successfully.
 */
function loadSdk(): boolean {
  if (trackEventFn) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require('@aptabase/electron/renderer');
    trackEventFn = sdk.trackEvent;
    return true;
  } catch {
    log.warn('Aptabase renderer SDK not available; analytics will be silent');
    return false;
  }
}

/**
 * Aptabase analytics provider for the Electron renderer process.
 * The renderer SDK delegates to the main process via IPC; no separate
 * initialize() is needed beyond the main-process setup.
 * @class AptabaseRendererProvider
 * @implements {AnalyticsProvider}
 */
export class AptabaseRendererProvider implements AnalyticsProvider {
  /**
   * Records the configuration. The actual Aptabase initialization happens in
   * the main process; the renderer only needs the trackEvent function.
   * @param {AnalyticsConfig} _config - Configuration (unused by renderer SDK).
   */
  initialize(_config: AnalyticsConfig): void {
    if (!loadSdk()) return;
    initialized = true;
    log.debug('Aptabase renderer provider ready');
  }

  /**
   * Tracks an analytics event via the Aptabase renderer SDK. Runs in the
   * background; callers must not await the result.
   * @param {string} eventName - Name of the event.
   * @param {Record<string, string | number>} [properties] - Event properties.
   */
  track(eventName: string, properties?: Record<string, string | number>): void {
    if (!initialized || !trackEventFn) return;
    try {
      trackEventFn(eventName, properties);
    } catch (err) {
      log.debug('Aptabase track failed (renderer)', err);
    }
  }

  /**
   * No-op for Aptabase; the SDK buffers internally.
   */
  shutdown(): void {
    // Aptabase SDK handles cleanup internally
  }
}
