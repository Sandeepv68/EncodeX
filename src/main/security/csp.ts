/**
 * @fileoverview Ships the renderer Content-Security-Policy as a response header.
 *
 * Electron's security advisory only inspects `Content-Security-Policy` response headers, so a policy
 * declared via `<meta http-equiv>` passes the check as "no CSP" and the app warns on every launch.
 * Injecting the real header through `session.webRequest.onHeadersReceived` fixes the warning for
 * every document the session loads - the packaged `file://` renderer, the Vite dev server, and the
 * splash window alike - before the renderer ever parses a frame.
 *
 * The header is written on every response, not just top-level documents. Sub-resource responses are
 * not governed by their own CSP header (enforcement comes from the initiating document's policy), so
 * this cannot block any asset the policy string itself would allow; non-document requests merely
 * carry a header nothing reads.
 */

import type { Session } from 'electron';
import { CONTENT_SECURITY_POLICY, DEV_CONTENT_SECURITY_POLICY } from '../../shared/csp';

/** Response header that carries the renderer policy. @const {string} */
export const CSP_HEADER_NAME = 'Content-Security-Policy';

/**
 * Registers a per-response `Content-Security-Policy` header on {session}.
 *
 * @param {Session} session - The session whose responses get the header; pass
 *   `session.defaultSession` to cover the main and splash windows.
 * @param {object} [options] - Optional install options.
 * @param {boolean} [options.dev=false] - True in development mode, where the
 *   Vite dev server injects an inline React-refresh preamble that the strict
 *   production `script-src 'self'` would block (blank window).
 * @returns {() => void} A cleanup that removes the registered handler.
 */
export function installContentSecurityPolicy(session: Session, options: { dev?: boolean } = {}): () => void {
  const policy = options.dev ? DEV_CONTENT_SECURITY_POLICY : CONTENT_SECURITY_POLICY;
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...(details.responseHeaders ?? {}),
        [CSP_HEADER_NAME]: [policy],
      },
    });
  });
  return () => {
    session.webRequest.onHeadersReceived(null);
  };
}
