/**
 * @fileoverview Routes `console.log` to stderr for stdio protocol entries.
 *
 * The MCP stdio transport reserves stdout for newline-delimited JSON-RPC
 * frames. `Logger.debug`/`info` write through `console.log`, so a single log
 * line on stdout corrupts the protocol. Worse, when a large response is written
 * through the transport's own descriptor handle, a concurrent log write can
 * stall the response mid-frame.
 *
 * This module must be imported before any module that may log while it is
 * being evaluated. Static imports are evaluated in source order, so a
 * side-effect import of a bootstrap that calls
 * {@link redirectConsoleLogToStderr} first keeps stdout pristine from the very
 * first line.
 */

import { format as formatArgs } from 'util';

/**
 * Replaces `console.log` with a writer that targets stderr.
 *
 * `console.warn`/`console.error` already target stderr, so only `console.log`
 * needs redirecting. Re-running this is harmless: the replacement writes
 * directly to stderr instead of delegating to the previous implementation.
 * @returns {void}
 */
export function redirectConsoleLogToStderr(): void {
  console.log = (...args: unknown[]) => {
    process.stderr.write(`${formatArgs(...args)}\n`);
  };
}
