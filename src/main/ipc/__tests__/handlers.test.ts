import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  sendSpy,
  createSenderMock,
  registerDialogHandlersMock,
  registerConversionHandlersMock,
  registerQueueHandlersMock,
  registerPlayerHandlersMock,
} = vi.hoisted(() => ({
  sendSpy: vi.fn(),
  createSenderMock: vi.fn(),
  registerDialogHandlersMock: vi.fn(),
  registerConversionHandlersMock: vi.fn(),
  registerQueueHandlersMock: vi.fn(),
  registerPlayerHandlersMock: vi.fn(),
}));

vi.mock('electron', () => ({ BrowserWindow: class {} }));
vi.mock('../send', () => ({ createSender: createSenderMock }));
vi.mock('../dialogs', () => ({ registerDialogHandlers: registerDialogHandlersMock }));
vi.mock('../conversion', () => ({ registerConversionHandlers: registerConversionHandlersMock }));
vi.mock('../queue', () => ({ registerQueueHandlers: registerQueueHandlersMock }));
vi.mock('../player', () => ({ registerPlayerHandlers: registerPlayerHandlersMock }));

const { registerIpcHandlers } = await import('../handlers');

describe('registerIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSenderMock.mockReturnValue(sendSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a sender and wires up every handler group', () => {
    const win = {} as never;
    registerIpcHandlers(win);
    expect(createSenderMock).toHaveBeenCalledWith(win);
    expect(registerDialogHandlersMock).toHaveBeenCalledWith(win);
    expect(registerConversionHandlersMock).toHaveBeenCalledWith(win, sendSpy);
    expect(registerQueueHandlersMock).toHaveBeenCalledWith(win, sendSpy);
    expect(registerPlayerHandlersMock).toHaveBeenCalledWith(win, sendSpy);
  });
});
