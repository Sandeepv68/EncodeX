/**
 * @fileoverview Pure MCP server runner for EncodeX.
 * Exposes {@link runMcpServer}, which connects the shared
 * {@link createMcpServer} factory to a stdio transport. This module has no
 * process-level side effects (no console patching, no entry-point guards) so it
 * is safe to import from the Electron main process without altering GUI-mode
 * logging.
 *
 * Callers are responsible for keeping stdout reserved for MCP JSON-RPC
 * messages; the standalone entry (`index.ts`) and the Electron `--mcp` branch
 * both redirect `console.log` to stderr before invoking this.
 *
 * The transport is built on raw file-descriptor streams (fd 0 / fd 1) rather
 * than `process.stdin`/`process.stdout`. On Windows, Electron's main process
 * does not relay piped stdin through `process.stdin`, but raw fd 0 reads work;
 * using the raw descriptors is equivalent under plain Node and keeps both
 * launch paths identical.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Readable, Writable } from 'stream';
import * as fs from 'fs';
import { Logger } from '../shared/logger';
import { createMcpServer } from './server';

const log = new Logger('mcp/run');

/**
 * Builds the input stream the MCP transport reads JSON-RPC messages from.
 * Uses raw fd 0 so piped stdin reaches the server under Electron on Windows,
 * where `process.stdin` does not deliver piped data.
 * @returns {Readable} A readable stream over stdin (fd 0).
 */
function createInput(): Readable {
  return fs.createReadStream(null as unknown as fs.PathLike, { fd: 0, autoClose: false });
}

/**
 * Builds the output stream the MCP transport writes JSON-RPC messages to.
 * Uses raw fd 1 for parity with {@link createInput} and to avoid any
 * Electron-specific `process.stdout` behavior.
 * @returns {Writable} A writable stream over stdout (fd 1).
 */
function createOutput(): Writable {
  return fs.createWriteStream(null as unknown as fs.PathLike, { fd: 1, autoClose: false });
}

/**
 * Starts the EncodeX MCP server over stdio and resolves once the connection
 * ends. Used by both the standalone Node entry point and the Electron
 * main-process `--mcp` mode.
 * @returns {Promise<void>} Resolves when the transport session closes.
 * @throws {Error} Re-throws registration/connection failures to the caller.
 */
export async function runMcpServer(): Promise<void> {
  log.info('Starting EncodeX MCP server over stdio');
  const server = createMcpServer();
  const transport = new StdioServerTransport(createInput(), createOutput());
  await server.connect(transport);
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
}
