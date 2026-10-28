/**
 * @fileoverview Test harness for the MCP App views.
 *
 * The views are React components that render a payload and call tools through
 * a host. The tests mount them with a fake host, so they exercise the real
 * components - the same ones an external MCP Apps host and the in-app
 * transcript render - without a transport.
 */

import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { createAppTheme } from '../../../shared/theme/theme';
import enUS from '../../i18n/locales/en-US.json';
import { McpViewProvider } from '../McpViewProvider';
import type { McpViewHost, McpViewHostContext, McpViewToolResult } from '../host';

void i18next.use(initReactI18next).init({
  resources: { 'en-US': { translation: enUS } },
  lng: 'en-US',
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

/**
 * A fake host that records the tool calls a view makes.
 */
export class FakeViewHost implements McpViewHost {
  /** The tool calls the view issued, in order. */
  readonly calls: Array<{ name: string; args?: Record<string, unknown> }> = [];

  /** The result every call answers with. */
  result: McpViewToolResult = { structuredContent: {} };

  /** The context the host reports. */
  context: McpViewHostContext = { variables: {}, supportsServerTools: true };

  /** Listeners registered through {@link subscribe}. */
  private readonly listeners = new Set<(result: McpViewToolResult) => void>();

  /**
   * Records a call and answers with the configured result.
   * @param {string} name - The tool name.
   * @param {Record<string, unknown>} [args] - The tool arguments.
   * @returns {Promise<McpViewToolResult>} The configured result.
   */
  async callTool(name: string, args?: Record<string, unknown>): Promise<McpViewToolResult> {
    this.calls.push({ name, args });
    return this.result;
  }

  /**
   * Registers a listener for pushed results.
   * @param {(result: McpViewToolResult) => void} listener - The listener.
   * @returns {() => void} An unsubscribe function.
   */
  subscribe(listener: (result: McpViewToolResult) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Pushes a result to the view, the way a host does.
   * @param {McpViewToolResult} result - The result to push.
   * @returns {void}
   */
  push(result: McpViewToolResult): void {
    for (const listener of this.listeners) listener(result);
  }
}

/**
 * Renders a view with the app theme, the app translations and a fake host.
 * @param {ReactElement} element - The view to render.
 * @param {FakeViewHost} [host] - The fake host to use.
 * @param {unknown} [data] - The initial payload.
 * @returns {ReturnType<typeof render>} The render result.
 */
export function renderView(element: ReactElement, host: FakeViewHost = new FakeViewHost(), data?: unknown) {
  return render(
    <ThemeProvider theme={createAppTheme('light', 'ltr')}>
      <I18nextProvider i18n={i18next}>
        <McpViewProvider host={host} initialData={data}>
          {element}
        </McpViewProvider>
      </I18nextProvider>
    </ThemeProvider>,
  );
}
