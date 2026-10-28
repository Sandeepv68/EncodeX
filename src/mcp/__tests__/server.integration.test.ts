/**
 * @fileoverview Integration coverage for the MCP server's entry point and its
 * in-process tool surface.
 *
 * The spawn-level suites drive a real child process, which the coverage
 * provider never sees. These cases therefore run the server in-process over an
 * in-memory transport, so the handlers the app's own MCP client calls are
 * measured where they actually execute.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { runMcpServer } from '../run';
import { createMcpServer } from '../server';
import { FakeTranscoder } from './test-helpers';

describe('runMcpServer', () => {
  it('is exported', () => {
    expect(typeof runMcpServer).toBe('function');
  });
});

describe('the MCP server tool surface (integration)', () => {
  let dir = '';
  let client: Client | undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mcp-server-int-'));
  });

  afterEach(async () => {
    await client?.close();
    client = undefined;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Connects an in-memory client to a server backed by the fake transcoder.
   * @returns {Promise<Client>} The connected client.
   */
  async function connect(): Promise<Client> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer({ transcoderFactory: () => new FakeTranscoder() });
    await server.connect(serverTransport);
    client = new Client({ name: 'mcp-server-int', version: '1.0.0' });
    await client.connect(clientTransport);
    return client;
  }

  it('lists the encoders and the built-in profiles', async () => {
    const session = await connect();
    const capabilities = await session.callTool({ name: 'list_capabilities', arguments: {} });
    expect(capabilities.isError).toBeFalsy();
    const profiles = await session.callTool({ name: 'list_profiles', arguments: {} });
    expect(profiles.isError).toBeFalsy();
  });

  it('queues a conversion and a batch through the same server', async () => {
    const input = path.join(dir, 'clip.mp4');
    fs.writeFileSync(input, 'stub');
    const session = await connect();
    const converted = await session.callTool({ name: 'convert_media', arguments: { input } });
    expect(converted.isError).toBeFalsy();
    const batched = await session.callTool({ name: 'batch_convert', arguments: { inputs: [input] } });
    expect(batched.isError).toBeFalsy();
  });
});
