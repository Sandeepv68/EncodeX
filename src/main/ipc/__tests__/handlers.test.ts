import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  sendSpy,
  createSenderMock,
  registerDialogHandlersMock,
  registerCapabilityHandlersMock,
  registerConversionHandlersMock,
  registerQueueHandlersMock,
  registerPlayerHandlersMock,
  registerWindowHandlersMock,
} = vi.hoisted(() => ({
  sendSpy: vi.fn(),
  createSenderMock: vi.fn(),
  registerDialogHandlersMock: vi.fn(),
  registerCapabilityHandlersMock: vi.fn(),
  registerConversionHandlersMock: vi.fn(),
  registerQueueHandlersMock: vi.fn(),
  registerPlayerHandlersMock: vi.fn(),
  registerWindowHandlersMock: vi.fn(),
}));

vi.mock('electron', () => ({ BrowserWindow: class {} }));
vi.mock('../send', () => ({ createSender: createSenderMock }));
vi.mock('../dialogs', () => ({ registerDialogHandlers: registerDialogHandlersMock }));
vi.mock('../capabilities', () => ({ registerCapabilityHandlers: registerCapabilityHandlersMock }));
vi.mock('../conversion', () => ({ registerConversionHandlers: registerConversionHandlersMock }));
vi.mock('../queue', () => ({ registerQueueHandlers: registerQueueHandlersMock }));
vi.mock('../player', () => ({ registerPlayerHandlers: registerPlayerHandlersMock }));
vi.mock('../window', () => ({ registerWindowHandlers: registerWindowHandlersMock }));

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
    expect(registerCapabilityHandlersMock).toHaveBeenCalledWith();
    expect(registerConversionHandlersMock).toHaveBeenCalledWith(win, sendSpy);
    expect(registerQueueHandlersMock).toHaveBeenCalledWith(win, sendSpy);
    expect(registerPlayerHandlersMock).toHaveBeenCalledWith(win, sendSpy);
    expect(registerWindowHandlersMock).toHaveBeenCalledWith(win);
  });
});
