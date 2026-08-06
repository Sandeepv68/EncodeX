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
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { Logger } from '../shared/logger';
import App from './App';
import i18n from './i18n/config';
import { DirectionProvider } from './i18n/DirectionProvider';
import { useLanguageDirection } from './useLanguageDirection';
import { useLogStore } from './stores/logStore';
import { setupSessionCleanup } from './sessionCleanup';
import { LOG_MOUNTING_REACT_APP } from '../shared/log-constants';

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
  const original = console[method];
  console[method] = (...args: unknown[]) => {
    original.apply(console, args);
    const text = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    useLogStore.getState().addEntry({
      timestamp: new Date().toISOString(),
      level: level as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
      text,
      source: 'renderer',
    });
  };
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
/**
 * Creates the React root on the `#root` element and mounts the app inside
 * `React.StrictMode`.
 * @constant
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
