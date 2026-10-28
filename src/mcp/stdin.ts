/**
 * @fileoverview The stdin stream the MCP server reads its protocol from.
 *
 * The MCP server talks over raw file descriptors (fd 0 / fd 1) rather than
 * `process.stdin` / `process.stdout`: on Windows, Electron's main process
 * does not relay piped stdin through `process.stdin`, but raw fd 0 reads work.
 *
 * The MCP 2.x stdio transport closes itself the moment its input ends, and
 * under Electron the descriptor reaches end-of-file as soon as the process
 * starts (Chromium owns stdin). There the data is still forwarded, but the
 * stream is never ended, so the session survives. Under plain Node an
 * end-of-file really does mean the host left, and the transport is left to
 * close the session as the protocol prescribes.
 */

import * as fs from 'fs';
import { PassThrough, Readable } from 'stream';

/**
 * Builds the input stream the MCP transport reads JSON-RPC messages from.
 * @param {boolean} isElectron - Whether the server runs inside Electron.
 * @param {Readable} [source] - The stream to read from; raw fd 0 by default.
 * @returns {Readable} A readable stream over the server's input.
 */
export function createStdinInput(isElectron: boolean, source?: Readable): Readable {
  const input = source ?? fs.createReadStream(null as unknown as fs.PathLike, { fd: 0, autoClose: false });
  if (!isElectron) return input;

  const sink = new PassThrough();
  input.on('data', (chunk: Buffer) => sink.push(chunk));
  input.on('error', () => undefined);
  return sink;
}
