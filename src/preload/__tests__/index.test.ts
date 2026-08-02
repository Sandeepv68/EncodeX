import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IPC } from '../../shared/ipc-channels';

const { contextBridgeMock, ipcRendererMock, webUtilsMock, getExposed } = vi.hoisted(() => {
  const exposed: Record<string, unknown> = {};
  return {
    contextBridgeMock: {
      exposeInMainWorld: vi.fn((key: string, api: unknown) => {
        exposed[key] = api;
      }),
    },
    ipcRendererMock: {
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    webUtilsMock: {
      getPathForFile: vi.fn(),
    },
    getExposed: () => exposed,
  };
});

vi.mock('electron', () => ({
  contextBridge: contextBridgeMock,
  ipcRenderer: ipcRendererMock,
  webUtils: webUtilsMock,
  IpcRendererEvent: class {},
}));

await import('../index');

expect(contextBridgeMock.exposeInMainWorld).toHaveBeenCalledWith('electronAPI', expect.any(Object));

type Api = {
  [K in string]: (...args: never[]) => unknown;
};

describe('preload', () => {
  const api = getExposed().electronAPI as Api;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the electronAPI bridge', () => {
    expect(api).toBeDefined();
    expect(api.convertFile).toBeTypeOf('function');
    expect(api.onLogMessage).toBeTypeOf('function');
  });

  it('getPathForFile resolves a dropped file path via webUtils', () => {
    const file = {} as File;
    webUtilsMock.getPathForFile.mockReturnValue('/dropped/image.png');
    expect((api.getPathForFile as (f: File) => string)(file)).toBe('/dropped/image.png');
    expect(webUtilsMock.getPathForFile).toHaveBeenCalledWith(file);
  });

  it.each([
    ['selectFile', IPC.SELECT_FILE, [undefined]],
    ['selectFiles', IPC.SELECT_FILES, [undefined]],
    ['selectOutput', IPC.SELECT_OUTPUT, []],
    ['getMediaInfo', IPC.GET_MEDIA_INFO, ['in.mp4', 'FFMPEG']],
    ['getImageInfo', IPC.GET_IMAGE_INFO, ['in.jpg']],
    ['getImagePreview', IPC.GET_IMAGE_PREVIEW, ['in.jpg']],
    ['getImageFileInfo', IPC.GET_IMAGE_FILE_INFO, ['in.jpg']],
    ['getVideoPreview', IPC.GET_VIDEO_PREVIEW, ['in.mp4']],
    ['getCapabilities', IPC.GET_CAPABILITIES, []],
    ['convertFile', IPC.CONVERT_FILE, ['in.mp4', 'out.mp4', {}, 'FFMPEG']],
    ['pauseConversion', IPC.PAUSE_CONVERSION, []],
    ['resumeConversion', IPC.RESUME_CONVERSION, []],
    ['cancelConversion', IPC.CANCEL_CONVERSION, []],
    ['queueAdd', IPC.QUEUE_ADD, ['in.mp4', 'out.mp4', {}, 'FFMPEG']],
    ['queueRemove', IPC.QUEUE_REMOVE, ['id-1']],
    ['queueList', IPC.QUEUE_LIST, []],
    ['queueCancelAll', IPC.QUEUE_CANCEL_ALL, []],
    ['playerOpen', IPC.PLAYER_OPEN, ['v.mp4']],
    ['playerSeek', IPC.PLAYER_SEEK, ['00:00:01']],
    ['playerClose', IPC.PLAYER_CLOSE, []],
    ['playerGetFrame', IPC.PLAYER_GET_FRAME, []],
  ])('%s invokes the %s channel', async (method, channel, args) => {
    ipcRendererMock.invoke.mockResolvedValue('ok');
    const result = await (api[method] as (...a: unknown[]) => Promise<string>)(...args);
    expect(ipcRendererMock.invoke).toHaveBeenCalledWith(channel, ...args);
    expect(result).toBe('ok');
  });

  it.each([
    ['onConversionProgress', IPC.CONVERSION_PROGRESS, { input: 'in.mp4', output: 'out.mp4', progress: { percent: 10 } }],
    ['onQueueAdded', IPC.QUEUE_ADDED, { id: 'id-1' }],
    ['onQueueRemoved', IPC.QUEUE_REMOVED, 'id-1'],
    ['onQueueStatusChange', IPC.QUEUE_STATUS_CHANGE, { id: 'id-1', status: 'running' }],
    ['onQueueProgress', IPC.QUEUE_PROGRESS, { job: { id: 'id-1' }, progress: { percent: 20 } }],
    ['onQueueCancelled', IPC.QUEUE_CANCELLED, undefined],
    ['onPlayerFrame', IPC.PLAYER_FRAME, { data: new ArrayBuffer(0), width: 1, height: 1, pts: 0 }],
    ['onPlayerAudio', IPC.PLAYER_AUDIO, { data: new ArrayBuffer(0), sampleRate: 48000, channels: 2 }],
    ['onLogMessage', IPC.LOG_MESSAGE, { timestamp: 't', level: 'INFO', text: 'hello', source: 'main' }],
    ['onWindowMaximizedChange', IPC.WINDOW_MAXIMIZED_CHANGED, true],
  ])('%s subscribes and unsubscribes on the %s channel', (method, channel, payload) => {
    const cb = vi.fn();
    const unsubscribe = (api[method] as (cb: (data: unknown) => void) => () => void)(cb);
    const handler = ipcRendererMock.on.mock.calls.find(([c]) => c === channel)?.[1] as (event: unknown, data: unknown) => void;
    expect(handler).toBeDefined();
    handler({}, payload);
    if (payload === undefined) {
      expect(cb).toHaveBeenCalled();
    } else {
      expect(cb).toHaveBeenCalledWith(payload);
    }
    unsubscribe();
    expect(ipcRendererMock.removeListener).toHaveBeenCalledWith(channel, handler);
  });

  it.each([
    ['windowMinimize', IPC.WINDOW_MINIMIZE],
    ['windowMaximizeToggle', IPC.WINDOW_MAXIMIZE_TOGGLE],
    ['windowClose', IPC.WINDOW_CLOSE],
  ])('%s sends the %s channel', (method, channel) => {
    (api[method] as () => void)();
    expect(ipcRendererMock.send).toHaveBeenCalledWith(channel);
  });
});
