import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  sendSpy,
  createSenderMock,
  registerDialogHandlersMock,
  registerCapabilityHandlersMock,
  registerConversionHandlersMock,
  registerQueueHandlersMock,
  registerMuxQueueHandlersMock,
  registerAutomationHandlersMock,
  registerPlayerHandlersMock,
  registerWindowHandlersMock,
  registerSystemHandlersMock,
  registerImageHandlersMock,
  registerTimelineHandlersMock,
  registerUpdaterHandlersMock,
  registerLogsHandlersMock,
  registerHistoryHandlersMock,
  appGetPathMock,
  historyStoreInstance,
  historyRecorderInstance,
  historyStoreMock,
  historyRecorderMock,
  generateHistoryThumbnailMock,
} = vi.hoisted(() => {
  const historyStoreInstance = { list: vi.fn(), clear: vi.fn(), remove: vi.fn() };
  const historyRecorderInstance = { record: vi.fn() };
  return {
    sendSpy: vi.fn(),
    createSenderMock: vi.fn(),
    appGetPathMock: vi.fn(() => 'C:/temp/encodex-user-data'),
    historyStoreInstance,
    historyRecorderInstance,
    historyStoreMock: vi.fn(function () {
      return historyStoreInstance;
    }),
    historyRecorderMock: vi.fn(function () {
      return historyRecorderInstance;
    }),
    generateHistoryThumbnailMock: vi.fn(),
    registerDialogHandlersMock: vi.fn(),
    registerCapabilityHandlersMock: vi.fn(),
    registerConversionHandlersMock: vi.fn(),
    registerQueueHandlersMock: vi.fn(),
    registerMuxQueueHandlersMock: vi.fn(),
    registerAutomationHandlersMock: vi.fn(),
    registerPlayerHandlersMock: vi.fn(),
    registerWindowHandlersMock: vi.fn(),
    registerSystemHandlersMock: vi.fn(),
    registerImageHandlersMock: vi.fn(),
    registerTimelineHandlersMock: vi.fn(),
    registerUpdaterHandlersMock: vi.fn(),
    registerLogsHandlersMock: vi.fn(),
    registerHistoryHandlersMock: vi.fn(),
  };
});

vi.mock('electron', () => ({
  BrowserWindow: class {},
  ipcMain: { handle: vi.fn() },
  app: { getPath: appGetPathMock },
}));
vi.mock('../send', () => ({ createSender: createSenderMock }));
vi.mock('../dialogs', () => ({ registerDialogHandlers: registerDialogHandlersMock }));
vi.mock('../capabilities', () => ({ registerCapabilityHandlers: registerCapabilityHandlersMock }));
vi.mock('../conversion', () => ({ registerConversionHandlers: registerConversionHandlersMock }));
vi.mock('../queue', () => ({ registerQueueHandlers: registerQueueHandlersMock }));
vi.mock('../mux-queue', () => ({ registerMuxQueueHandlers: registerMuxQueueHandlersMock }));
vi.mock('../automations', () => ({ registerAutomationHandlers: registerAutomationHandlersMock }));
vi.mock('../player', () => ({ registerPlayerHandlers: registerPlayerHandlersMock }));
vi.mock('../window', () => ({ registerWindowHandlers: registerWindowHandlersMock }));
vi.mock('../system', () => ({ registerSystemHandlers: registerSystemHandlersMock }));
vi.mock('../image', () => ({ registerImageHandlers: registerImageHandlersMock }));
vi.mock('../timeline', () => ({ registerTimelineHandlers: registerTimelineHandlersMock }));
vi.mock('../updater', () => ({ registerUpdaterHandlers: registerUpdaterHandlersMock }));
vi.mock('../logs', () => ({ registerLogsHandlers: registerLogsHandlersMock }));
vi.mock('../../history/store', () => ({ HistoryStore: historyStoreMock }));
vi.mock('../../history/recorder', () => ({ HistoryRecorder: historyRecorderMock }));
vi.mock('../../history/thumbnails', () => ({ generateHistoryThumbnail: generateHistoryThumbnailMock }));
vi.mock('../history', () => ({ registerHistoryHandlers: registerHistoryHandlersMock }));

const { registerIpcHandlers } = await import('../handlers');

describe('registerIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSenderMock.mockReturnValue(sendSpy);
    appGetPathMock.mockReturnValue('C:/temp/encodex-user-data');
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
    expect(registerConversionHandlersMock).toHaveBeenCalledWith(win, sendSpy, historyRecorderInstance);
    expect(registerQueueHandlersMock).toHaveBeenCalledWith(win, sendSpy, historyRecorderInstance);
    expect(registerMuxQueueHandlersMock).toHaveBeenCalledWith(win, sendSpy, historyRecorderInstance);
    expect(registerAutomationHandlersMock).toHaveBeenCalledWith(win, sendSpy, historyRecorderInstance);
    expect(registerPlayerHandlersMock).toHaveBeenCalledWith(win, sendSpy);
    expect(registerWindowHandlersMock).toHaveBeenCalledWith(win);
    expect(registerSystemHandlersMock).toHaveBeenCalledWith(win);
    expect(registerImageHandlersMock).toHaveBeenCalledWith();
    expect(registerTimelineHandlersMock).toHaveBeenCalledWith();
    expect(registerUpdaterHandlersMock).toHaveBeenCalledWith(win);
    expect(registerLogsHandlersMock).toHaveBeenCalled();
    expect(appGetPathMock).toHaveBeenCalledWith('userData');
    expect(historyStoreMock).toHaveBeenCalledWith('C:/temp/encodex-user-data');
    expect(historyRecorderMock).toHaveBeenCalledWith({
      store: historyStoreInstance,
      generateThumbnail: generateHistoryThumbnailMock,
      onEntry: expect.any(Function),
    });
    expect(registerHistoryHandlersMock).toHaveBeenCalledWith(historyStoreInstance, expect.any(Function));
  });
});
