/**
 * @fileoverview Hardware-acceleration detection for the analytics layer.
 *
 * Kept out of `main/index.ts` so the failure path (an Electron build that
 * refuses to report its GPU status) is unit-testable instead of only
 * reachable at startup.
 */

import { app } from 'electron';

/**
 * Reports whether hardware acceleration is available.
 * @returns {boolean | undefined} `true`/`false` when the status is known,
 *   `undefined` when the platform cannot report it.
 */
export function detectHardwareAcceleration(): boolean | undefined {
  try {
    return app.getGPUFeatureStatus()?.gpu_compositing === 'enabled';
  } catch {
    return undefined;
  }
}
