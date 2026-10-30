/**
 * @fileoverview Type definitions for the MCP App view registry.
 * Describes a single servable MCP App view: the view id that picks the React
 * component, the resource name, the `ui://` URI, and the description shown in
 * `resources/list`.
 */

import type { McpUiViewId } from '../../shared/mcp-ui';

/**
 * One servable MCP App view.
 * @interface McpUiView
 * @property {McpUiViewId} viewId - The id of the view, used to pick the React component.
 * @property {string} id - Human-readable resource name.
 * @property {string} uri - The `ui://` resource URI.
 * @property {string} description - Short description shown in `resources/list`.
 */
export interface McpUiView {
  viewId: McpUiViewId;
  id: string;
  uri: string;
  description: string;
}
