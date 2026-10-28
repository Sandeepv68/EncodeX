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

import type { ReactNode } from 'react';

/** One tool result as seen by a view. */
export interface McpViewToolResult {
  /** Machine-readable payload the views render. */
  structuredContent?: Record<string, unknown>;
  /** Text blocks, used as a fallback when there is no structured payload. */
  content?: Array<{ type: string; text?: string }>;
  /** True when the tool reported a failure. */
  isError?: boolean;
}

/** Host-provided context: theme, style variables and locale. */
export interface McpViewHostContext {
  /** Host theme, when it reports one. */
  theme?: 'light' | 'dark';
  /** CSS custom properties the host exposes. */
  variables: Record<string, string>;
  /** Host locale, when it reports one. */
  locale?: string;
  /** False when the host cannot proxy tool calls; views must not poll then. */
  supportsServerTools?: boolean;
}

/** The transport-facing contract every view talks to. */
export interface McpViewHost {
  /** Calls a tool on the MCP server and returns its result. */
  callTool(name: string, args?: Record<string, unknown>): Promise<McpViewToolResult>;
  /** The current host context. */
  readonly context: McpViewHostContext;
  /** Subscribes to host-pushed tool results. Returns an unsubscribe function. */
  subscribe(listener: (result: McpViewToolResult) => void): () => void;
}

/** Props of the provider that hosts a view. */
export interface McpViewProviderProps {
  /** The host the view talks to. */
  host: McpViewHost;
  /** Payload the view renders before the host delivers anything. */
  initialData?: unknown;
  /** The view to render. */
  children?: ReactNode;
}

/** The state a view reads from the provider. */
export interface McpViewState {
  /** The latest payload delivered by the host. */
  data: unknown;
  /** Message of the last failure, if any. */
  error?: string;
  /** True while a tool call is in flight. */
  busy: boolean;
  /** Calls a tool and returns its result. */
  callTool: (name: string, args?: Record<string, unknown>) => Promise<McpViewToolResult>;
  /** Replaces the current payload (used when a view learns new arguments). */
  setData: (data: unknown) => void;
  /** The host the view talks to. */
  host: McpViewHost;
}

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
