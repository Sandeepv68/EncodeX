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

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import { MCP_UI_RESOURCE_MIME_TYPE } from '../../shared/mcp-ui';
import { MCP_UI_VIEWS } from './registry';

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
export const MCP_UI_RESOURCE_META = {
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
 * @param {McpServer} server - The server being constructed.
 * @returns {void}
 */
export function registerUiResources(server: McpServer): void {
  for (const view of MCP_UI_VIEWS) {
    registerAppResource(server, view.id, view.uri, { description: view.description, _meta: MCP_UI_RESOURCE_META }, async () => ({
      contents: [
        {
          uri: view.uri,
          mimeType: MCP_UI_RESOURCE_MIME_TYPE,
          text: view.html(),
          _meta: MCP_UI_RESOURCE_META,
        },
      ],
    }));
  }
}
