/**
 * @fileoverview Raw stdio diagnostic for the MCP server.
 *
 * Speaks JSON-RPC by hand so the bytes on the wire can be measured: the SDK
 * client hides a truncated or unparsable response behind a request timeout.
 *
 * Usage: node scripts/mcp-raw-probe.mjs
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'dist', 'mcp', 'index.js');

/**
 * Runs one probe against the server.
 * @param {boolean} withExtension - Whether the client advertises MCP Apps.
 * @returns {Promise<void>} Resolves when the probe is done.
 */
async function probe(withExtension) {
  process.stdout.write(`\n[probe] === client capabilities: ${withExtension ? 'MCP Apps' : 'plain'} ===\n`);
  const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });

  let out = Buffer.alloc(0);
  let messages = 0;
  child.stdout.on('data', (chunk) => {
    out = Buffer.concat([out, chunk]);
    let index;
    while ((index = out.indexOf(0x0a)) >= 0) {
      const line = out.subarray(0, index).toString('utf8');
      out = out.subarray(index + 1);
      messages += 1;
      let parsed = null;
      try {
        parsed = JSON.parse(line);
      } catch {
        parsed = null;
      }
      if (parsed) {
        process.stdout.write(`[probe]   message ${messages}: ${line.length} bytes, id=${parsed.id}\n`);
      } else {
        process.stdout.write(`[probe]   message ${messages}: ${line.length} bytes, NOT JSON: ${line.slice(0, 90)}\n`);
      }
    }
  });
  child.stderr.on('data', (chunk) => {
    process.stdout.write(`[probe]   stderr: ${chunk.toString().trim().slice(0, 200)}\n`);
  });

  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);

  const capabilities = withExtension
    ? { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } }
    : {};

  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities,
      clientInfo: { name: 'raw-probe', version: '1.0.0' },
    },
  });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  setTimeout(() => {
    send({ jsonrpc: '2.0', id: 2, method: 'resources/read', params: { uri: 'ui://encodex/queue' } });
  }, 500);
  await new Promise((resolve) => setTimeout(resolve, 8000));
  process.stdout.write(`[probe]   total: ${messages} message(s) on stdout\n`);
  child.kill();
}

await probe(false);
await probe(true);
process.exit(0);
