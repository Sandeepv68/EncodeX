/**
 * @fileoverview IPC handlers that back the in-app MCP App host.
 *
 * The renderer renders MCP App views; those views call tools back. The
 * handlers forward those calls to the in-process MCP client, which talks to
 * the same server (and the same job manager) the embedded HTTP server
 * exposes.
 */

import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { createError, ErrorCode, formatError } from '../../shared/errors';
import { MCP_UI_VIEW_URIS, type McpUiViewId } from '../../shared/mcp-ui';
import type { LocalMcpClient } from './local-client';

/** A view the in-app host can render. */
interface ViewDescriptor {
  viewId: McpUiViewId;
  uri: string;
  title: string;
}

/** The views the in-app host can render, with the titles it shows. */
const VIEWS: ViewDescriptor[] = [
  { viewId: 'queue', uri: MCP_UI_VIEW_URIS.queue, title: 'Queue' },
  { viewId: 'job', uri: MCP_UI_VIEW_URIS.job, title: 'Job' },
  { viewId: 'mediaInfo', uri: MCP_UI_VIEW_URIS.mediaInfo, title: 'Media info' },
  { viewId: 'convert', uri: MCP_UI_VIEW_URIS.convert, title: 'Conversion' },
  { viewId: 'confirm', uri: MCP_UI_VIEW_URIS.confirm, title: 'Confirmation' },
  { viewId: 'inspector', uri: MCP_UI_VIEW_URIS.inspector, title: 'Inspector' },
  { viewId: 'plan', uri: MCP_UI_VIEW_URIS.plan, title: 'Plan' },
  { viewId: 'lab', uri: MCP_UI_VIEW_URIS.lab, title: 'Compression lab' },
  { viewId: 'error', uri: MCP_UI_VIEW_URIS.error, title: 'Error' },
  { viewId: 'batch', uri: MCP_UI_VIEW_URIS.batch, title: 'Batch' },
  { viewId: 'workflow', uri: MCP_UI_VIEW_URIS.workflow, title: 'Workflow' },
  { viewId: 'profiles', uri: MCP_UI_VIEW_URIS.profiles, title: 'Profiles' },
  { viewId: 'capabilities', uri: MCP_UI_VIEW_URIS.capabilities, title: 'Capabilities' },
];

/**
 * Supplies the local MCP client. Set by the main process at startup; until
 * then the handlers report that the server is not ready.
 */
let clientProvider: () => Promise<LocalMcpClient | null> = async () => null;

/**
 * Registers the provider the handlers use to reach the MCP server.
 * @param {() => Promise<LocalMcpClient | null>} provider - The provider.
 * @returns {void}
 */
export function setLocalMcpClientProvider(provider: () => Promise<LocalMcpClient | null>): void {
  clientProvider = provider;
}

/**
 * Registers the MCP App view IPC handlers.
 * @returns {void}
 */
export function registerMcpUiIpc(): void {
  ipcMain.handle(IPC.MCP_UI_LIST_VIEWS, async () => VIEWS);

  ipcMain.handle(IPC.MCP_UI_CALL_TOOL, async (_event, request: { name?: string; args?: Record<string, unknown> }): Promise<unknown> => {
    const client = await clientProvider();
    if (!client) {
      throw formatError(createError(ErrorCode.UNKNOWN, 'The MCP server is not ready yet.'));
    }
    const name = typeof request?.name === 'string' ? request.name : '';
    if (!name) {
      throw formatError(createError(ErrorCode.UNSAFE_ARGUMENTS, 'A tool name is required.'));
    }
    const args = request?.args && typeof request.args === 'object' ? request.args : {};
    try {
      return await client.callTool(name, args);
    } catch (err) {
      throw formatError(err);
    }
  });
}
