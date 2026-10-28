/**
 * @fileoverview MCP Apps host adapter backed by the `ext-apps` `App` class.
 *
 * This is the host used by the standalone bundle: the document runs inside a
 * third-party host's sandboxed iframe (Claude, VS Code, ChatGPT, …) and talks
 * to it over the MCP Apps `postMessage` protocol. The `ext-apps` `App` class
 * owns the handshake, the size reporting and the tool proxy, so this adapter
 * only has to translate its events into the {@link McpViewHost} contract the
 * views use.
 */

import { App } from '@modelcontextprotocol/ext-apps';
import type { McpViewHost, McpViewHostContext, McpViewToolResult } from '../host';

/** Application identity announced during the `ui/initialize` handshake. */
const APP_INFO = { name: 'EncodeX MCP App view', version: '1.0.0' };

export class AppExtAppsHost implements McpViewHost {
  /** The underlying `ext-apps` application. */
  private readonly app: App;

  /** Listeners notified when the host pushes a tool result. */
  private readonly listeners = new Set<(result: McpViewToolResult) => void>();

  /** The current host context. */
  private contextState: McpViewHostContext = { variables: {} };

  /**
   * Creates the host.
   * @param {App} [app] - The `ext-apps` application to wrap (test seam).
   */
  constructor(app: App = new App(APP_INFO, {})) {
    this.app = app;
  }

  /** The host context, refreshed from the app. */
  get context(): McpViewHostContext {
    return this.contextState;
  }

  /**
   * Performs the `ui/initialize` handshake and starts listening for host
   * notifications.
   * @returns {Promise<void>} Resolves once the app is connected.
   */
  async connect(): Promise<void> {
    this.app.ontoolresult = (params) => {
      const result = params as McpViewToolResult;
      for (const listener of this.listeners) listener(result);
    };
    this.app.onhostcontextchanged = (params) => {
      this.contextState = toHostContext(params as Record<string, unknown>);
    };
    await this.app.connect();
    this.contextState = toHostContext(this.app.getHostContext() as Record<string, unknown> | undefined);
  }

  /**
   * Calls a tool through the host's proxy.
   * @param {string} name - The tool name.
   * @param {Record<string, unknown>} [args] - The tool arguments.
   * @returns {Promise<McpViewToolResult>} The tool result.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpViewToolResult> {
    const result = await this.app.callServerTool({ name, arguments: args });
    return result as McpViewToolResult;
  }

  /**
   * Subscribes to host-pushed tool results.
   * @param {(result: McpViewToolResult) => void} listener - The listener.
   * @returns {() => void} An unsubscribe function.
   */
  subscribe(listener: (result: McpViewToolResult) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/**
 * Converts a host context into the view-facing context.
 * @param {Record<string, unknown> | undefined} context - The raw host context.
 * @returns {McpViewHostContext} The view-facing context.
 */
function toHostContext(context: Record<string, unknown> | undefined): McpViewHostContext {
  const styles = context?.styles as { variables?: Record<string, string> } | undefined;
  const capabilities = context?.capabilities as { serverTools?: unknown } | undefined;
  const theme = context?.theme;
  return {
    theme: theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : undefined,
    variables: styles?.variables ?? {},
    locale: typeof context?.locale === 'string' ? context.locale : undefined,
    supportsServerTools: capabilities?.serverTools !== undefined,
  };
}
