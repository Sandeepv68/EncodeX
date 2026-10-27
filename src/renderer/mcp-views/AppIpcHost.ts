/**
 * @fileoverview The in-app host for the MCP App views.
 *
 * The Copilot renders the same React components an external MCP Apps host
 * renders. This adapter is the transport on the app side: a view asks it to
 * call a tool, it forwards the call to the main process, and the main process
 * runs it on the in-process MCP server - the same server, and the same job
 * manager, the embedded HTTP server exposes.
 */

import type { McpViewHost, McpViewHostContext, McpViewToolResult } from './host';

export class AppIpcHost implements McpViewHost {
  /** The host context; the app always allows tool calls. */
  readonly context: McpViewHostContext = { variables: {}, supportsServerTools: true };

  /**
   * Calls a tool through the in-process MCP server.
   * @param {string} name - The tool name.
   * @param {Record<string, unknown>} [args] - The tool arguments.
   * @returns {Promise<McpViewToolResult>} The tool result.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpViewToolResult> {
    const result = await window.electronAPI.mcpUiCallTool(name, args);
    return (result ?? {}) as McpViewToolResult;
  }

  /**
   * Subscribes to host-pushed tool results.
   *
   * The app has no push channel for tool results: the views that need live
   * data poll their tool, exactly as they do in an external host.
   * @param {(result: McpViewToolResult) => void} _listener - The listener.
   * @returns {() => void} An unsubscribe function.
   */
  subscribe(_listener: (result: McpViewToolResult) => void): () => void {
    return () => undefined;
  }
}
