/**
 * @fileoverview Type definitions for the main-process MCP layer.
 * Describes the GUI-parity tool dependencies, the embedded HTTP server's
 * session factory and lifecycle handle, the in-process client contract, and
 * the view descriptors the in-app MCP App host renders.
 */

import type { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import type { McpServer } from '@modelcontextprotocol/server';
import type { MCPJobManager } from '../../mcp/jobs/manager';
import type { McpUiViewId } from '../../shared/mcp-ui';
import type { TranscoderType, UpdateInfo } from '../../shared/types';
import type { ITranscoder } from '../transcoders/types';

/**
 * Dependencies consumed by the GUI-parity tools.
 * @interface GuiToolsDeps
 * @property {MCPJobManager} jobManager - The shared queue manager (same
 *   instance backing the core conversion tools and the renderer's queue).
 * @property {string} appVersion - The running app version (from Electron's
 *   `app.getVersion()`), supplied by the caller so this module stays
 *   Electron-free.
 * @property {function(TranscoderType): ITranscoder} [transcoderFactory] -
 *   Creates transcoders for probing/timeline reads (defaults to the shared
 *   FFmpeg factory when omitted).
 * @property {function(string): Promise<string | null>} [getPreviewFrame] -
 *   Extracts a base64 PNG data URL preview frame (defaults to EncodeX's
 *   `getVideoPreview` when omitted).
 * @property {function(): Promise<UpdateInfo | null>} [checkForUpdate] -
 *   Queries the latest release (defaults to the updater when omitted).
 */
export interface GuiToolsDeps {
  jobManager: MCPJobManager;
  appVersion: string;
  transcoderFactory?: (type: TranscoderType) => ITranscoder;
  getPreviewFrame?: (input: string) => Promise<string | null>;
  checkForUpdate?: () => Promise<UpdateInfo | null>;
}

/**
 * Factory that builds a fresh {@link McpServer} per HTTP session. Each MCP
 * session owns its Protocol instance (the SDK forbids sharing one across
 * transports), so the gateway calls this once per new session. The factory
 * must wire every session to the same shared engine (job manager, transcoders).
 * @callback McpSessionServerFactory
 * @returns {McpServer | Promise<McpServer>} A configured, unconnected MCP server.
 */
export type McpSessionServerFactory = () => McpServer | Promise<McpServer>;

/**
 * Handle returned by {@link startMcpHttpServer} for stopping the server and
 * reading its live bound port.
 * @interface McpHttpHandle
 * @property {function(): Promise<void>} close - Stops all MCP sessions and the
 *   HTTP listener.
 * @property {function(): number} port - Returns the actual bound port (useful
 *   when an ephemeral port was requested).
 */
export interface McpHttpHandle {
  close(): Promise<void>;
  port(): number;
}

/**
 * The transport/server pair backing one live MCP HTTP session.
 * @interface McpHttpSession
 * @property {NodeStreamableHTTPServerTransport} transport - The session's transport.
 * @property {McpServer} server - The session's MCP server.
 */
export interface McpHttpSession {
  transport: NodeStreamableHTTPServerTransport;
  server: McpServer;
}

/**
 * One tool result as seen by a view.
 */
export interface LocalToolResult {
  /** Machine-readable payload the views render. */
  structuredContent?: Record<string, unknown>;
  /** Text blocks, used as a fallback when there is no structured payload. */
  content?: Array<{ type: string; text?: string }>;
  /** True when the tool reported a failure. */
  isError?: boolean;
}

/**
 * A client bound to an in-process MCP server.
 */
export interface LocalMcpClient {
  /** Calls a tool on the server. */
  callTool(name: string, args?: Record<string, unknown>): Promise<LocalToolResult>;
  /** Lists the tools the server exposes. */
  listTools(): Promise<Array<{ name: string; title?: string }>>;
  /** Closes the session. */
  close(): Promise<void>;
}

/**
 * A view the in-app host can render.
 */
export interface ViewDescriptor {
  viewId: McpUiViewId;
  uri: string;
  title: string;
}
