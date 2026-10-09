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
 * Registers every view in {@link MCP_UI_VIEWS} on the server.
 * @param {McpServer} server - The server being constructed.
 * @returns {void}
 */
export function registerUiResources(server: McpServer): void {
  for (const view of MCP_UI_VIEWS) {
    registerAppResource(server, view.id, view.uri, { description: view.description }, async () => ({
      contents: [
        {
          uri: view.uri,
          mimeType: MCP_UI_RESOURCE_MIME_TYPE,
          text: view.html(),
        },
      ],
    }));
  }
}
