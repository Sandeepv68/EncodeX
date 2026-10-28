/**
 * @fileoverview Loader for the standalone MCP App bundle.
 *
 * Every `ui://` resource EncodeX serves is the same self-contained document:
 * React, MUI, the `ext-apps` App class and all thirteen views. The server
 * injects a tiny bootstrap that names the view to render, so one document
 * serves every resource and the host fetches it once.
 *
 * The bundle is a build artefact (`npm run build:mcp-ui`) and is read from disk
 * at runtime rather than embedded in the server, so the server package stays
 * small and the bundle can be rebuilt without touching the TypeScript.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Name of the built bundle, relative to the `dist/mcp-ui` folder. @const {string} */
const BUNDLE_FILENAME = 'views.html';

/**
 * Finds the built bundle.
 *
 * The lookup walks up from this module so it works both from the compiled
 * `dist/mcp/ui` layout and from the TypeScript sources during tests.
 * @returns {string} The absolute path of the bundle.
 * @throws {Error} When the bundle was not built.
 */
export function resolveBundlePath(searchRoot: string = __dirname): string {
  const override = process.env.ENCODEX_MCP_UI_BUNDLE;
  if (override) {
    // An explicit override is exclusive: falling back to another bundle would
    // serve a document the caller did not ask for.
    if (!fs.existsSync(override)) {
      throw new Error(`The MCP App bundle was not found at ${override}. Run "npm run build:mcp-ui" to build it.`);
    }
    return override;
  }
  const candidates: string[] = [];
  let dir = searchRoot;
  for (let depth = 0; depth < 6; depth += 1) {
    candidates.push(path.join(dir, 'dist', 'mcp-ui', BUNDLE_FILENAME));
    candidates.push(path.join(dir, 'mcp-ui', BUNDLE_FILENAME));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`The MCP App bundle was not found. Run "npm run build:mcp-ui" to build it (looked in ${candidates.join(', ')}).`);
}

/** Cached bundle document. @type {string | null} */
let cachedBundle: string | null = null;

/**
 * Reads the built bundle.
 * @returns {string} The bundle document.
 * @throws {Error} When the bundle was not built.
 */
export function loadBundle(): string {
  if (cachedBundle === null) {
    cachedBundle = fs.readFileSync(resolveBundlePath(), 'utf8');
  }
  return cachedBundle;
}

/**
 * Builds the document served for a view.
 *
 * The bootstrap runs before the bundle script, so the bundle knows which view
 * to mount. It is deliberately tiny and contains no data from the server.
 * @param {string} viewId - The id of the view to render.
 * @param {string} [source] - The bundle to build from; the built bundle is read
 *   from disk when omitted.
 * @returns {string} The self-contained document.
 * @throws {Error} When the bundle was not built.
 */
export function buildViewDocument(viewId: string, source?: string): string {
  const bundle = source ?? loadBundle();
  const bootstrap = `<script>window.__ENCODEX_VIEW__=${JSON.stringify(viewId)};</script>`;
  const headIndex = bundle.indexOf('<head>');
  if (headIndex < 0) return bootstrap + bundle;
  const insertAt = headIndex + '<head>'.length;
  return bundle.slice(0, insertAt) + bootstrap + bundle.slice(insertAt);
}

/**
 * Drops the cached bundle; used by tests that swap the bundle on disk.
 * @returns {void}
 */
export function clearBundleCache(): void {
  cachedBundle = null;
}
