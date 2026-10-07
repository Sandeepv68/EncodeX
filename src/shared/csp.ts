/**
 * @fileoverview The renderer Content-Security-Policy, as a single source of truth.
 *
 * EncodeX ships the policy as a `Content-Security-Policy` response header injected by the main
 * process (`session.webRequest.onHeadersReceived`, see `src/main/security/csp.ts`), not as a
 * `<meta http-equiv>` tag. Electron's security advisory inspects response headers, so a `<meta>`
 * policy makes the app look to it like it has no CSP at all and it warns on every launch. The header
 * path satisfies the advisory for both the packaged `file://` load and the Vite dev server, and it
 * covers the splash window too.
 *
 * Directives worth calling out:
 *
 * - `font-src 'self' data:` is required, not optional: Vite inlines the @fontsource Roboto subsets
 *   below its 4 KB asset limit as `data:` URIs, and without an explicit `font-src` they fall back to
 *   `default-src 'self'` and get blocked. That shipped a build where every label rendered in a
 *   fallback face while the console filled with CSP violations.
 * - `connect-src 'self' aptabase-ipc:` keeps the analytics channel working: the renderer adapter
 *   delivers events with a `fetch` to `aptabase-ipc://trackEvent`, which falls under `connect-src`.
 *
 * Keep the guard in `src/renderer/__tests__/csp.test.ts` green when this string changes.
 */
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self' aptabase-ipc:";
