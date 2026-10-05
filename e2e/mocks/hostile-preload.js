/**
 * @fileoverview Hostile preload for the Phase 3.4 bridge-abuse E2E suite.
 *
 * Loaded by src/main/index.ts instead of the real preload when
 * `ENCODEX_HOSTILE_MODE` is set. It is deliberately *not* a stub: every method
 * forwards to the same real IPC channel the real bridge uses, so the main process
 * is the real one and flipping back to healthy is a genuine round-trip. That is
 * what makes the recovery assertions in `e2e/specs/hostile-bridge.spec.ts`
 * meaningful - a mock that simply answers everything would make recovery
 * untestable.
 *
 * The point is the renderer's half: `window.electronAPI` is a bridge it does not
 * control, and every promise it returns can reject, never settle, or resolve to
 * the wrong shape. A renderer that assumes otherwise produces unhandled
 * exceptions and stuck spinners, which is the class of user report this suite
 * exists to find.
 *
 * The method table below is generated from `src/preload/index.ts` and checked
 * against the real bridge's member set by the suite itself, so drift fails there
 * rather than silently weakening the test.
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { IPC } = require('../../dist/shared/ipc-channels.js');

/** @type {string} The failure mode injected into every method. */
const MODE = process.env.ENCODEX_HOSTILE_MODE || 'healthy';

/** Modes that make a method fail rather than pass through to main. */
const HOSTILE_MODES = ['reject-sync', 'reject-async', 'never', 'wrong-type', 'garbage', 'partial'];

/**
 * method: [channel, forwarded parameter names]
 *
 * `invoke` entries return a promise from main; `send` entries are fire-and-forget
 * and resolve to undefined, matching the real bridge so callers cannot tell the
 * difference apart from the return value alone.
 *
 * @type {Record<string, {kind: 'invoke' | 'send', channel: string, params: string[]}>}
 */
const API_TABLE = {
  selectFile: { kind: 'invoke', channel: IPC.SELECT_FILE, params: ['filters'] },
  selectFiles: { kind: 'invoke', channel: IPC.SELECT_FILES, params: ['filters'] },
  selectFolderFiles: { kind: 'invoke', channel: IPC.SELECT_FOLDER_FILES, params: [] },
  expandPaths: { kind: 'invoke', channel: IPC.EXPAND_PATHS, params: ['paths'] },
  selectOutput: { kind: 'invoke', channel: IPC.SELECT_OUTPUT, params: [] },
  selectDirectory: { kind: 'invoke', channel: IPC.SELECT_DIRECTORY, params: [] },
  getMediaInfo: { kind: 'invoke', channel: IPC.GET_MEDIA_INFO, params: ['filePath', 'transcoderType'] },
  getImageInfo: { kind: 'invoke', channel: IPC.GET_IMAGE_INFO, params: ['filePath'] },
  getImagePreview: { kind: 'invoke', channel: IPC.GET_IMAGE_PREVIEW, params: ['filePath'] },
  getImageFileInfo: { kind: 'invoke', channel: IPC.GET_IMAGE_FILE_INFO, params: ['filePath'] },
  getVideoPreview: { kind: 'invoke', channel: IPC.GET_VIDEO_PREVIEW, params: ['filePath'] },
  getCapabilities: { kind: 'invoke', channel: IPC.GET_CAPABILITIES, params: [] },
  convertFile: { kind: 'invoke', channel: IPC.CONVERT_FILE, params: ['input', 'output', 'options', 'transcoderType'] },
  pauseConversion: { kind: 'invoke', channel: IPC.PAUSE_CONVERSION, params: [] },
  resumeConversion: { kind: 'invoke', channel: IPC.RESUME_CONVERSION, params: [] },
  cancelConversion: { kind: 'invoke', channel: IPC.CANCEL_CONVERSION, params: [] },
  queueAdd: { kind: 'invoke', channel: IPC.QUEUE_ADD, params: ['input', 'output', 'options', 'transcoder', 'overwrite'] },
  queueRemove: { kind: 'invoke', channel: IPC.QUEUE_REMOVE, params: ['id'] },
  queueList: { kind: 'invoke', channel: IPC.QUEUE_LIST, params: [] },
  queueGetState: { kind: 'invoke', channel: IPC.QUEUE_GET_STATE, params: [] },
  queueCancelAll: { kind: 'invoke', channel: IPC.QUEUE_CANCEL_ALL, params: [] },
  queueClearCompleted: { kind: 'invoke', channel: IPC.QUEUE_CLEAR_COMPLETED, params: [] },
  queueSetConcurrency: { kind: 'invoke', channel: IPC.QUEUE_SET_CONCURRENCY, params: ['concurrency'] },
  queueSetWhenDone: { kind: 'invoke', channel: IPC.QUEUE_SET_WHEN_DONE, params: ['config'] },
  queueMoveTo: { kind: 'invoke', channel: IPC.QUEUE_MOVE_TO, params: ['id', 'toPosition'] },
  queueUpdateOptions: { kind: 'invoke', channel: IPC.QUEUE_UPDATE_OPTIONS, params: ['id', 'options', 'output'] },
  queuePause: { kind: 'invoke', channel: IPC.QUEUE_PAUSE, params: [] },
  queueResume: { kind: 'invoke', channel: IPC.QUEUE_RESUME, params: [] },
  queueStart: { kind: 'invoke', channel: IPC.QUEUE_START, params: [] },
  queueExport: { kind: 'invoke', channel: IPC.QUEUE_EXPORT, params: [] },
  queueImport: { kind: 'invoke', channel: IPC.QUEUE_IMPORT, params: [] },
  revealFile: { kind: 'invoke', channel: IPC.REVEAL_FILE, params: ['filePath'] },
  playerOpen: { kind: 'invoke', channel: IPC.PLAYER_OPEN, params: ['filePath'] },
  playerSeek: { kind: 'invoke', channel: IPC.PLAYER_SEEK, params: ['time'] },
  playerClose: { kind: 'invoke', channel: IPC.PLAYER_CLOSE, params: [] },
  playerGetFrame: { kind: 'invoke', channel: IPC.PLAYER_GET_FRAME, params: [] },
  extractWaveform: { kind: 'invoke', channel: IPC.EXTRACT_WAVEFORM, params: ['filePath', 'duration'] },
  extractThumbnails: { kind: 'invoke', channel: IPC.EXTRACT_THUMBNAILS, params: ['filePath', 'duration'] },
  windowMinimize: { kind: 'send', channel: IPC.WINDOW_MINIMIZE, params: [] },
  windowMaximizeToggle: { kind: 'send', channel: IPC.WINDOW_MAXIMIZE_TOGGLE, params: [] },
  windowClose: { kind: 'send', channel: IPC.WINDOW_CLOSE, params: [] },
  windowCloseConfirmed: { kind: 'send', channel: IPC.WINDOW_CONFIRM_CLOSE, params: [] },
  rejectTerms: { kind: 'send', channel: IPC.TERMS_REJECT, params: [] },
  windowSetAlwaysOnTop: { kind: 'send', channel: IPC.WINDOW_SET_ALWAYS_ON_TOP, params: ['flag'] },
  setLaunchAtLogin: { kind: 'send', channel: IPC.SET_LAUNCH_AT_LOGIN, params: ['enabled'] },
  monitoringGetState: { kind: 'invoke', channel: IPC.MONITORING_GET_STATE, params: [] },
  monitoringSetEnabled: { kind: 'invoke', channel: IPC.MONITORING_SET_ENABLED, params: ['enabled'] },
  analyticsGetState: { kind: 'invoke', channel: IPC.ANALYTICS_GET_STATE, params: [] },
  analyticsSetEnabled: { kind: 'invoke', channel: IPC.ANALYTICS_SET_ENABLED, params: ['enabled'] },
  mcpGetSettings: { kind: 'invoke', channel: IPC.MCP_SETTINGS_GET, params: [] },
  mcpSetSettings: { kind: 'invoke', channel: IPC.MCP_SETTINGS_SET, params: ['settings'] },
  captureDevScreenshot: { kind: 'invoke', channel: IPC.DEV_CAPTURE_SCREENSHOT, params: [] },
  checkForUpdates: { kind: 'invoke', channel: IPC.CHECK_FOR_UPDATES, params: [] },
  downloadUpdate: { kind: 'invoke', channel: IPC.DOWNLOAD_UPDATE, params: [] },
  installUpdate: { kind: 'invoke', channel: IPC.INSTALL_UPDATE, params: ['installerPath'] },
  cancelDownload: { kind: 'invoke', channel: IPC.CANCEL_DOWNLOAD, params: [] },
  openReleaseNotes: { kind: 'invoke', channel: IPC.OPEN_RELEASE_NOTES, params: ['url'] },
  scheduleInstallOnRestart: { kind: 'invoke', channel: IPC.SCHEDULE_RESTART_INSTALL, params: ['installerPath', 'version'] },
  cancelRestartInstall: { kind: 'invoke', channel: IPC.CANCEL_RESTART_INSTALL, params: [] },
  getPendingInstall: { kind: 'invoke', channel: IPC.GET_PENDING_INSTALL, params: [] },
};

/**
 * Event subscriptions, kept present but silent.
 *
 * Omitting them would break component mount and produce a *different* class of
 * failure, hiding the one under test. A silent subscription is what a bridge with
 * no events looks like, which is a case the renderer must also survive.
 *
 * @type {string[]}
 */
const SUBSCRIBERS = [
  'onWindowCloseRequested',
  'onWindowMaximizedChange',
  'onConversionProgress',
  'onQueueAdded',
  'onQueueRemoved',
  'onQueueStatusChange',
  'onQueueProgress',
  'onQueueCancelled',
  'onQueueMoved',
  'onPlayerFrame',
  'onPlayerAudio',
  'onPlayerError',
  'onLogMessage',
  'onUpdateAvailable',
  'onUpdateNotAvailable',
  'onUpdateProgress',
  'onUpdateDownloaded',
  'onUpdateError',
];

/** @type {string[]} Method names that reached the bridge, in order. */
const calls = [];

/** @type {string} The mode currently being injected. */
let mode = MODE;

/**
 * Methods to fail, or `null` for all of them.
 *
 * "Every method fails" cannot be attributed: when the app comes up blank there is no way to tell which
 * of eighteen calls did it. Narrowing the set through {@link __hostile.setFailures} turns that into a
 * single-variable experiment, which is the same attribution discipline the crash tripwire uses and the
 * reason a finding like this is a diagnosis rather than a shrug.
 *
 * `ENCODEX_HOSTILE_FAILURES` exists because a page reload **re-runs this preload**, which discards any
 * state set from the test side. A bisection that injects through {@link __hostile.setFailures} and then
 * reloads therefore measures the launch mode again and silently proves nothing; seeding the set from
 * the environment at load time is what makes one-failure-per-launch attribution possible.
 *
 * @type {Set<string> | null}
 */
let failures = process.env.ENCODEX_HOSTILE_FAILURES
  ? new Set(
      process.env.ENCODEX_HOSTILE_FAILURES.split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    )
  : null;

/**
 * A stable pseudo-random bucket for a name, so `partial` fails the *same* methods
 * on every run. Real partial-failure bugs are order-dependent, and a mode that
 * reshuffles every run turns the suite into a flake detector.
 *
 * @param {string} name - Method name.
 * @returns {number} Bucket in [0, 100).
 */
function bucketOf(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 100;
}

/**
 * The rejection value, in one of several deliberately awkward shapes.
 *
 * `Error` is only one of them. Real rejections cross a context bridge and come out
 * as plain objects, so a renderer that reads `err.message` on a `null` rejection is
 * exactly the bug this suite should catch.
 *
 * Only ever used for **asynchronous** rejections. A synchronous throw cannot use these
 * shapes: `contextBridge` requires a valid exception and substitutes a generic "An unknown
 * exception occurred in the isolated context" error for anything else, which would test Electron
 * rather than the app. See {@link syncFailureFor}.
 *
 * @param {string} name - Method name, used to pick a stable shape.
 * @returns {unknown} The rejection value.
 */
function rejectionFor(name) {
  switch (bucketOf(name) % 4) {
    case 0:
      return new Error(`hostile ${mode} failure from ${name}`);
    case 1:
      return { code: 'EHOSTILE', method: name, message: `hostile ${mode} failure from ${name}` };
    case 2:
      return `hostile ${mode} failure from ${name}`;
    default:
      return null;
  }
}

/**
 * The value thrown by a synchronous failure.
 *
 * Always a real `Error`, because `contextBridge` cannot faithfully carry any other value out of the
 * isolated world.
 *
 * @param {string} name - Method name.
 * @returns {Error} The exception to throw.
 */
function syncFailureFor(name) {
  return new Error(`hostile ${mode} failure from ${name}`);
}

/**
 * A value of a plausible but wrong shape for the method.
 *
 * Aiming at the *renderer's* assumptions rather than at randomness: `.map` on a
 * non-array, `.toFixed` on a string, and truthiness checks on an object all produce
 * distinct unhandled exceptions, and the point is to reach all of them.
 *
 * @param {string} name - Method name.
 * @returns {unknown} A wrong-shaped resolution value.
 */
function wrongTypeFor(name) {
  if (/List$/.test(name)) return { notAnArray: true };
  if (/Count$/.test(name)) return '12';
  if (/State$|Enabled$/.test(name)) return 'enabled';
  if (/^set|Add$|Remove$|Move|Update|Export|Import|Clear|Cancel|Pause|Resume|Start|Open|Reveal|Install|Download/.test(name)) return 42;
  return null;
}

/**
 * A large, hostile payload: 1 MB of random bytes, or a self-referential object.
 *
 * The cyclic variant is included because structured clone preserves cycles, so a
 * renderer that JSON-stringifies a bridge result - which several stores do when
 * persisting - throws where a shallow copy would not.
 *
 * @param {string} name - Method name.
 * @returns {unknown} A hostile resolution value.
 */
function garbageFor(name) {
  if (bucketOf(name) % 2 === 0) {
    const bytes = new Uint8Array(1024 * 1024);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 31 + bucketOf(name)) & 0xff;
    return bytes.buffer;
  }
  const cyclic = { kind: 'garbage', depth: 0 };
  cyclic.self = cyclic;
  return cyclic;
}

/**
 * Whether the current mode should interfere with this method.
 *
 * @param {string} name - Method name.
 * @returns {boolean} True when the mode applies to this method.
 */
function interferes(name) {
  return failures === null || failures.has(name);
}

/**
 * Invokes the real channel unless the current mode interferes.
 *
 * @param {string} name - Method name, for reporting and shape selection.
 * @param {string} channel - IPC channel string.
 * @param {unknown[]} args - Forwarded arguments.
 * @returns {unknown} Whatever the mode dictates.
 */
function respond(name, channel, args) {
  if (!interferes(name)) return ipcRenderer.invoke(channel, ...args);
  if (mode === 'reject-sync') throw syncFailureFor(name);
  if (mode === 'reject-async') return Promise.reject(rejectionFor(name));
  if (mode === 'never') return new Promise(() => {});
  if (mode === 'wrong-type') return Promise.resolve(wrongTypeFor(name));
  if (mode === 'garbage') return Promise.resolve(garbageFor(name));
  if (mode === 'partial' && bucketOf(name) < 70) return Promise.reject(rejectionFor(name));
  return ipcRenderer.invoke(channel, ...args);
}

const api = {};

/** @type {Record<string, Function>} */
for (const [name, entry] of Object.entries(API_TABLE)) {
  api[name] = (...args) => {
    calls.push(name);
    if (entry.kind === 'send') {
      // These bridge methods return `void` in the real bridge: `ipcRenderer.send` has no reply, so
      // there is no promise to reject. That makes the *entire* space of real failures a synchronous
      // throw or silence - a `send` cannot hang and cannot come back wrong.
      //
      // Returning a rejected promise here (as an earlier version did for `reject-async`) would change
      // the shape of the API and manufacture a finding the shipped app cannot have: the renderer would
      // "fail" for handling a promise the real preload never produces. So `never`, `garbage` and
      // `wrong-type` resolve to silence for these methods, which is both faithful and still hostile -
      // main simply never acts on the send.
      if (interferes(name)) {
        if (mode === 'never' || mode === 'garbage' || mode === 'wrong-type') return undefined;
        if (mode === 'reject-async' || mode === 'reject-sync' || (mode === 'partial' && bucketOf(name) < 70)) {
          throw syncFailureFor(name);
        }
      }
      ipcRenderer.send(entry.channel, ...entry.params.map((param) => args[0]));
      return undefined;
    }
    return respond(
      name,
      entry.channel,
      entry.params.map((param, index) => args[index]),
    );
  };
}

/** `webUtils.getPathForFile` is synchronous in the real bridge, so its failure mode must be too. */
api.getPathForFile = (file) => {
  calls.push('getPathForFile');
  if (
    interferes('getPathForFile') &&
    (mode === 'reject-sync' || mode === 'reject-async' || (mode === 'partial' && bucketOf('getPathForFile') < 70))
  ) {
    throw syncFailureFor('getPathForFile');
  }
  if (!interferes('getPathForFile')) return webUtils.getPathForFile(file);
  if (mode === 'wrong-type') return 12345;
  if (mode === 'never' || mode === 'garbage') return '/hostile/no-such-path';
  return webUtils.getPathForFile(file);
};

for (const name of SUBSCRIBERS) {
  api[name] = () => {
    calls.push(name);
    return () => {};
  };
}

/**
 * Control surface for the specs: flip modes mid-run and read what was called.
 *
 * Exposed as its own global rather than hung off `electronAPI`, so it cannot be
 * mistaken for part of the contract the renderer is supposed to depend on.
 */
contextBridge.exposeInMainWorld('__hostile', {
  /** @returns {string} The mode currently injected. */
  getMode: () => mode,
  /**
   * @param {string} next - Mode to inject from now on.
   * @returns {string} The mode now in effect.
   */
  setMode: (next) => {
    mode = next;
    return mode;
  },
  /**
   * Restricts failure to the named methods.
   *
   * @param {string[] | null} list - Methods to fail, or `null` to fail everything.
   * @returns {string[]} The methods now being failed.
   */
  setFailures: (list) => {
    failures = list === null || list === undefined ? null : new Set(list);
    return failures === null ? [] : [...failures];
  },
  /** @returns {string[] | null} The restricted failure set, or null when everything fails. */
  getFailures: () => (failures === null ? null : [...failures]),
  /** @returns {string[]} Method names that reached the bridge. */
  getCalls: () => calls.slice(),
  /** @returns {string[]} The member names this preload exposes. */
  getMembers: () => Object.keys(api).sort(),
  /** @returns {string[]} The modes this preload understands. */
  getModes: () => ['healthy', ...HOSTILE_MODES],
});

contextBridge.exposeInMainWorld('electronAPI', api);
