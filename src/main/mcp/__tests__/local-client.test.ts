/**
 * @fileoverview Tests for the in-process MCP client.
 *
 * The client is what lets an in-app MCP App view call a tool back. It talks to
 * an in-process server over a linked in-memory transport, and it advertises the
 * MCP Apps extension so the server gates mutating tools behind the app-only
 * `commit_operation` tool.
 */

import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { createLocalMcpClient, getLocalMcpClient, resetLocalMcpClient } from '../local-client';

/**
 * Builds a server with one tool that echoes its arguments.
 * @returns {McpServer} The server.
 */
function fakeServer(): McpServer {
  const server = new McpServer({ name: 'fake', version: '1.0.0' });
  server.registerTool(
    'echo',
    { title: 'Echo', description: 'Echoes its arguments.', inputSchema: z.object({ value: z.string() }) },
    async ({ value }: { value: string }) => ({
      content: [{ type: 'text' as const, text: value }],
      structuredContent: { value },
    }),
  );
  return server;
}

describe('createLocalMcpClient', () => {
  it('calls a tool on the server it is given', async () => {
    const client = await createLocalMcpClient(fakeServer);
    try {
      const result = await client.callTool('echo', { value: 'hello' });
      expect(result.structuredContent).toEqual({ value: 'hello' });
      expect(result.content?.[0]?.text).toBe('hello');
    } finally {
      await client.close();
    }
  });

  it('lists the tools the server exposes', async () => {
    const client = await createLocalMcpClient(fakeServer);
    try {
      const tools = await client.listTools();
      expect(tools.map((tool) => tool.name)).toContain('echo');
    } finally {
      await client.close();
    }
  });

  it('memoizes the session it creates', async () => {
    resetLocalMcpClient();
    const first = await getLocalMcpClient(fakeServer);
    const second = await getLocalMcpClient(fakeServer);
    expect(second).toBe(first);
    resetLocalMcpClient();
  });

  it('answers with no client when the server cannot be reached', async () => {
    resetLocalMcpClient();
    const client = await getLocalMcpClient(() => {
      throw new Error('boom');
    });
    expect(client).toBeNull();
    resetLocalMcpClient();
  });

  it('reports the server refusal when the arguments do not match the schema', async () => {
    const client = await createLocalMcpClient(fakeServer);
    try {
      const result = await client.callTool('echo');
      expect(result.isError).toBe(true);
    } finally {
      await client.close();
    }
  });
});
