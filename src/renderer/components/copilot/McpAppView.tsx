/**
 * @fileoverview Renders one MCP App view inside the Copilot transcript.
 *
 * The attachment carries the view id and the payload the tool returned; this
 * component resolves the view component and mounts it with the in-app host, so
 * the view looks and behaves exactly like the one an external MCP Apps host
 * renders.
 */

import { useMemo } from 'react';
import { AppIpcHost } from '../../mcp-views/AppIpcHost';
import { McpViewProvider } from '../../mcp-views/McpViewProvider';
import { findMcpViewComponent } from '../../mcp-views/registry';
import type { McpAppViewProps } from './types';

export type { McpAppViewProps };

/**
 * Renders the attached MCP App view.
 * @param {McpAppViewProps} props - Component props.
 * @returns {JSX.Element | null} The view, or nothing when the view is unknown.
 */
export default function McpAppView({ attachment }: McpAppViewProps) {
  const host = useMemo(() => new AppIpcHost(), []);
  const View = useMemo(() => findMcpViewComponent(attachment.viewId), [attachment.viewId]);

  if (!View) return null;

  return (
    <McpViewProvider host={host} initialData={attachment.structuredContent}>
      <View />
    </McpViewProvider>
  );
}
