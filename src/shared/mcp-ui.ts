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
  confirm: 'ui://encodex/confirm',
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
 * One label/value row of a confirmation rendered before an operation runs.
 * @interface McpUiConfirmationField
 * @property {string} label - Short field name (e.g. "Output").
 * @property {string} value - Human-readable value.
 */
export interface McpUiConfirmationField {
  label: string;
  value: string;
}

/**
 * A mutating operation awaiting explicit user approval.
 *
 * When the host supports MCP Apps, the server never runs a mutating tool from
 * a model call: it returns a confirmation instead, the app renders the details,
 * and only a user click replays {@link McpUiConfirmation.args} into the
 * app-only `commit_operation` tool. Hosts without the extension keep the old
 * headless behaviour and execute immediately (see `approval.ts`).
 * @interface McpUiConfirmation
 * @property {string} operation - Executor tool that the approval runs.
 * @property {string} title - Short imperative heading (e.g. "Cut video").
 * @property {string} summary - One-line summary of the effect.
 * @property {Record<string, unknown>} args - Raw arguments replayed verbatim.
 * @property {McpUiConfirmationField[]} [details] - Key/value rows to show.
 * @property {string[]} [warnings] - Warnings surfaced before running.
 */
export interface McpUiConfirmation {
  operation: string;
  title: string;
  summary: string;
  args: Record<string, unknown>;
  details?: McpUiConfirmationField[];
  warnings?: string[];
}

/**
 * Structured content delivered to the confirm view for a pending operation.
 * @interface McpUiConfirmationPayload
 * @property {McpUiConfirmation} confirmation - The pending confirmation.
 */
export interface McpUiConfirmationPayload {
  confirmation: McpUiConfirmation;
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
 * True when the given client capabilities advertise MCP Apps support.
 *
 * Presence of the {@link MCP_UI_EXTENSION_ID} extension is the signal (matching
 * the reference `getUiCapability` helper): unless the payload lists explicit
 * `mimeTypes` that omit the HTML view MIME type, the host can render EncodeX
 * views. Kept host-agnostic (no SDK dependency) so tool registration and tests
 * can branch on capability support.
 * @param {unknown} capabilities - The `extensions` value from client caps.
 * @returns {boolean} True when the host can render EncodeX views.
 */
export function supportsMcpUi(capabilities: unknown): boolean {
  if (!capabilities || typeof capabilities !== 'object') return false;
  const mimeTypes = (capabilities as McpUiClientCapabilities).mimeTypes;
  if (!Array.isArray(mimeTypes)) return true;
  return mimeTypes.includes(MCP_UI_RESOURCE_MIME_TYPE);
}
