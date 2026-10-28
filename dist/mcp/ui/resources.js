"use strict";
/**
 * @fileoverview Registers EncodeX's MCP App views as MCP resources.
 *
 * Views are served with the MCP Apps MIME type (`text/html;profile=mcp-app`) so
 * a compliant host can fetch them via `resources/read` and render them in a
 * sandboxed iframe. `registerAppResource` (from `@modelcontextprotocol/ext-apps`)
 * defaults that MIME type and normalizes UI metadata; the base SDK's
 * `registerResource` is used everywhere else, so this stays additive.
 *
 * This runs inside {@link createMcpServer}, which both launch paths (standalone
 * stdio and the embedded HTTP server) share, so views are exposed identically
 * in every mode.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCP_UI_RESOURCE_META = void 0;
exports.registerUiResources = registerUiResources;
const server_1 = require("@modelcontextprotocol/ext-apps/server");
const mcp_ui_1 = require("../../shared/mcp-ui");
const registry_1 = require("./registry");
const bundle_1 = require("./bundle");
/**
 * Security metadata attached to every EncodeX view resource (R0.3).
 *
 * EncodeX views are fully self-contained HTML documents (no external scripts,
 * styles, fonts, images, frames or fetches — see `MCP_UI_VIEWS`), so the CSP
 * allowlists are declared **empty**. That is the spec's secure default made
 * explicit: an undeclared or empty list means the host must block the
 * corresponding request, which keeps the views renderable under the most
 * restrictive iframe policy and documents the intent for reviewers.
 * @const {Record<string, unknown>}
 */
exports.MCP_UI_RESOURCE_META = {
    ui: {
        csp: {
            connectDomains: [],
            resourceDomains: [],
            frameDomains: [],
            baseUriDomains: [],
        },
    },
};
/**
 * Registers every view in {@link MCP_UI_VIEWS} on the server.
 *
 * The security metadata ({@link MCP_UI_RESOURCE_META}) is attached both at the
 * listing level (a static default a host can review at connection time) and on
 * each `resources/read` content item (which the spec says takes precedence).
 *
 * @param {McpServer} server - The server being constructed.
 * @param {string} [bundle] - The view bundle to serve. When omitted, the
 *   built bundle is read from disk on the first read; the test suite passes a
 *   fixture so the unit tier never depends on a build artefact.
 * @returns {void}
 */
function registerUiResources(server, bundle) {
    for (const view of registry_1.MCP_UI_VIEWS) {
        (0, server_1.registerAppResource)(server, view.id, view.uri, { description: view.description, _meta: exports.MCP_UI_RESOURCE_META }, async () => ({
            contents: [
                {
                    uri: view.uri,
                    mimeType: mcp_ui_1.MCP_UI_RESOURCE_MIME_TYPE,
                    text: (0, bundle_1.buildViewDocument)(view.viewId, bundle),
                    _meta: exports.MCP_UI_RESOURCE_META,
                },
            ],
        }));
    }
}
//# sourceMappingURL=resources.js.map