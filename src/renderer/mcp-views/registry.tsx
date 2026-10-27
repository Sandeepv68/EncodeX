/**
 * @fileoverview Registry that maps a view id to its React component.
 *
 * The same registry drives the standalone bundle (which picks the view from
 * the `window.__ENCODEX_VIEW__` bootstrap the server injects) and the in-app
 * transcript (which picks the view from the attachment on the message).
 */

import type { ComponentType } from 'react';
import { MCP_UI_VIEW_URIS, type McpUiViewId } from '../../shared/mcp-ui';
import BatchView from './views/BatchView';
import CapabilitiesView from './views/CapabilitiesView';
import ConfirmView from './views/ConfirmView';
import ConvertView from './views/ConvertView';
import ErrorView from './views/ErrorView';
import InspectorView from './views/InspectorView';
import JobView from './views/JobView';
import LabView from './views/LabView';
import MediaInfoView from './views/MediaInfoView';
import PlanView from './views/PlanView';
import ProfilesView from './views/ProfilesView';
import QueueView from './views/QueueView';
import WorkflowView from './views/WorkflowView';

/** Every view EncodeX ships, keyed by its id. */
export const MCP_VIEW_COMPONENTS: Record<McpUiViewId, ComponentType> = {
  queue: QueueView,
  job: JobView,
  mediaInfo: MediaInfoView,
  convert: ConvertView,
  confirm: ConfirmView,
  inspector: InspectorView,
  plan: PlanView,
  lab: LabView,
  error: ErrorView,
  batch: BatchView,
  workflow: WorkflowView,
  profiles: ProfilesView,
  capabilities: CapabilitiesView,
};

/**
 * Finds the component of a view.
 * @param {string} viewId - The view id.
 * @returns {ComponentType | undefined} The component, or undefined for an unknown id.
 */
export function findMcpViewComponent(viewId: string): ComponentType | undefined {
  return (MCP_VIEW_COMPONENTS as Record<string, ComponentType | undefined>)[viewId];
}

/**
 * The `ui://` URI of a view id.
 * @param {McpUiViewId} viewId - The view id.
 * @returns {string} The resource URI.
 */
export function mcpViewUri(viewId: McpUiViewId): string {
  return MCP_UI_VIEW_URIS[viewId];
}
