/**
 * @fileoverview React application entry point.
 * Mounts the root React component into the DOM.
 *
 * Responsibilities:
 *  - Imports the bundled fonts (Roboto weights 300/400/500/700) and the
 *    Font Awesome SVG core stylesheet so icons render correctly.
 *  - Patches `console.log` / `console.warn` / `console.error` to mirror every
 *    message into the renderer log store (in addition to the original output).
 *  - Registers the session cleanup that wipes transient saved data (the video
 *    cut draft) when the window unloads, keeping only persisted preferences.
 *  - Renders the `Root` component, which wires up the HashRouter, the emotion
 *    `DirectionProvider` (RTL/LTR cache), and the i18next provider around `App`.
 *  - Mounts the whole tree under `React.StrictMode` into the `#root` element.
 */

import React from 'react';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { Logger } from '../shared/logger';
import { addMonitoringBreadcrumb, captureException, initMonitoring } from '../shared/monitoring/MonitoringService';
import type { MonitoringConfig } from '../shared/monitoring/types';
import { initAnalytics } from '../shared/analytics/AnalyticsService';
import type { AnalyticsConfig } from '../shared/analytics/types';
import { resolveRendererMonitorProvider } from './monitoring/providerFactory';
import { resolveRendererAnalyticsProvider } from './analytics/providerFactory';
import App from './App';
import i18n from './i18n/config';
import { DirectionProvider } from './i18n/DirectionProvider';
import { useLanguageDirection } from './useLanguageDirection';
import { useLogStore } from './stores/logStore';
import { setupSessionCleanup } from './sessionCleanup';
import { withBridgeTimeout } from './utils/bridge-call';
import { LOG_MOUNTING_REACT_APP } from '../shared/log-constants';
import type { ConsoleMethod } from './types';

/** Logger instance used by this module. @const {Logger} */
const log = new Logger('renderer/main');

/**
 * Console levels that are mirrored into the log store. Maps each patched
 * console method to the matching log level string.
 * @const {Array<{method: 'log' | 'warn' | 'error', level: 'INFO' | 'WARN' | 'ERROR'}>}
 */
const levels: Array<{ method: 'log' | 'warn' | 'error'; level: 'INFO' | 'WARN' | 'ERROR' }> = [
  { method: 'log', level: 'INFO' },
  { method: 'warn', level: 'WARN' },
  { method: 'error', level: 'ERROR' },
];

/**
 * Patches the console methods listed above so every call still hits the
 * original implementation and is also appended to the log store with a
 * timestamp, level, serialized text, and 'renderer' as the source.
 * @constant
 */
for (const { method, level } of levels) {
  const original = console[method] as ConsoleMethod;
  if (original.__encodeXPatched) {
    continue;
  }
  const patched = ((...args: unknown[]) => {
    original.apply(console, args);
    const text = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    useLogStore.getState().addEntry({
      timestamp: new Date().toISOString(),
      level: level as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
      text,
      source: 'renderer',
    });
  }) as ConsoleMethod;
  patched.__encodeXPatched = true;
  console[method] = patched;
}

/**
 * Composition root that wraps the App in all global providers.
 * Determines the text direction from the current i18n locale via
 * `useLanguageDirection`, then provides, outermost to innermost:
 * HashRouter -> DirectionProvider (emotion cache keyed per direction) ->
 * I18nextProvider -> App.
 *
 * @returns {React.JSX.Element} The fully wrapped application tree.
 */
function Root() {
  const direction = useLanguageDirection();

  return (
    <HashRouter>
      <DirectionProvider direction={direction}>
        <I18nextProvider i18n={i18n}>
          <App />
        </I18nextProvider>
      </DirectionProvider>
    </HashRouter>
  );
}

log.info(LOG_MOUNTING_REACT_APP);
/**
 * Wipes transient saved data (e.g. the video cut draft) when the window
 * unloads, keeping only the persisted preferences (theme, language,
 * always-on-top, hardware acceleration). The returned cleanup is intentionally
 * not stored: the listener lives for the whole renderer lifetime.
 */
setupSessionCleanup();
log.info(LOG_MOUNTING_REACT_APP);

/**
 * How long the first paint waits for renderer monitoring before giving up on early coverage.
 *
 * React is mounted from `bootstrapRendererMonitoring().finally(...)`, so this is a hard ceiling on how
 * long the user sees nothing. The original code had no ceiling at all: `bootstrapRendererMonitoring`
 * guards its bridge call with try/catch, which handles a *rejection* but not a promise that never
 * settles. `ipcRenderer.invoke` is a round-trip to another process and nothing guarantees an answer,
 * so a wedged main process produced a permanently blank window - no app, no error, no spinner, and
 * nothing in the log to explain it. Every other suite in this plan passed, because they only ever
 * supplied well-formed or fast-failing bridges.
 *
 * Bounding the read keeps the intent (monitoring is live before the first render, so errors thrown
 * during boot are captured) while making the worst case a late-but-working app instead of a white
 * screen. The bootstrap itself still runs to completion afterwards and wires its handlers, so coverage
 * improves as soon as main answers.
 *
 * @const {number}
 */
const MONITORING_BOOT_TIMEOUT_MS = 2000;

/**
 * Global slot holding the already created React root for the `#root` container.
 *
 * The renderer entry can be evaluated more than once in a single document
 * (Vite HMR re-executes the module on change, and any additional dynamic
 * import of the entry would do the same). `createRoot()` on a container that
 * already has a root makes React warn "You are calling ReactDOMClient.createRoot()
 * on a container that has already been passed to createRoot() before" and the
 * second root never gets the tree it was given.
 *
 * Keeping the root in a global slot lets a re-evaluation reuse the existing
 * root and simply render into it again.
 *
 * @const {ReactRoot | undefined}
 */
const globalScope = globalThis as typeof globalThis & { __ENCODEX_REACT_ROOT__?: ReactRoot };

/**
 * Returns the root for the `#root` container, creating it on first use.
 * @returns {ReactRoot} The root to render the application into.
 */
function getOrCreateRoot(): ReactRoot {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root container #root is missing from the document');
  }
  globalScope.__ENCODEX_REACT_ROOT__ ??= createRoot(container);
  return globalScope.__ENCODEX_REACT_ROOT__;
}

/**
 * Initializes renderer-side monitoring before React mounts so early errors
 * are covered. The backend choice mirrors the main process (which owns the
 * DSN) via `window.electronAPI.monitoringGetState()`; consent is enforced
 * centrally by the facade. Global `error` / `unhandledrejection` listeners
 * route crashes through the provider-agnostic facade (Sentry's own automatic
 * global-handler integration is disabled in its adapter to avoid duplicates).
 *
 * @returns {Promise<void>} Resolves once init and handler wiring settle.
 */
async function bootstrapRendererMonitoring(): Promise<void> {
  let backend = 'noop';
  let enabled = false;
  try {
    const state = await withBridgeTimeout(window.electronAPI?.monitoringGetState(), MONITORING_BOOT_TIMEOUT_MS, undefined);
    backend = state?.backend ?? 'noop';
    enabled = state?.enabled === true && backend !== 'noop';
  } catch (err) {
    log.warn('monitoringGetState failed, continuing without monitoring:', err);
  }

  await initMonitoring(
    {
      enabled,
      provider: backend,
    } satisfies MonitoringConfig,
    resolveRendererMonitorProvider,
  );

  window.addEventListener('error', (event) => {
    captureException(event.error ?? event.message, { tags: { handler: 'window.error', process: 'renderer' } });
  });
  window.addEventListener('unhandledrejection', (event) => {
    captureException(event.reason, { tags: { handler: 'unhandledrejection', process: 'renderer' } });
  });

  addMonitoringBreadcrumb({ category: 'app', message: 'renderer monitoring ready' });
}

/**
 * Initializes renderer-side usage analytics before the app is interacted with.
 * The backend choice mirrors the main process (which owns the App Key) via
 * `window.electronAPI.analyticsGetState()`; consent is enforced centrally by
 * the facade. Events recorded before this settles are buffered and replayed
 * on success, so early product events (onboarding, navigation) are not lost.
 *
 * @returns {Promise<void>} Resolves once init settles.
 */
async function bootstrapRendererAnalytics(): Promise<void> {
  let backend = 'noop';
  let enabled = false;
  try {
    const state = await window.electronAPI?.analyticsGetState();
    backend = state?.backend ?? 'noop';
    enabled = state?.enabled === true && backend !== 'noop';
  } catch (err) {
    log.warn('analyticsGetState failed, continuing without analytics:', err);
  }

  await initAnalytics(
    {
      enabled,
      provider: backend,
    } satisfies AnalyticsConfig,
    resolveRendererAnalyticsProvider,
  );
}

/**
 * Boots monitoring and analytics first, then mounts React once monitoring
 * settles. Mounting inside `.finally` guarantees the app still renders even
 * if a bootstrap fails unexpectedly.
 * @constant
 */
void bootstrapRendererAnalytics();
void bootstrapRendererMonitoring().finally(() => {
  getOrCreateRoot().render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
});
