/**
 * @fileoverview Entry point of the standalone MCP App bundle.
 *
 * The document is served by the EncodeX MCP server as a `ui://` resource and
 * rendered by a third-party host inside a sandboxed iframe. The server injects
 * a tiny bootstrap that names the view to render (`window.__ENCODEX_VIEW__`);
 * this entry picks that view up, connects to the host through the `ext-apps`
 * `App` class and mounts it.
 *
 * The bundle is self-contained: no external script, style, font or fetch.
 */

import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18next from 'i18next';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { createAppTheme } from '../../../shared/theme/theme';
import { McpViewProvider } from '../McpViewProvider';
import { findMcpViewComponent } from '../registry';
import { AppExtAppsHost } from './AppExtAppsHost';
import { MCP_VIEW_STRINGS } from './generated-strings';

/** The view id the server injected into the document. */
const VIEW_ID = (globalThis as unknown as { __ENCODEX_VIEW__?: string }).__ENCODEX_VIEW__ ?? 'queue';

void i18next.use(initReactI18next).init({
  resources: { 'en-US': { translation: MCP_VIEW_STRINGS } },
  lng: 'en-US',
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

/**
 * Mounts the selected view and keeps it in sync with the host context.
 * @returns {JSX.Element} The mounted application.
 */
function App() {
  const [host] = useState(() => new AppExtAppsHost());
  const [themeId, setThemeId] = useState<'light' | 'dark'>('light');

  const View = useMemo(() => findMcpViewComponent(VIEW_ID) ?? findMcpViewComponent('queue'), []);

  useEffect(() => {
    let cancelled = false;
    void host.connect().then(() => {
      if (cancelled) return;
      setThemeId(host.context.theme === 'dark' ? 'dark' : 'light');
      if (Object.keys(host.context.variables).length > 0) {
        applyHostStyleVariables({ variables: host.context.variables } as never);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [host]);

  const theme = useMemo(() => createAppTheme(themeId, 'ltr'), [themeId]);

  if (!View) return null;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <I18nextProvider i18n={i18next}>
        <McpViewProvider host={host}>
          <View />
        </McpViewProvider>
      </I18nextProvider>
    </ThemeProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
