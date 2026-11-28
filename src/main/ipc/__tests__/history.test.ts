import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IPC } from '../../../shared/ipc-channels';

const { ipcMainMock, getHandlers, storeMock, notifyMock } = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    ipcMainMock: {
      handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
        handlers[channel] = fn;
      }),
    },
    getHandlers: () => handlers,
    storeMock: {
      list: vi.fn(),
      getThumbnail: vi.fn(),
      clear: vi.fn(),
      remove: vi.fn(),
    },
    notifyMock: vi.fn(),
  };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock }));

const { registerHistoryHandlers } = await import('../history');

describe('registerHistoryHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(getHandlers())) delete getHandlers()[key];
    registerHistoryHandlers(storeMock as never, notifyMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the history list, thumbnail, clear and remove channels', () => {
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.HISTORY_LIST, expect.any(Function));
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.HISTORY_GET_THUMBNAIL, expect.any(Function));
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.HISTORY_CLEAR, expect.any(Function));
    expect(ipcMainMock.handle).toHaveBeenCalledWith(IPC.HISTORY_REMOVE, expect.any(Function));
  });

  it('HISTORY_LIST returns the stored entries', async () => {
    const entries = [{ id: 'entry-1', status: 'succeeded' }];
    storeMock.list.mockReturnValue(entries);
    expect(await getHandlers()[IPC.HISTORY_LIST]({})).toBe(entries);
    expect(storeMock.list).toHaveBeenCalledOnce();
  });

  it('HISTORY_LIST rethrows a formatted store error', async () => {
    storeMock.list.mockImplementationOnce(() => {
      throw new Error('unreadable');
    });
    await expect(getHandlers()[IPC.HISTORY_LIST]({})).rejects.toMatchObject({ code: 'UNKNOWN', detail: 'unreadable' });
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('HISTORY_GET_THUMBNAIL returns the stored thumbnail for a string id', async () => {
    storeMock.getThumbnail.mockReturnValue('data:image/png;base64,AA==');
    expect(await getHandlers()[IPC.HISTORY_GET_THUMBNAIL]({}, 'entry-1')).toBe('data:image/png;base64,AA==');
    expect(storeMock.getThumbnail).toHaveBeenCalledWith('entry-1');
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('HISTORY_GET_THUMBNAIL ignores invalid ids', async () => {
    for (const invalid of [undefined, null, 42, {}, []]) {
      expect(await getHandlers()[IPC.HISTORY_GET_THUMBNAIL]({}, invalid)).toBeNull();
    }
    expect(storeMock.getThumbnail).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('HISTORY_GET_THUMBNAIL rethrows a formatted store error', async () => {
    storeMock.getThumbnail.mockImplementationOnce(() => {
      throw new Error('thumbnail failed');
    });
    await expect(getHandlers()[IPC.HISTORY_GET_THUMBNAIL]({}, 'entry-1')).rejects.toMatchObject({
      code: 'CONVERSION_FAILED',
      detail: 'thumbnail failed',
    });
  });

  it('HISTORY_CLEAR clears the store and notifies exactly once', async () => {
    await expect(getHandlers()[IPC.HISTORY_CLEAR]({})).resolves.toBeUndefined();
    expect(storeMock.clear).toHaveBeenCalledOnce();
    expect(notifyMock).toHaveBeenCalledOnce();
  });

  it('HISTORY_CLEAR does not notify when the store throws', async () => {
    storeMock.clear.mockImplementationOnce(() => {
      throw new Error('clear failed');
    });
    await expect(getHandlers()[IPC.HISTORY_CLEAR]({})).rejects.toMatchObject({ code: 'CONVERSION_FAILED', detail: 'clear failed' });
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('HISTORY_REMOVE notifies exactly once when a valid id is removed', async () => {
    storeMock.remove.mockReturnValue(true);
    expect(await getHandlers()[IPC.HISTORY_REMOVE]({}, 'entry-1')).toBe(true);
    expect(storeMock.remove).toHaveBeenCalledWith('entry-1');
    expect(notifyMock).toHaveBeenCalledOnce();
  });

  it('HISTORY_REMOVE does not notify when nothing was removed', async () => {
    storeMock.remove.mockReturnValue(false);
    expect(await getHandlers()[IPC.HISTORY_REMOVE]({}, 'missing')).toBe(false);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('HISTORY_REMOVE ignores invalid ids', async () => {
    for (const invalid of [undefined, null, 42, {}, []]) {
      expect(await getHandlers()[IPC.HISTORY_REMOVE]({}, invalid)).toBe(false);
    }
    expect(storeMock.remove).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('HISTORY_REMOVE does not notify when the store throws', async () => {
    storeMock.remove.mockImplementationOnce(() => {
      throw new Error('remove failed');
    });
    await expect(getHandlers()[IPC.HISTORY_REMOVE]({}, 'entry-1')).rejects.toMatchObject({
      code: 'CONVERSION_FAILED',
      detail: 'remove failed',
    });
    expect(notifyMock).not.toHaveBeenCalled();
  });
});
