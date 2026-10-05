import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IPC } from '../../shared/ipc-channels';
import { expectAppLog } from '../../test-utils/crash-tripwire';
import { resetDropLogThrottle } from '../event-drop-log';

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

  /**
   * A complete `ConversionProgress`, as `main` actually sends it.
   *
   * The event channels are guarded (see `src/shared/ipc-guards.ts`), so a fixture that omits a field
   * is no longer a harmless shorthand - it is a payload `main` could never send, and asserting that
   * it is forwarded would assert the opposite of the contract.
   */
  const CONVERSION_PROGRESS_FIXTURE = {
    percent: 10,
    time: '00:00:01',
    fps: 30,
    speed: '1.0x',
    eta: '00:00:09',
    bitrate: '2000k',
  } as const;

  /** A complete `QueueJob`, as `main` actually sends it. */
  const QUEUE_JOB_FIXTURE = {
    id: 'id-1',
    input: 'in.mp4',
    output: 'out.mp4',
    options: {},
    transcoder: 'ffmpeg',
    status: 'queued',
    progress: 0,
    createdAt: 0,
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    // The drop-logging throttle is module-global by design - it has to outlive a single handler to
    // survive a flood - so it leaks across tests unless reset. Without this, a malformed-payload test
    // that runs after enough other drops to exhaust the per-channel detail allowance would see no
    // warning at all, and would pass or fail depending on the order the file happened to run in.
    resetDropLogThrottle();
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
    ['selectDirectory', IPC.SELECT_DIRECTORY, []],
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
    ['queueAdd', IPC.QUEUE_ADD, ['in.mp4', 'out.mp4', {}, 'FFMPEG', undefined]],
    ['queueRemove', IPC.QUEUE_REMOVE, ['id-1']],
    ['queueList', IPC.QUEUE_LIST, []],
    ['queueCancelAll', IPC.QUEUE_CANCEL_ALL, []],
    ['queueClearCompleted', IPC.QUEUE_CLEAR_COMPLETED, []],
    ['queueSetConcurrency', IPC.QUEUE_SET_CONCURRENCY, [3]],
    ['queueSetWhenDone', IPC.QUEUE_SET_WHEN_DONE, [{ enabled: true, action: 'shutdown', force: false }]],
    ['queueMoveTo', IPC.QUEUE_MOVE_TO, ['id-1', 2]],
    ['queueUpdateOptions', IPC.QUEUE_UPDATE_OPTIONS, ['id-1', { videoCodec: 'libx265' }, '/tmp/new.mp4']],
    ['queueUpdateOptions', IPC.QUEUE_UPDATE_OPTIONS, ['id-1', { videoCodec: 'libx265' }, undefined]],
    ['queuePause', IPC.QUEUE_PAUSE, []],
    ['queueResume', IPC.QUEUE_RESUME, []],
    ['queueStart', IPC.QUEUE_START, []],
    ['queueExport', IPC.QUEUE_EXPORT, []],
    ['queueImport', IPC.QUEUE_IMPORT, []],
    ['revealFile', IPC.REVEAL_FILE, ['/out/clip.mp4']],
    ['playerOpen', IPC.PLAYER_OPEN, ['v.mp4']],
    ['playerSeek', IPC.PLAYER_SEEK, ['00:00:01']],
    ['playerClose', IPC.PLAYER_CLOSE, []],
    ['playerGetFrame', IPC.PLAYER_GET_FRAME, []],
    ['extractWaveform', IPC.EXTRACT_WAVEFORM, ['v.mp4', 60]],
    ['extractThumbnails', IPC.EXTRACT_THUMBNAILS, ['v.mp4', 60]],
    ['mcpGetSettings', IPC.MCP_SETTINGS_GET, []],
    ['mcpSetSettings', IPC.MCP_SETTINGS_SET, [{ enabled: true, port: 8765, token: 'abc' }]],
  ])('%s invokes the %s channel', async (method, channel, args) => {
    ipcRendererMock.invoke.mockResolvedValue('ok');
    const result = await (api[method] as (...a: unknown[]) => Promise<string>)(...args);
    expect(ipcRendererMock.invoke).toHaveBeenCalledWith(channel, ...args);
    expect(result).toBe('ok');
  });

  it.each([
    [
      'onConversionProgress',
      IPC.CONVERSION_PROGRESS,
      {
        input: 'in.mp4',
        output: 'out.mp4',
        progress: { percent: 10, time: '00:00:01', fps: 30, speed: '1.0x', eta: '00:00:09', bitrate: '2000k' },
      },
    ],
    ['onQueueAdded', IPC.QUEUE_ADDED, { ...QUEUE_JOB_FIXTURE }],
    ['onQueueRemoved', IPC.QUEUE_REMOVED, 'id-1'],
    ['onQueueStatusChange', IPC.QUEUE_STATUS_CHANGE, { ...QUEUE_JOB_FIXTURE, status: 'running' }],
    ['onQueueProgress', IPC.QUEUE_PROGRESS, { job: { ...QUEUE_JOB_FIXTURE }, progress: { ...CONVERSION_PROGRESS_FIXTURE, percent: 20 } }],
    ['onQueueCancelled', IPC.QUEUE_CANCELLED, undefined],
    ['onQueueMoved', IPC.QUEUE_MOVED, { id: 'id-1', toPosition: 2 }],
    ['onPlayerFrame', IPC.PLAYER_FRAME, { data: new ArrayBuffer(0), width: 1, height: 1, pts: 0, generation: 0 }],
    ['onPlayerAudio', IPC.PLAYER_AUDIO, { data: new ArrayBuffer(0), sampleRate: 48000, channels: 2, generation: 0 }],
    ['onPlayerError', IPC.PLAYER_ERROR, 'decoder crashed'],
    ['onLogMessage', IPC.LOG_MESSAGE, { timestamp: 't', level: 'INFO', text: 'hello', source: 'main' }],
    ['onWindowMaximizedChange', IPC.WINDOW_MAXIMIZED_CHANGED, true],
    ['onWindowCloseRequested', IPC.WINDOW_CLOSE_REQUESTED, undefined],
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
    // Every one of these is a payload `main` cannot actually send. They used to be forwarded
    // verbatim, which meant the *consumer* dereferenced them - and an `on*` channel has no rejection
    // path, so a bad payload ended the renderer rather than failing one call. The Phase 3.3 harness
    // (`e2e/specs/ipc-events.spec.ts`) found this by pushing `null` down `conversion-progress`.
    ['onConversionProgress', IPC.CONVERSION_PROGRESS, null],
    ['onConversionProgress', IPC.CONVERSION_PROGRESS, { input: 'in.mp4', output: 'out.mp4' }],
    // `percent` is the field the preload's own log line calls `.toFixed(1)` on.
    [
      'onConversionProgress',
      IPC.CONVERSION_PROGRESS,
      { input: 'in.mp4', output: 'out.mp4', progress: { ...CONVERSION_PROGRESS_FIXTURE, percent: '10' } },
    ],
    ['onQueueAdded', IPC.QUEUE_ADDED, null],
    ['onQueueAdded', IPC.QUEUE_ADDED, { id: 'id-1' }],
    ['onQueueStatusChange', IPC.QUEUE_STATUS_CHANGE, undefined],
    ['onQueueProgress', IPC.QUEUE_PROGRESS, { job: null, progress: { ...CONVERSION_PROGRESS_FIXTURE } }],
    ['onQueueProgress', IPC.QUEUE_PROGRESS, null],
    ['onQueueMoved', IPC.QUEUE_MOVED, { id: 'id-1', toPosition: '2' }],
    ['onQueueRemoved', IPC.QUEUE_REMOVED, { id: 'id-1' }],
    // A payload array is an object, so an `isRecord`-style check that forgets the array case would
    // let `[...]` through and fail later on a `.id` read.
    ['onLogMessage', IPC.LOG_MESSAGE, [{ timestamp: 't', level: 'INFO', text: 'x', source: 'main' }]],
    ['onPlayerFrame', IPC.PLAYER_FRAME, { data: new ArrayBuffer(0), width: 1, height: 1, pts: 0 }],
    ['onPlayerAudio', IPC.PLAYER_AUDIO, { data: 'not-an-ArrayBuffer', sampleRate: 48000, channels: 2, generation: 0 }],
    ['onPlayerError', IPC.PLAYER_ERROR, { message: 'decoder crashed' }],
    ['onWindowMaximizedChange', IPC.WINDOW_MAXIMIZED_CHANGED, 'true'],
  ])('%s drops a malformed payload on the %s channel instead of forwarding it', (method, channel, payload) => {
    // Dropping is logged at warn level, which the tripwire records - so a test that provokes a drop
    // has to declare it. Declared per test rather than per table row because the warning's context
    // is the preload, identical for every channel; `expectAppLog` matches on level plus context.
    expectAppLog('warn', 'preload');
    const cb = vi.fn();
    (api[method] as (cb: (data: unknown) => void) => () => void)(cb);
    const handler = ipcRendererMock.on.mock.calls.find(([c]) => c === channel)?.[1] as (event: unknown, data: unknown) => void;
    expect(handler).toBeDefined();

    expect(() => handler({}, payload), `the listener must not throw on ${JSON.stringify(payload) ?? String(payload)}`).not.toThrow();
    expect(cb, 'a malformed payload must not reach the consumer').not.toHaveBeenCalled();
  });

  it.each([
    ['windowMinimize', IPC.WINDOW_MINIMIZE],
    ['windowMaximizeToggle', IPC.WINDOW_MAXIMIZE_TOGGLE],
    ['windowClose', IPC.WINDOW_CLOSE],
    ['windowCloseConfirmed', IPC.WINDOW_CONFIRM_CLOSE],
    ['rejectTerms', IPC.TERMS_REJECT],
  ])('%s sends the %s channel', (method, channel) => {
    (api[method] as () => void)();
    expect(ipcRendererMock.send).toHaveBeenCalledWith(channel);
  });

  it.each([
    ['windowSetAlwaysOnTop', IPC.WINDOW_SET_ALWAYS_ON_TOP, true],
    ['setLaunchAtLogin', IPC.SET_LAUNCH_AT_LOGIN, true],
  ])('%s sends the %s channel with the flag', (method, channel, flag) => {
    (api[method] as (flag: boolean) => void)(flag);
    expect(ipcRendererMock.send).toHaveBeenCalledWith(channel, flag);
  });

  it('queueSetWhenDone returns a promise for a cyclic config instead of throwing synchronously', async () => {
    // Found by `e2e/specs/ipc-abuse.spec.ts`. The log line used `JSON.stringify(config)`, and
    // structured clone *preserves* cycles, so a cyclic object genuinely reaches the preload and
    // made this Promise-returning method throw before `invoke` was ever called. A renderer's
    // `.catch()` cannot see a synchronous throw, so the error escaped as an unhandled renderer
    // exception with the main process never involved.
    const cyclic: Record<string, unknown> = { enabled: true, action: 'shutdown', force: false };
    cyclic.self = cyclic;
    ipcRendererMock.invoke.mockResolvedValue(undefined);

    const returned = (api.queueSetWhenDone as (config: unknown) => Promise<void>)(cyclic);

    expect(returned, 'must hand back a promise, not throw').toBeInstanceOf(Promise);
    await expect(returned).resolves.toBeUndefined();
    expect(ipcRendererMock.invoke).toHaveBeenCalledWith(IPC.QUEUE_SET_WHEN_DONE, cyclic);
  });

  it('queueSetWhenDone survives a config that JSON.stringify cannot serialise', async () => {
    ipcRendererMock.invoke.mockResolvedValue(undefined);
    const withBigInt = { enabled: true, action: 'shutdown', force: false, extra: 10n ** 30n } as unknown;

    await expect((api.queueSetWhenDone as (config: unknown) => Promise<void>)(withBigInt)).resolves.toBeUndefined();
  });
});
