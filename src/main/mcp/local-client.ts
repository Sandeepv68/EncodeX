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
import type { LocalMcpClient, LocalToolResult } from './types';

export type { LocalMcpClient, LocalToolResult };

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

/** The memoized session of the in-process MCP client. @type {Promise<LocalMcpClient | null> | null} */
let session: Promise<LocalMcpClient | null> | null = null;

/**
 * Returns the in-process MCP client, creating it on first use.
 *
 * The client is created lazily: an app that never renders a view never pays
 * for the session. A failure is swallowed - the views degrade to a read-only
 * surface instead of breaking the Copilot.
 * @param {() => McpServer} createServer - Builds the server to connect to.
 * @returns {Promise<LocalMcpClient | null>} The client, or null when it could not start.
 */
export function getLocalMcpClient(createServer: () => McpServer): Promise<LocalMcpClient | null> {
  if (!session) {
    session = createLocalMcpClient(createServer).catch(() => null);
  }
  return session;
}

/**
 * Drops the memoized session; used by the tests and by a shutdown path.
 * @returns {void}
 */
export function resetLocalMcpClient(): void {
  session = null;
}
