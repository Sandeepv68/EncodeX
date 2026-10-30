/**
 * @fileoverview Registry of MCP App views shipped by the EncodeX server.
 *
 * Each entry binds a stable view URI (see {@link MCP_UI_VIEW_URIS}) to the view
 * it renders. The document itself is the shared React bundle (see
 * `bundle.ts`), so the registry only carries the identity of each view.
 *
 * The registry is the single place the resource registrar and the tests read
 * from, so adding a view is a one-line change and the served set can never
 * drift from the URIs referenced by tool metadata.
 */

import { MCP_UI_VIEW_URIS } from '../../shared/mcp-ui';
import type { McpUiView } from './types';

export type { McpUiView } from './types';

/**
 * All views currently served by EncodeX. Order is stable for deterministic
 * `resources/list` output in tests.
 * @const {McpUiView[]}
 */
export const MCP_UI_VIEWS: McpUiView[] = [
  {
    viewId: 'queue',
    id: 'EncodeX queue view',
    uri: MCP_UI_VIEW_URIS.queue,
    description: 'Live conversion queue with per-job progress and status.',
  },
  {
    viewId: 'job',
    id: 'EncodeX job view',
    uri: MCP_UI_VIEW_URIS.job,
    description: 'Single conversion job with live progress, paths, and errors.',
  },
  {
    viewId: 'mediaInfo',
    id: 'EncodeX media-info view',
    uri: MCP_UI_VIEW_URIS.mediaInfo,
    description: 'Container and per-stream metadata for a probed media file.',
  },
  {
    viewId: 'convert',
    id: 'EncodeX convert view',
    uri: MCP_UI_VIEW_URIS.convert,
    description: 'Setup form for a conversion, pre-filled from a model proposal and tracked live.',
  },
  {
    viewId: 'confirm',
    id: 'EncodeX confirm view',
    uri: MCP_UI_VIEW_URIS.confirm,
    description: 'Confirmation card for a proposed operation; runs it only when the user approves.',
  },
  {
    viewId: 'inspector',
    id: 'EncodeX inspector view',
    uri: MCP_UI_VIEW_URIS.inspector,
    description: 'Plain-language media diagnosis: key facts, findings by severity, and next steps.',
  },
  {
    viewId: 'plan',
    id: 'EncodeX plan view',
    uri: MCP_UI_VIEW_URIS.plan,
    description: 'Conversion plan (settings + rationale) and output size estimate for review.',
  },
  {
    viewId: 'lab',
    id: 'EncodeX compression lab view',
    uri: MCP_UI_VIEW_URIS.lab,
    description: 'Measured size-target compression: candidate ladder, every attempt, and the best measured fit.',
  },
  {
    viewId: 'error',
    id: 'EncodeX error view',
    uri: MCP_UI_VIEW_URIS.error,
    description: 'Plain-language error explanation with likely causes and one-click fixes.',
  },
  {
    viewId: 'batch',
    id: 'EncodeX batch view',
    uri: MCP_UI_VIEW_URIS.batch,
    description: 'Batch confirmation plus a live per-file dashboard over the shared job queue.',
  },
  {
    viewId: 'workflow',
    id: 'EncodeX workflow view',
    uri: MCP_UI_VIEW_URIS.workflow,
    description: 'Typed workflow dry-run (ordered steps and dependencies) and its per-step execution report.',
  },
  {
    viewId: 'profiles',
    id: 'EncodeX profiles view',
    uri: MCP_UI_VIEW_URIS.profiles,
    description: 'The built-in conversion profiles with their containers and codecs.',
  },
  {
    viewId: 'capabilities',
    id: 'EncodeX capabilities view',
    uri: MCP_UI_VIEW_URIS.capabilities,
    description: 'The encoders and hardware acceleration methods available on this machine.',
  },
];

/**
 * Looks up a view by its URI.
 * @param {string} uri - The `ui://` resource URI.
 * @returns {McpUiView | undefined} The matching view, or undefined.
 */
export function findUiView(uri: string): McpUiView | undefined {
  return MCP_UI_VIEWS.find((view) => view.uri === uri);
}
