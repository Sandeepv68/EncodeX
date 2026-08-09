import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { ipcMainMock, getOnHandlers } = vi.hoisted(() => {
  const onHandlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    ipcMainMock: {
      on: vi.fn((channel: string, fn: (...args: unknown[]) => void) => {
        onHandlers[channel] = fn;
      }),
    },
    getOnHandlers: () => onHandlers,
  };
});

vi.mock('electron', () => ({ ipcMain: ipcMainMock, BrowserWindow: class {} }));

const { registerWindowHandlers } = await import('../window');
import { IPC } from '../../../shared/ipc-channels';

function createWindowMock() {
  return {
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    isMaximized: vi.fn(() => false),
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    on: vi.fn(),
    webContents: {
      send: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isCrashed: vi.fn(() => false),
    },
  };
}

describe('registerWindowHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers window control handlers and maximize event forwarding', () => {
    const win = createWindowMock();
    registerWindowHandlers(win as never);
    expect(ipcMainMock.on).toHaveBeenCalledWith(IPC.WINDOW_MINIMIZE, expect.any(Function));
    expect(ipcMainMock.on).toHaveBeenCalledWith(IPC.WINDOW_MAXIMIZE_TOGGLE, expect.any(Function));
    expect(ipcMainMock.on).toHaveBeenCalledWith(IPC.WINDOW_CLOSE, expect.any(Function));
    expect(win.on).toHaveBeenCalledWith('maximize', expect.any(Function));
    expect(win.on).toHaveBeenCalledWith('unmaximize', expect.any(Function));
  });

  it('WINDOW_MINIMIZE minimizes the window', () => {
    const win = createWindowMock();
    registerWindowHandlers(win as never);
    getOnHandlers()[IPC.WINDOW_MINIMIZE]();
    expect(win.minimize).toHaveBeenCalled();
  });

  it('WINDOW_MAXIMIZE_TOGGLE maximizes a non-maximized window', () => {
    const win = createWindowMock();
    win.isMaximized.mockReturnValue(false);
    registerWindowHandlers(win as never);
    getOnHandlers()[IPC.WINDOW_MAXIMIZE_TOGGLE]();
    expect(win.maximize).toHaveBeenCalled();
    expect(win.unmaximize).not.toHaveBeenCalled();
  });

  it('WINDOW_MAXIMIZE_TOGGLE unmaximizes a maximized window', () => {
    const win = createWindowMock();
    win.isMaximized.mockReturnValue(true);
    registerWindowHandlers(win as never);
    getOnHandlers()[IPC.WINDOW_MAXIMIZE_TOGGLE]();
    expect(win.unmaximize).toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
  });

  it('WINDOW_CLOSE closes the window', () => {
    const win = createWindowMock();
    registerWindowHandlers(win as never);
    getOnHandlers()[IPC.WINDOW_CLOSE]();
    expect(win.close).toHaveBeenCalled();
  });

  it('intercepts the close event and requests confirmation', () => {
    const win = createWindowMock();
    registerWindowHandlers(win as never);
    const closeHandler = win.on.mock.calls.find(([event]) => event === 'close')?.[1] as (event: { preventDefault: () => void }) => void;
    const event = { preventDefault: vi.fn() };
    closeHandler(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.WINDOW_CLOSE_REQUESTED);
  });

  it('WINDOW_CONFIRM_CLOSE marks the close as confirmed and re-invokes close', () => {
    const win = createWindowMock();
    registerWindowHandlers(win as never);
    getOnHandlers()[IPC.WINDOW_CONFIRM_CLOSE]();
    expect(win.close).toHaveBeenCalled();
    const closeHandler = win.on.mock.calls.find(([event]) => event === 'close')?.[1] as (event: { preventDefault: () => void }) => void;
    const event = { preventDefault: vi.fn() };
    closeHandler(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(win.webContents.send).not.toHaveBeenCalled();
  });

  it('closes directly when the renderer webContents is destroyed', () => {
    const win = createWindowMock();
    win.webContents.isDestroyed.mockReturnValue(true);
    registerWindowHandlers(win as never);
    const closeHandler = win.on.mock.calls.find(([event]) => event === 'close')?.[1] as (event: { preventDefault: () => void }) => void;
    const event = { preventDefault: vi.fn() };
    closeHandler(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(win.close).toHaveBeenCalled();
  });

  it('closes directly when the renderer webContents is crashed', () => {
    const win = createWindowMock();
    win.webContents.isCrashed.mockReturnValue(true);
    registerWindowHandlers(win as never);
    const closeHandler = win.on.mock.calls.find(([event]) => event === 'close')?.[1] as (event: { preventDefault: () => void }) => void;
    const event = { preventDefault: vi.fn() };
    closeHandler(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(win.close).toHaveBeenCalled();
  });

  it('forwards the maximize event to the renderer', () => {
    const win = createWindowMock();
    registerWindowHandlers(win as never);
    const maximizeHandler = win.on.mock.calls.find(([event]) => event === 'maximize')?.[1] as () => void;
    maximizeHandler();
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.WINDOW_MAXIMIZED_CHANGED, true);
  });

  it('forwards the unmaximize event to the renderer', () => {
    const win = createWindowMock();
    registerWindowHandlers(win as never);
    const unmaximizeHandler = win.on.mock.calls.find(([event]) => event === 'unmaximize')?.[1] as () => void;
    unmaximizeHandler();
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.WINDOW_MAXIMIZED_CHANGED, false);
  });

  it('does not forward events when the window is destroyed', () => {
    const win = createWindowMock();
    win.isDestroyed.mockReturnValue(true);
    registerWindowHandlers(win as never);
    const maximizeHandler = win.on.mock.calls.find(([event]) => event === 'maximize')?.[1] as () => void;
    maximizeHandler();
    expect(win.webContents.send).not.toHaveBeenCalled();
  });
});
