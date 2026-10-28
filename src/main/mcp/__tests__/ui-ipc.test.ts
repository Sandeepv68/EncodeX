/**
 * @fileoverview Tests for the MCP App view IPC handlers.
 *
 * The handlers are what an in-app MCP App view calls: it asks for a tool call
 * and for the list of views. The provider is injected, so the tests drive the
 * handlers without a running server.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const handlers = new Map<string, (event: unknown, request: unknown) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, request: unknown) => unknown) => {
      handlers.set(channel, handler);
    },
  },
}));

const { registerMcpUiIpc, setLocalMcpClientProvider } = await import('../ui-ipc');
const { IPC } = await import('../../../shared/ipc-channels');
const { MCP_UI_VIEW_URIS } = await import('../../../shared/mcp-ui');

/**
 * Calls a registered handler.
 * @param {string} channel - The channel to call.
 * @param {unknown} request - The request payload.
 * @returns {Promise<unknown>} The handler's answer.
 */
async function call(channel: string, request?: unknown): Promise<unknown> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler registered for ${channel}`);
  return handler({}, request);
}

describe('MCP App view IPC', () => {
  beforeEach(() => {
    handlers.clear();
    registerMcpUiIpc();
  });

  it('lists the views the in-app host can render', async () => {
    const views = (await call(IPC.MCP_UI_LIST_VIEWS)) as Array<{ viewId: string; uri: string }>;
    expect(views.length).toBeGreaterThan(0);
    expect(views.map((view) => view.uri)).toContain(MCP_UI_VIEW_URIS.queue);
    expect(views.map((view) => view.uri)).toContain(MCP_UI_VIEW_URIS.profiles);
  });

  it('forwards a tool call to the MCP server', async () => {
    const callTool = vi.fn().mockResolvedValue({ content: [], structuredContent: { ok: true } });
    setLocalMcpClientProvider(async () => ({ callTool, listTools: vi.fn(), close: vi.fn() }) as never);
    const result = await call(IPC.MCP_UI_CALL_TOOL, { name: 'list_jobs', args: {} });
    expect(callTool).toHaveBeenCalledWith('list_jobs', {});
    expect(result).toEqual({ content: [], structuredContent: { ok: true } });
  });

  it('defaults the arguments to an empty object', async () => {
    const callTool = vi.fn().mockResolvedValue({});
    setLocalMcpClientProvider(async () => ({ callTool, listTools: vi.fn(), close: vi.fn() }) as never);
    await call(IPC.MCP_UI_CALL_TOOL, { name: 'list_jobs' });
    expect(callTool).toHaveBeenCalledWith('list_jobs', {});
  });

  it('refuses a call without a tool name', async () => {
    const callTool = vi.fn();
    setLocalMcpClientProvider(async () => ({ callTool, listTools: vi.fn(), close: vi.fn() }) as never);
    await expect(call(IPC.MCP_UI_CALL_TOOL, { name: '' })).rejects.toThrow();
    expect(callTool).not.toHaveBeenCalled();
  });

  it('reports that the server is not ready yet', async () => {
    setLocalMcpClientProvider(async () => null);
    await expect(call(IPC.MCP_UI_CALL_TOOL, { name: 'list_jobs' })).rejects.toThrow(/not ready/i);
  });

  it('propagates a failing tool call', async () => {
    const callTool = vi.fn().mockRejectedValue(new Error('boom'));
    setLocalMcpClientProvider(async () => ({ callTool, listTools: vi.fn(), close: vi.fn() }) as never);
    await expect(call(IPC.MCP_UI_CALL_TOOL, { name: 'list_jobs' })).rejects.toThrow();
  });
});
