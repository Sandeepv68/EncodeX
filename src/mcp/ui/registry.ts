/**
 * @fileoverview Registry of MCP App views shipped by the EncodeX server.
 *
 * Each entry binds a stable view URI (see {@link MCP_UI_VIEW_URIS}) to the HTML
 * document served for it. The registry is the single place the resource
 * registrar and tests read from, so adding a view is a one-line change and the
 * served set can never drift from the URIs referenced by tool metadata.
 */

import { MCP_UI_VIEW_URIS } from '../../shared/mcp-ui';
import { QUEUE_VIEW_HTML } from './views/queue';
import { JOB_VIEW_HTML } from './views/job';
import { MEDIA_INFO_VIEW_HTML } from './views/media-info';
import { CONVERT_VIEW_HTML } from './views/convert';
import { CONFIRM_VIEW_HTML } from './views/confirm';
import { INSPECTOR_VIEW_HTML } from './views/inspector';
import { PLAN_VIEW_HTML } from './views/plan';
import { LAB_VIEW_HTML } from './views/lab';
import { ERROR_VIEW_HTML } from './views/error';
import { BATCH_VIEW_HTML } from './views/batch';
import { WORKFLOW_VIEW_HTML } from './views/workflow';

/**
 * One servable MCP App view.
 * @interface McpUiView
 * @property {string} id - Human-readable resource name.
 * @property {string} uri - The `ui://` resource URI.
 * @property {string} description - Short description shown in `resources/list`.
 * @property {() => string} html - Returns the self-contained HTML document.
 */
export interface McpUiView {
  id: string;
  uri: string;
  description: string;
  html: () => string;
}

/**
 * All views currently served by EncodeX. Order is stable for deterministic
 * `resources/list` output in tests.
 * @const {McpUiView[]}
 */
export const MCP_UI_VIEWS: McpUiView[] = [
  {
    id: 'EncodeX queue view',
    uri: MCP_UI_VIEW_URIS.queue,
    description: 'Live conversion queue with per-job progress and status.',
    html: () => QUEUE_VIEW_HTML,
  },
  {
    id: 'EncodeX job view',
    uri: MCP_UI_VIEW_URIS.job,
    description: 'Single conversion job with live progress, paths, and errors.',
    html: () => JOB_VIEW_HTML,
  },
  {
    id: 'EncodeX media-info view',
    uri: MCP_UI_VIEW_URIS.mediaInfo,
    description: 'Container and per-stream metadata for a probed media file.',
    html: () => MEDIA_INFO_VIEW_HTML,
  },
  {
    id: 'EncodeX convert view',
    uri: MCP_UI_VIEW_URIS.convert,
    description: 'Setup form for a conversion, pre-filled from a model proposal and tracked live.',
    html: () => CONVERT_VIEW_HTML,
  },
  {
    id: 'EncodeX confirm view',
    uri: MCP_UI_VIEW_URIS.confirm,
    description: 'Confirmation card for a proposed operation; runs it only when the user approves.',
    html: () => CONFIRM_VIEW_HTML,
  },
  {
    id: 'EncodeX inspector view',
    uri: MCP_UI_VIEW_URIS.inspector,
    description: 'Plain-language media diagnosis: key facts, findings by severity, and next steps.',
    html: () => INSPECTOR_VIEW_HTML,
  },
  {
    id: 'EncodeX plan view',
    uri: MCP_UI_VIEW_URIS.plan,
    description: 'Conversion plan (settings + rationale) and output size estimate for review.',
    html: () => PLAN_VIEW_HTML,
  },
  {
    id: 'EncodeX lab view',
    uri: MCP_UI_VIEW_URIS.lab,
    description: 'Measured size-target compression: candidate ladder, every attempt, and the best measured fit.',
    html: () => LAB_VIEW_HTML,
  },
  {
    id: 'EncodeX error view',
    uri: MCP_UI_VIEW_URIS.error,
    description: 'Plain-language error explanation with likely causes and one-click fixes.',
    html: () => ERROR_VIEW_HTML,
  },
  {
    id: 'EncodeX batch view',
    uri: MCP_UI_VIEW_URIS.batch,
    description: 'Batch confirmation plus a live per-file dashboard over the shared job queue.',
    html: () => BATCH_VIEW_HTML,
  },
  {
    id: 'EncodeX workflow view',
    uri: MCP_UI_VIEW_URIS.workflow,
    description: 'Typed workflow dry-run (ordered steps and dependencies) and its per-step execution report.',
    html: () => WORKFLOW_VIEW_HTML,
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
