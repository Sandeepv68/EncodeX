/**
 * @fileoverview The MCP server's stdio session.
 *
 * The transport reads raw file descriptors (fd 0 / fd 1) rather than
 * `process.stdin` / `process.stdout`: on Windows, Electron's main process
 * does not relay piped stdin through `process.stdin`, but raw fd 0 reads work.
 * Using the raw descriptors is equivalent under plain Node and keeps both
 * launch paths identical.
 */

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { Readable, Writable } from 'stream';
import * as fs from 'fs';
import { Logger } from '../shared/logger';
import { createMcpServer } from './server';
import { createStdinInput } from './stdin';

const log = new Logger('mcp/run');

/**
 * Builds the output stream the MCP transport writes JSON-RPC messages to.
 * Uses raw fd 1 for parity with the input stream and to avoid any
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
  const transport = new StdioServerTransport(createStdinInput(Boolean(process.versions.electron)), createOutput());
  await server.connect(transport);
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
}
