import { beforeEach, describe, expect, it, vi } from 'vitest';

const showMock = vi.fn();
const onMock = vi.fn();
const focusMock = vi.fn();
const showWindowMock = vi.fn();
const restoreMock = vi.fn();
const isMinimizedMock = vi.fn(() => false);
const isFocusedMock = vi.fn(() => false);
const isDestroyedMock = vi.fn(() => false);
const sendMock = vi.fn();
const isSupportedMock = vi.fn(() => true);

vi.mock('electron', () => {
  class Notification {
    static isSupported = isSupportedMock;
    constructor(_opts: any) {}
    on = onMock;
    show = showMock;
  }
  return {
    Notification,
    IPC: {},
  };
});

vi.mock('../../shared/ipc-channels', () => ({ IPC: { NOTIFICATIONS_CLICKED: 'notifications-clicked' } }));

function makeWindow() {
  return {
    isFocused: isFocusedMock,
    isMinimized: isMinimizedMock,
    isDestroyed: isDestroyedMock,
    restore: restoreMock,
    show: showWindowMock,
    focus: focusMock,
    webContents: { send: sendMock },
  } as any;
}

describe('DesktopNotifier', () => {
  beforeEach(() => {
    vi.resetModules();
    showMock.mockClear();
    onMock.mockClear();
    focusMock.mockClear();
    showWindowMock.mockClear();
    restoreMock.mockClear();
    sendMock.mockClear();
    isSupportedMock.mockReturnValue(true);
    isFocusedMock.mockReturnValue(false);
    isMinimizedMock.mockReturnValue(false);
    isDestroyedMock.mockReturnValue(false);
  });

  it('does not notify when disabled', async () => {
    const { initNotifier } = await import('./notifier');
    const n = initNotifier({ getMainWindow: () => makeWindow() });
    n.notify('t', 'b');
    expect(showMock).not.toHaveBeenCalled();
  });

  it('does not notify when unsupported', async () => {
    isSupportedMock.mockReturnValue(false);
    const { initNotifier } = await import('./notifier');
    const n = initNotifier({ getMainWindow: () => makeWindow() });
    n.setEnabled(true);
    n.notify('t', 'b');
    expect(showMock).not.toHaveBeenCalled();
  });

  it('skips when window is focused and not minimized', async () => {
    isFocusedMock.mockReturnValue(true);
    isMinimizedMock.mockReturnValue(false);
    const { initNotifier } = await import('./notifier');
    const n = initNotifier({ getMainWindow: () => makeWindow() });
    n.setEnabled(true);
    n.notify('t', 'b');
    expect(showMock).not.toHaveBeenCalled();
  });

  it('notifies when unfocused and dedupes', async () => {
    const { initNotifier } = await import('./notifier');
    const n = initNotifier({ getMainWindow: () => makeWindow() });
    n.setEnabled(true);
    n.notify('t', 'b', 'k1');
    n.notify('t', 'b', 'k1');
    expect(showMock).toHaveBeenCalledTimes(1);
  });

  it('focuses window and sends click target on click', async () => {
    const { initNotifier } = await import('./notifier');
    const win = makeWindow();
    const n = initNotifier({ getMainWindow: () => win });
    n.setEnabled(true);
    n.notify('t', 'b', 'k2', { target: 'queue' });
    const clickHandler = onMock.mock.calls.find((c) => c[0] === 'click')?.[1];
    expect(clickHandler).toBeTypeOf('function');
    clickHandler();
    expect(showWindowMock).toHaveBeenCalled();
    expect(focusMock).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith('notifications-clicked', { target: 'queue' });
  });
});
