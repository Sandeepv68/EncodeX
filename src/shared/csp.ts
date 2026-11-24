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
 * - `DEV_CONTENT_SECURITY_POLICY` exists for one reason: in dev Vite injects the
 *   `@vitejs/plugin-react` refresh preamble as an *inline* module script, and `script-src 'self'`
 *   refuses it. The refusal surfaces as an uncaught `can't detect preamble` error, the module graph
 *   aborts, and the window paints white with no other symptom. The relaxed policy is used only when
 *   the main process is running in development mode (`--dev` / `NODE_ENV=development`); packaged
 *   builds serve a bundle with no inline scripts and keep the strict policy below.
 *
 * Keep the guard in `src/renderer/__tests__/csp.test.ts` green when this string changes.
 */
const POLICY_PREFIX = "default-src 'self'";
const POLICY_SUFFIX = "style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:;";

function safeHttpOrigin(host?: string): string | null {
  if (!host) return null;
  try {
    const url = new URL(host);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function posthogAssetOrigin(host?: string): string | null {
  const origin = safeHttpOrigin(host);
  if (!origin) return null;
  const url = new URL(origin);
  const hostname = url.hostname;
  if (hostname === 'app.posthog.com') return 'https://us-assets.i.posthog.com';
  const match = /^(us|eu|us-assets|eu-assets)\.i\.posthog\.com$/.exec(hostname);
  if (!match) return null;
  const region = match[1].startsWith('us') ? 'us' : 'eu';
  return `${url.protocol}//${region}-assets.i.posthog.com`;
}

export function buildContentSecurityPolicy(posthogHost?: string, dev = false): string {
  const origin = safeHttpOrigin(posthogHost);
  const assetOrigin = posthogAssetOrigin(posthogHost);
  const allowPosthog = origin ? ` ${origin}` : '';
  const allowPosthogAssets = assetOrigin ? ` ${assetOrigin}` : '';
  const scriptSrc = `${dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'"}${allowPosthogAssets}`;
  return `${POLICY_PREFIX}; ${scriptSrc}; ${POLICY_SUFFIX} connect-src 'self' aptabase-ipc:${allowPosthog}${allowPosthogAssets}`;
}

/** The strict policy shipped in production builds. @const {string} */
export const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy();

/**
 * The development policy: identical to the production one except that
 * `script-src` also permits inline scripts, which Vite's React refresh preamble
 * requires. Never used outside development mode.
 * @const {string}
 */
export const DEV_CONTENT_SECURITY_POLICY = buildContentSecurityPolicy(undefined, true);
