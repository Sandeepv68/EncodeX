/**
 * @fileoverview Filesystem path resolution for the packaged application.
 *
 * Everything that has to be located at runtime - the preload script and the
 * built renderer entry point - is resolved here, so the main process entry
 * point and the log-window module agree on one answer.
 *
 * The paths are computed relative to this module's own directory
 * (`<root>/dist/main` once compiled), which is why every helper joins from
 * `__dirname` rather than from `process.cwd()`: the app can be launched from
 * any working directory.
 *
 * @module main/paths
 */

import * as path from 'path';

/**
 * Resolves the preload script path.
 *
 * In e2e test mode (`ENCODEX_TEST_MODE=1`) the mock preload
 * (e2e/mocks/preload.js) is loaded instead of the real bridge so specs can
 * drive `window.electronAPI` deterministically. The branch is inert outside of
 * e2e runs.
 *
 * When `ENCODEX_HOSTILE_MODE` is set, e2e/mocks/hostile-preload.js is used
 * instead. It proxies the *real* IPC channels - so main stays real and recovery
 * is a genuine round-trip - but injects a chosen failure into every
 * `electronAPI` method (Phase 3.4). It is checked before test mode because it
 * is the more specific override, and it must keep `ENCODEX_TEST_MODE` unset so
 * the host-side IPC handlers are the real ones rather than the Tier A stub store.
 *
 * @returns {string} Absolute path of the preload script to use.
 */
export function resolvePreloadPath(): string {
  const hostileMode = process.env.ENCODEX_HOSTILE_MODE;
  if (hostileMode) {
    return path.join(__dirname, '..', '..', 'e2e', 'mocks', 'hostile-preload.js');
  }
  if (process.env.ENCODEX_TEST_MODE === '1') {
    return path.join(__dirname, '..', '..', 'e2e', 'mocks', 'preload.js');
  }
  return path.join(__dirname, '..', 'preload', 'index.js');
}

/**
 * Resolves the built renderer entry point (`dist/renderer/index.html`).
 *
 * @returns {string} Absolute path of the renderer's `index.html`.
 */
export function resolveRendererEntryPath(): string {
  return path.join(__dirname, '..', 'renderer', 'index.html');
}
