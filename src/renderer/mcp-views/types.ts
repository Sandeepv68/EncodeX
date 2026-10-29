/**
 * @fileoverview Type definitions for the renderer MCP App view layer.
 * Declares the transport-facing host contract the views talk to and the
 * options of the polling helper that keeps them current.
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

/** Options of the view polling helper. */
export interface McpViewPollingOptions {
  /** Tool to call on every tick. Polling is disabled when omitted. */
  tool?: string;
  /** Arguments passed to the polled tool. */
  args?: Record<string, unknown>;
  /** Interval between two ticks, in milliseconds. Defaults to 2500. */
  intervalMs?: number;
  /** Disables polling without unmounting the view. */
  enabled?: boolean;
}
