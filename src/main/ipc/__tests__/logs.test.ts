import { describe, it, expect, vi, beforeEach } from 'vitest';

const { ipcMainMock, openLogsWindowMock, hubPublishMock, hubSnapshotMock, getOnHandlers, getHandleHandlers } = vi.hoisted(() => {
  const onHandlers: Record<string, (...args: unknown[]) => void> = {};
  const handleHandlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    ipcMainMock: {
      on: vi.fn((channel: string, fn: (...args: unknown[]) => void) => {
        onHandlers[channel] = fn;
      }),
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handleHandlers[channel] = fn;
      }),
    },
    openLogsWindowMock: vi.fn(),
    hubPublishMock: vi.fn(),
    hubSnapshotMock: vi.fn(() => []),
    getOnHandlers: () => onHandlers,
    getHandleHandlers: () => handleHandlers,
  };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock }));
vi.mock('../../logs/logs-window', () => ({ openLogsWindow: openLogsWindowMock }));
vi.mock('../../logs/log-hub', () => ({ logHub: { publish: hubPublishMock, snapshot: hubSnapshotMock } }));

import { IPC } from '../../../shared/ipc-channels';

/**
 * Imports a fresh copy of the registrar.
 *
 * The module keeps a "already registered" guard, so each test needs its own
 * module instance for the handlers to be installed again.
 * @returns {Promise<{registerLogsHandlers: () => void}>} The registrar.
 */
async function importRegistrar(): Promise<{ registerLogsHandlers: () => void }> {
  vi.resetModules();
  const mod = await import('../logs');
  return mod;
}

describe('registerLogsHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers the logs-window channels', async () => {
    const { registerLogsHandlers } = await importRegistrar();
    registerLogsHandlers();
    expect(ipcMainMock.on).toHaveBeenCalledWith(IPC.LOGS_WINDOW_OPEN, expect.any(Function));
    expect(ipcMainMock.on).toHaveBeenCalledWith(IPC.LOGS_PUBLISH, expect.any(Function));
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.LOGS_HISTORY, expect.any(Function));
  });

  it('opens the detached window when the renderer asks for it', async () => {
    const { registerLogsHandlers } = await importRegistrar();
    registerLogsHandlers();
    getOnHandlers()[IPC.LOGS_WINDOW_OPEN]();
    expect(openLogsWindowMock).toHaveBeenCalled();
  });

  it('publishes a batch of renderer entries into the hub, excluding the sender', async () => {
    const { registerLogsHandlers } = await importRegistrar();
    registerLogsHandlers();
    const entry = { timestamp: '2026-01-01T00:00:00.000Z', level: 'INFO', text: 'hi', source: 'renderer' as const };
    getOnHandlers()[IPC.LOGS_PUBLISH]({ sender: { id: 7 } }, [entry]);
    expect(hubPublishMock).toHaveBeenCalledWith(expect.objectContaining({ text: 'hi' }), 7);
  });

  it('drops entries that do not match the log-entry shape', async () => {
    const { registerLogsHandlers } = await importRegistrar();
    registerLogsHandlers();
    getOnHandlers()[IPC.LOGS_PUBLISH]({ sender: { id: 7 } }, [{ text: 'no shape' }, 'not an object']);
    expect(hubPublishMock).not.toHaveBeenCalled();
  });

  it('ignores a publish payload that is not an array', async () => {
    const { registerLogsHandlers } = await importRegistrar();
    registerLogsHandlers();
    getOnHandlers()[IPC.LOGS_PUBLISH]({ sender: { id: 7 } }, { text: 'not an array' });
    expect(hubPublishMock).not.toHaveBeenCalled();
  });

  it('answers a history request with the hub snapshot', async () => {
    const { registerLogsHandlers } = await importRegistrar();
    registerLogsHandlers();
    expect(getHandleHandlers()[IPC.LOGS_HISTORY]()).toEqual([]);
    expect(hubSnapshotMock).toHaveBeenCalled();
  });
});
