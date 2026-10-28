/**
 * @fileoverview Integration coverage for MCP UI resources.
 */

import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/client';
import { createMcpServer } from '../server';
import { FakeTranscoder } from './test-helpers';

const FIXTURE_BUNDLE =
  '<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\" /></head><body><div id=\"root\"></div></body></html>';

describe('mcp/ui/resources (integration)', () => {
  it('registers UI resources', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer({ transcoderFactory: () => new FakeTranscoder(), viewBundle: FIXTURE_BUNDLE });
    await server.connect(serverTransport);
    const client = new Client({ name: 'mcp-ui-int', version: '1.0.0' });
    await client.connect(clientTransport);
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain('ui://encodex/queue');
    await client.close();
  });
});
