/**
 * @fileoverview Shared contract for MCP Apps (SEP-1865) support in EncodeX.
 *
 * MCP Apps let a tool declare an interactive UI resource (a `ui://` URI) that a
 * compliant host (Claude, VS Code, ChatGPT, Goose) fetches via `resources/read`
 * and renders in a sandboxed iframe. Hosts that do not support the extension
 * fall back to the tool's normal text result, so the surface stays
 * backwards-compatible.
 *
 * This module is the single source of truth for the extension identifier, the
 * resource MIME type, the view URIs EncodeX ships, and the structured-content
 * shapes delivered to each view. It is dependency-free so it can be imported
 * from the MCP server, tests, and tooling alike.
 *
 * Protocol reference: https://modelcontextprotocol.io/extensions/apps/overview
 */

/**
 * MCP extension identifier advertised in the server's `extensions`
 * capabilities and detected on clients via {@link McpUiClientCapabilities}.
 * @const {string}
 */
export const MCP_UI_EXTENSION_ID = 'io.modelcontextprotocol/ui';

/**
 * MIME type that marks an HTML resource as an MCP App view.
 * @const {string}
 */
export const MCP_UI_RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

/**
 * URI scheme used by every MCP App view resource.
 * @const {string}
 */
export const MCP_UI_URI_SCHEME = 'ui://';

/**
 * Canonical view URIs shipped by EncodeX.
 *
 * These are the stable identifiers referenced by tool `_meta.ui.resourceUri`
 * and served by `registerUiResources`. Additional views (profiles,
 * capabilities) are reserved here so the identifiers never drift.
 * @const {Record<string, string>}
 */
export const MCP_UI_VIEW_URIS = {
  queue: 'ui://encodex/queue',
  job: 'ui://encodex/job',
  mediaInfo: 'ui://encodex/media-info',
  convert: 'ui://encodex/convert',
  profiles: 'ui://encodex/profiles',
  capabilities: 'ui://encodex/capabilities',
} as const;

/**
 * Identifier of a shipped view, derived from {@link MCP_UI_VIEW_URIS}.
 * @typedef {keyof typeof MCP_UI_VIEW_URIS} McpUiViewId
 */
export type McpUiViewId = keyof typeof MCP_UI_VIEW_URIS;

/**
 * One entry of the job status returned to the queue/job views. Mirrors the
 * job manager's serialized shape without importing it, keeping this contract
 * usable from any process.
 * @interface McpUiJob
 * @property {string} id - Stable job id.
 * @property {string} input - Absolute input path.
 * @property {string} output - Absolute output path.
 * @property {string} status - Lifecycle status (queued, running, done, ...).
 * @property {number} progress - Completion percentage (0-100).
 */
export interface McpUiJob {
  id: string;
  input: string;
  output: string;
  status: string;
  progress: number;
}

/**
 * Client capability payload advertised by MCP Apps hosts under
 * {@link MCP_UI_EXTENSION_ID}; presence of the MIME type signals support.
 * @interface McpUiClientCapabilities
 * @property {string[]} [mimeTypes] - Supported UI resource MIME types.
 */
export interface McpUiClientCapabilities {
  mimeTypes?: string[];
}

/**
 * True when the given client capabilities advertise MCP Apps support with the
 * HTML view MIME type. Kept host-agnostic (no SDK dependency) so tool
 * registration and tests can branch on capability support.
 * @param {unknown} capabilities - The `extensions` value from client caps.
 * @returns {boolean} True when the host can render EncodeX views.
 */
export function supportsMcpUi(capabilities: unknown): boolean {
  if (!capabilities || typeof capabilities !== 'object') return false;
  const mimeTypes = (capabilities as McpUiClientCapabilities).mimeTypes;
  return Array.isArray(mimeTypes) && mimeTypes.includes(MCP_UI_RESOURCE_MIME_TYPE);
}
