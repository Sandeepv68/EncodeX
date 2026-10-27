/**
 * @fileoverview In-process MCP client for the renderer.
 *
 * The Copilot renders MCP App views inside the app. Those views call tools
 * back — to cancel a job, to apply a fix, to run a confirmed operation — so
 * the renderer needs a way to reach the MCP server.
 *
 * This client connects to the very same server the embedded HTTP server
 * exposes, over an in-memory transport, so both surfaces share one job
 * manager: a view that cancels a job cancels the job the app's queue shows.
 *
 * The client advertises the MCP Apps extension, so the server gates mutating
 * tools behind the app-only `commit_operation` tool exactly as it does for an
 * external host.
 */

import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { McpServer } from '@modelcontextprotocol/server';
import { MCP_UI_EXTENSION_ID, MCP_UI_RESOURCE_MIME_TYPE } from '../../shared/mcp-ui';

/** One tool result as seen by a view. */
export interface LocalToolResult {
  /** Machine-readable payload the views render. */
  structuredContent?: Record<string, unknown>;
  /** Text blocks, used as a fallback when there is no structured payload. */
  content?: Array<{ type: string; text?: string }>;
  /** True when the tool reported a failure. */
  isError?: boolean;
}

/** A client bound to an in-process MCP server. */
export interface LocalMcpClient {
  /** Calls a tool on the server. */
  callTool(name: string, args?: Record<string, unknown>): Promise<LocalToolResult>;
  /** Lists the tools the server exposes. */
  listTools(): Promise<Array<{ name: string; title?: string }>>;
  /** Closes the session. */
  close(): Promise<void>;
}

/**
 * Connects a client to an in-process MCP server.
 *
 * @param {() => McpServer} createServer - Builds the server to connect to. The
 *   caller passes the session factory so the client shares the app's job
 *   manager with the embedded HTTP server.
 * @returns {Promise<LocalMcpClient>} The connected client.
 */
export async function createLocalMcpClient(createServer: () => McpServer): Promise<LocalMcpClient> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  await server.connect(serverTransport);

  const client = new Client(
    { name: 'encodex-internal-view-host', version: '1.0.0' },
    { capabilities: { extensions: { [MCP_UI_EXTENSION_ID]: { mimeTypes: [MCP_UI_RESOURCE_MIME_TYPE] } } } },
  );
  await client.connect(clientTransport);

  return {
    async callTool(name: string, args: Record<string, unknown> = {}): Promise<LocalToolResult> {
      const result = await client.callTool({ name, arguments: args });
      return result as LocalToolResult;
    },
    async listTools() {
      const { tools } = await client.listTools();
      return tools.map((tool) => ({ name: tool.name, title: tool.title }));
    },
    async close() {
      await client.close();
    },
  };
}
