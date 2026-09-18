/**
 * @fileoverview Standalone MCP server entry point for EncodeX.
 *
 * Connect the shared {@link createMcpServer} factory to a stdio transport so
 * any MCP host (Claude Desktop, Claude Code, VS Code, Cursor, custom agents)
 * can list and call EncodeX's conversion tools.
 *
 * Launch paths:
 *
 *  - Node (development / source checkouts): `node dist/mcp/index.js`
 *  - Packaged application: `<EncodeX-binary> --mcp` (the Electron main process
 *    reuses {@link runMcpServer} so bundled ffmpeg resolves automatically)
 *
 * The stdio transport reserves stdout for JSON-RPC protocol messages only;
 * every internal log line is redirected to stderr so the protocol stream stays
 * parseable. This patch applies solely to this standalone entry point: the
 * Electron main process performs its own equivalent routing when started with
 * `--mcp` (see src/main/index.ts).
 */

import { format as formatArgs } from 'util';
import { runMcpServer } from './run';

// Keep stdout reserved for MCP JSON-RPC messages: every logger line (which
// routes through console.log) is redirected to stderr, mirroring the CLI-mode
// stream-routing contract. Must run before any Logger emits.
console.log = (...args: unknown[]) => {
  process.stderr.write(`${formatArgs(...args)}\n`);
};

void runMcpServer().catch((err: unknown) => {
  console.error('EncodeX MCP server failed:', err);
  process.exit(1);
});
