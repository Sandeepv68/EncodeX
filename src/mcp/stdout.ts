/**
 * @fileoverview The stdout stream the MCP server writes its protocol to.
 *
 * The transport writes newline-delimited JSON-RPC frames to file descriptor 1.
 * A plain `fs.WriteStream` over that descriptor is not enough: Electron's
 * Chromium runtime leaves the inherited standard descriptors in non-blocking
 * mode, so a frame larger than the pipe buffer is written only partly and the
 * next write reports `EAGAIN`. Node's own writer treats a zero-byte write as
 * a failure after five attempts and destroys the stream, which tears the MCP
 * session down in the middle of a response - the host then waits for a
 * response that never arrives.
 *
 * This writer writes the whole frame and waits for the descriptor to become
 * writable instead of giving up, so a large frame goes out intact on every
 * platform.
 */

import * as fs from 'fs';
import { Writable } from 'stream';

/** Delay before retrying a write to a descriptor that is not ready. @const {number} */
const RETRY_DELAY_MS = 5;

/**
 * Writes a whole buffer to a descriptor.
 *
 * The write loop covers the three ways a descriptor can refuse data: a
 * partial write (the pipe buffer filled up), `EAGAIN` (the descriptor is in
 * non-blocking mode and nothing can be written right now), and a plain error
 * (which is reported to the caller).
 *
 * @param {number} fd - The descriptor to write to.
 * @param {Buffer} chunk - The bytes to write.
 * @returns {Promise<void>} Resolves once every byte is written.
 * @throws {Error} Propagates a write error other than `EAGAIN`.
 */
export function writeAll(fd: number, chunk: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    let offset = 0;

    const attempt = (): void => {
      fs.write(fd, chunk, offset, chunk.length - offset, null, (error, written) => {
        if (error) {
          // The descriptor is in non-blocking mode and the pipe is full. Wait
          // for it to drain instead of failing the stream.
          if (error.code === 'EAGAIN') {
            setTimeout(attempt, RETRY_DELAY_MS);
            return;
          }
          reject(error);
          return;
        }
        offset += written;
        if (offset < chunk.length) {
          // A partial write: the rest of the frame goes out in the next call.
          attempt();
          return;
        }
        resolve();
      });
    };

    attempt();
  });
}

/**
 * Builds the output stream the MCP transport writes JSON-RPC messages to.
 *
 * The stream is backed by the raw descriptor rather than `process.stdout`:
 * Electron's main process does not relay `process.stdout` reliably, and the
 * protocol must reach the host that spawned the app.
 *
 * @param {number} [fd] - The descriptor to write to; 1 (stdout) by default.
 * @returns {Writable} A writable stream over the descriptor.
 */
export function createStdout(fd: number = 1): Writable {
  return new (class extends Writable {
    /**
     * Writes one chunk to the descriptor.
     * @param {Buffer} chunk - The bytes to write.
     * @param {BufferEncoding} _encoding - The encoding of the chunk (unused).
     * @param {(error?: Error | null) => void} callback - Called when the write settles.
     * @returns {void}
     */
    _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
      writeAll(fd, chunk).then(
        () => callback(),
        (error: Error) => callback(error),
      );
    }
  })();
}
