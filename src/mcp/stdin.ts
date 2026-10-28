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
 *
 * The descriptor can also be in non-blocking mode, in which case a read that
 * finds no data reports `EAGAIN` instead of waiting. Node's own reader treats
 * that as a fatal error and destroys the stream, which silently ends the
 * session; this reader waits for the data instead.
 */

import * as fs from 'fs';
import { PassThrough, Readable } from 'stream';

/** Delay before retrying a read from a descriptor that has no data yet. @const {number} */
const RETRY_DELAY_MS = 5;

/**
 * Reads a stream from a raw descriptor.
 *
 * @param {number} fd - The descriptor to read from.
 * @returns {Readable} A readable stream over the descriptor.
 */
function createFdReader(fd: number): Readable {
  return new (class extends Readable {
    /**
     * Reads the next chunk from the descriptor.
     * @param {number} size - The number of bytes the consumer wants.
     * @returns {void}
     */
    _read(size: number): void {
      const buffer = Buffer.allocUnsafeSlow(Math.max(size, 4096));

      const attempt = (): void => {
        fs.read(fd, buffer, 0, buffer.length, null, (error, bytesRead) => {
          if (error) {
            // The descriptor is in non-blocking mode and has nothing to give
            // right now. Wait for the next chunk instead of failing the stream.
            if (error.code === 'EAGAIN') {
              setTimeout(attempt, RETRY_DELAY_MS);
              return;
            }
            this.destroy(error);
            return;
          }
          if (bytesRead === 0) {
            // End of file: the host closed its end of the pipe.
            this.push(null);
            return;
          }
          this.push(buffer.subarray(0, bytesRead));
        });
      };

      attempt();
    }
  })();
}

/**
 * Builds the input stream the MCP transport reads JSON-RPC messages from.
 * @param {boolean} isElectron - Whether the server runs inside Electron.
 * @param {Readable} [source] - The stream to read from; raw fd 0 by default.
 * @param {number} [fd] - The descriptor to read from when no source is given.
 * @returns {Readable} A readable stream over the server's input.
 */
export function createStdinInput(isElectron: boolean, source?: Readable, fd: number = 0): Readable {
  const input = source ?? createFdReader(fd);
  if (!isElectron) return input;

  const sink = new PassThrough();
  input.on('data', (chunk: Buffer) => sink.push(chunk));
  input.on('error', () => undefined);
  return sink;
}
