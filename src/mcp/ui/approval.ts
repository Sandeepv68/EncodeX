/**
 * @fileoverview User-approval gate for mutating MCP tools.
 *
 * When the connected client advertises MCP Apps support, the server refuses to
 * run a mutating operation straight from a model call: it answers with a
 * {@link McpUiConfirmation} the app renders, and the operation only runs when
 * the user clicks through to the app-only `commit_operation` tool. Hosts
 * without the extension keep the historical headless behaviour and execute
 * immediately, so the tool surface stays backwards-compatible.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  MCP_UI_EXTENSION_ID,
  MCP_UI_VIEW_URIS,
  supportsMcpUi,
  type McpUiConfirmation,
  type McpUiConfirmationField,
} from '../../shared/mcp-ui';

/**
 * Name of the app-only executor that runs an operation the user confirmed.
 * @const {string}
 */
export const COMMIT_OPERATION_TOOL = 'commit_operation';

/**
 * The mutating tools that require user confirmation before they run. Kept in
 * sync with the `commit_operation` `tool` enum so the two can never drift.
 * @const {readonly string[]}
 */
export const CONFIRMABLE_OPERATIONS = [
  'convert_media',
  'compress_image',
  'extract_audio',
  'cut_video',
  'batch_convert',
  'remux_media',
  'demux_media',
] as const;

/**
 * True when the connected client advertises MCP Apps support, so the server
 * should hand mutating calls to the app for confirmation instead of running
 * them. Reads the live client capabilities captured during `initialize`;
 * plain MCP clients (CLI, tests, agents) return false and use the headless path.
 * @param {McpServer} server - The server handling the call.
 * @returns {boolean} True when the host can render and confirm views.
 */
export function hostSupportsMcpApps(server: McpServer): boolean {
  const capabilities = server.server.getClientCapabilities() as { extensions?: Record<string, unknown> } | undefined;
  return supportsMcpUi(capabilities?.extensions?.[MCP_UI_EXTENSION_ID]);
}

/**
 * Builds a single confirmation detail row, dropping empty values so views only
 * render the fields the user actually set.
 * @param {string} label - The field label.
 * @param {unknown} value - The field value.
 * @returns {McpUiConfirmationField | undefined} The row, or undefined when empty.
 */
export function confirmationField(label: string, value: unknown): McpUiConfirmationField | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return { label, value: typeof value === 'string' ? value : String(value) };
}

/**
 * Collects the defined rows from {@link confirmationField} calls.
 * @param {Array<McpUiConfirmationField | undefined>} rows - Candidate rows.
 * @returns {McpUiConfirmationField[]} Only the defined rows.
 */
export function confirmationDetails(rows: Array<McpUiConfirmationField | undefined>): McpUiConfirmationField[] {
  return rows.filter((row): row is McpUiConfirmationField => row !== undefined);
}

/**
 * Wraps a pending confirmation in the tool result shape handed to the host.
 * The text mirrors the machine-readable payload for hosts that only show text,
 * and `structuredContent` is what the confirm view renders.
 * @param {McpUiConfirmation} confirmation - The pending confirmation.
 * @returns {{content: Array<{type: 'text'; text: string}>; structuredContent: {confirmation: McpUiConfirmation}}} Tool result.
 */
export function confirmationResult(confirmation: McpUiConfirmation): {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: { confirmation: McpUiConfirmation };
} {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          status: 'awaiting-confirmation',
          operation: confirmation.operation,
          summary: confirmation.summary,
          args: confirmation.args,
        }),
      },
    ],
    structuredContent: { confirmation },
  };
}

/**
 * The `ui://` resource a tool should advertise so the host renders the right
 * view: the rich convert form keeps its bespoke view, batches use the batch
 * dashboard, everything else uses the generic confirmation view.
 * @param {string} tool - The mutating tool name.
 * @returns {string} The view URI to attach to the tool metadata.
 */
export function confirmationViewUri(tool: string): string {
  if (tool === 'convert_media') return MCP_UI_VIEW_URIS.convert;
  if (tool === 'batch_convert') return MCP_UI_VIEW_URIS.batch;
  return MCP_UI_VIEW_URIS.confirm;
}
