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
    description: 'Conversion setup form that starts a job and tracks its progress.',
    html: () => CONVERT_VIEW_HTML,
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
