/**
 * @fileoverview Host abstraction for the MCP App views.
 *
 * A view is a React component that renders data delivered by an MCP server and
 * can call tools back. It never talks to a transport itself: it asks the
 * {@link McpViewHost} for data and for tool calls. Two hosts implement that
 * contract:
 *
 *  - {@link AppExtAppsHost} — the standalone bundle that runs inside a
 *    third-party host's sandboxed iframe (Claude, VS Code, ChatGPT, …), built
 *    on the `ext-apps` `App` API.
 *  - the in-app host used by the Copilot transcript, which proxies the calls
 *    to the local MCP server over IPC.
 *
 * Keeping the views transport-agnostic is what lets the *same* components be
 * rendered by EncodeX and by an external host.
 */

import type { McpViewHost, McpViewHostContext, McpViewProviderProps, McpViewState, McpViewToolResult } from './types';

export type { McpViewHost, McpViewHostContext, McpViewProviderProps, McpViewState, McpViewToolResult };

/** An empty host context, used before the host reports one. */
export const EMPTY_VIEW_HOST_CONTEXT: McpViewHostContext = { variables: {} };

/**
 * Extracts the structured payload of a tool result, tolerating a result that
 * only carries text.
 * @param {McpViewToolResult | undefined} result - The tool result.
 * @returns {Record<string, unknown> | undefined} The structured payload.
 */
export function structuredPayload(result: McpViewToolResult | undefined): Record<string, unknown> | undefined {
  if (!result) return undefined;
  if (result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent;
  return undefined;
}

/**
 * Concatenates the text blocks of a tool result.
 * @param {McpViewToolResult | undefined} result - The tool result.
 * @returns {string} The concatenated text.
 */
export function resultText(result: McpViewToolResult | undefined): string {
  if (!result?.content) return '';
  return result.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}

/**
 * The message of a failed tool result.
 *
 * A tool that reports a failure answers with an error result rather than by
 * throwing, so a view that triggered the call has to read the message itself.
 * @param {McpViewToolResult | undefined} result - The tool result.
 * @returns {string} The failure message, or an empty string when the call succeeded.
 */
export function resultErrorText(result: McpViewToolResult | undefined): string {
  if (!result?.isError) return '';
  return resultText(result);
}
