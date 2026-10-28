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
 * parseable. The bootstrap import must stay first: static imports evaluate in
 * source order, and the server's module graph logs while it loads. The Electron
 * main process installs the same routing when started with `--mcp` (see
 * src/main/mcp-stdio-bootstrap.ts).
 */

import './stdio-bootstrap';
import { runMcpServer } from './run';

void runMcpServer().catch((err: unknown) => {
  console.error('EncodeX MCP server failed:', err);
  process.exit(1);
});
