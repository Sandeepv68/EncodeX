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

import type { McpUiClientCapabilities } from './types';

export type {
  McpUiViewId,
  McpViewAttachment,
  McpUiJob,
  McpUiConfirmationField,
  McpUiConfirmation,
  McpUiStream,
  McpUiMediaInfo,
  McpUiFinding,
  McpUiAnalysis,
  McpUiPlan,
  McpUiEstimate,
  McpUiLabAttempt,
  McpUiLab,
  McpUiErrorFix,
  McpUiErrorExplanation,
  McpUiWorkflowStep,
  McpUiWorkflowPlan,
  McpUiWorkflowResult,
  McpUiBatchEntry,
  McpUiProfile,
  McpUiCapabilities,
  McpUiConfirmationPayload,
  McpUiClientCapabilities,
} from './types';

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
  inspector: 'ui://encodex/inspector',
  plan: 'ui://encodex/plan',
  lab: 'ui://encodex/lab',
  error: 'ui://encodex/error',
  batch: 'ui://encodex/batch',
  workflow: 'ui://encodex/workflow',
  profiles: 'ui://encodex/profiles',
  capabilities: 'ui://encodex/capabilities',
} as const;

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
