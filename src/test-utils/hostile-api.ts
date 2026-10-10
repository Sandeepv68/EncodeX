/**
 * @fileoverview Unit-tier hostile `window.electronAPI` factory (Phase 3.4 mirror).
 *
 * The E2E suite `e2e/specs/hostile-bridge.spec.ts` launches the app with the
 * hostile preload `e2e/mocks/hostile-preload.js` swapped in per mode and asserts
 * the renderer survives. That matrix only runs in the one E2E session, so the
 * plan's Known follow-up 7 asked for a cheaper equivalent that the shared unit
 * tier runs on every CI pass.
 *
 * This factory reproduces the hostile preload's *behaviour* as a plain object
 * that can be installed over the test-setup stub:
 *
 *  - the same mode set (`healthy` + `HOSTILE_MODES`) and the same failure
 *    semantics per mode (sync throw, async rejection, never settles, wrong
 *    shape, garbage payload, deterministic ~70% partial failure);
 *  - the same method table and subscriber list, kept in lockstep with the E2E
 *    mock and checked by the drift guard in the consumer suite;
 *  - the same stable `bucketOf` hash for `partial`, so both tiers fail the
 *    *same* methods on every run.
 *
 * The one deliberate divergence is the pass-through branch. The E2E mock
 * forwards to a real IPC channel so main is real; jsdom has no IPC, so a
 * healthy pass-through resolves a benign default per method (the same defaults
 * the test-setup stub returns), which is the unit tier's stand-in for "main
 * answered". Everything about the *hostile* half is identical, which is the
 * half under test.
 *
 * @see e2e/mocks/hostile-preload.js, e2e/specs/hostile-bridge.spec.ts,
 *   src/renderer/__tests__/hostile-bridge-matrix.test.tsx
 */

/** The failure modes a hostile method can be subjected to. */
export const HOSTILE_MODES = ['reject-sync', 'reject-async', 'never', 'wrong-type', 'garbage', 'partial'] as const;

/** Every mode the bridge understands, in the same order the E2E mock reports. */
export const MODE_LIST: readonly string[] = ['healthy', ...HOSTILE_MODES];

/** The human language of the default `Error` messages. */
const MODE_NAME = 'hostile';

/**
 * Method instruction table, mirroring the E2E mock's `API_TABLE` member for
 * member. `send` entries are fire-and-forget (the real bridge resolves them to
 * `undefined`); `invoke` entries return a promise. The drift guard in
 * `hostile-bridge-matrix.test.tsx` compares the produced member set to the
 * renderer-contract stub, so a method added to the bridge must be added here.
 */
interface MethodEntry {
  kind: 'invoke' | 'send';
  params: string[];
}

const API_TABLE: Record<string, MethodEntry> = {
  selectFile: { kind: 'invoke', params: ['filters'] },
  selectFiles: { kind: 'invoke', params: ['filters'] },
  selectFolderFiles: { kind: 'invoke', params: [] },
  expandPaths: { kind: 'invoke', params: ['paths'] },
  selectOutput: { kind: 'invoke', params: [] },
  selectDirectory: { kind: 'invoke', params: [] },
  getMediaInfo: { kind: 'invoke', params: ['filePath', 'transcoderType'] },
  getImageInfo: { kind: 'invoke', params: ['filePath'] },
  getImagePreview: { kind: 'invoke', params: ['filePath'] },
  getImageFileInfo: { kind: 'invoke', params: ['filePath'] },
  getVideoPreview: { kind: 'invoke', params: ['filePath'] },
  getCapabilities: { kind: 'invoke', params: [] },
  convertFile: { kind: 'invoke', params: ['input', 'output', 'options', 'transcoderType'] },
  pauseConversion: { kind: 'invoke', params: [] },
  resumeConversion: { kind: 'invoke', params: [] },
  cancelConversion: { kind: 'invoke', params: [] },
  queueAdd: { kind: 'invoke', params: ['input', 'output', 'options', 'transcoder', 'overwrite'] },
  queueRemove: { kind: 'invoke', params: ['id'] },
  queueList: { kind: 'invoke', params: [] },
  queueGetState: { kind: 'invoke', params: [] },
  queueCancelAll: { kind: 'invoke', params: [] },
  queueClearCompleted: { kind: 'invoke', params: [] },
  queueSetConcurrency: { kind: 'invoke', params: ['concurrency'] },
  queueSetWhenDone: { kind: 'invoke', params: ['config'] },
  queueMoveTo: { kind: 'invoke', params: ['id', 'toPosition'] },
  queueUpdateOptions: { kind: 'invoke', params: ['id', 'options', 'output'] },
  queuePause: { kind: 'invoke', params: [] },
  queueResume: { kind: 'invoke', params: [] },
  queueStart: { kind: 'invoke', params: [] },
  queueExport: { kind: 'invoke', params: [] },
  queueImport: { kind: 'invoke', params: [] },
  revealFile: { kind: 'invoke', params: ['filePath'] },
  playerOpen: { kind: 'invoke', params: ['filePath'] },
  playerSeek: { kind: 'invoke', params: ['time'] },
  playerClose: { kind: 'invoke', params: [] },
  playerGetFrame: { kind: 'invoke', params: [] },
  extractWaveform: { kind: 'invoke', params: ['filePath', 'duration'] },
  extractThumbnails: { kind: 'invoke', params: ['filePath', 'duration'] },
  windowMinimize: { kind: 'send', params: [] },
  windowMaximizeToggle: { kind: 'send', params: [] },
  windowClose: { kind: 'send', params: [] },
  windowCloseConfirmed: { kind: 'send', params: [] },
  rejectTerms: { kind: 'send', params: [] },
  windowSetAlwaysOnTop: { kind: 'send', params: ['flag'] },
  setLaunchAtLogin: { kind: 'send', params: ['enabled'] },
  monitoringGetState: { kind: 'invoke', params: [] },
  monitoringSetEnabled: { kind: 'invoke', params: ['enabled'] },
  analyticsGetState: { kind: 'invoke', params: [] },
  analyticsSetEnabled: { kind: 'invoke', params: ['enabled'] },
  mcpGetSettings: { kind: 'invoke', params: [] },
  mcpSetSettings: { kind: 'invoke', params: ['settings'] },
  captureDevScreenshot: { kind: 'invoke', params: [] },
  checkForUpdates: { kind: 'invoke', params: [] },
  downloadUpdate: { kind: 'invoke', params: [] },
  installUpdate: { kind: 'invoke', params: ['installerPath'] },
  cancelDownload: { kind: 'invoke', params: [] },
  openReleaseNotes: { kind: 'invoke', params: ['url'] },
  scheduleInstallOnRestart: { kind: 'invoke', params: ['installerPath', 'version'] },
  cancelRestartInstall: { kind: 'invoke', params: [] },
  getPendingInstall: { kind: 'invoke', params: [] },
};

/**
 * Event subscriptions, kept present but silent - the same contract as the E2E
 * mock: a bridge with no events is a case the renderer must also survive, and
 * omitting the members would break component mount and test a different bug.
 */
const SUBSCRIBERS: readonly string[] = [
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
  'onAuditEntry',
  'onUpdateAvailable',
  'onUpdateNotAvailable',
  'onUpdateProgress',
  'onUpdateDownloaded',
  'onUpdateError',
];

/**
 * A stable pseudo-random bucket for a name, so `partial` fails the *same*
 * methods on every run. Mirrors the E2E mock exactly; the determinism is what
 * lets both tiers bisect a partial-failure finding to one call.
 */
export function bucketOf(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 100;
}

/**
 * The rejection value, in one of several deliberately awkward shapes: an
 * `Error`, a plain object, a string, or `null`. A renderer that reads
 * `err.message` on a `null` rejection must be caught. Only used for
 * asynchronous rejections - contexts can only carry a real `Error` out of a
 * synchronous throw (see {@link syncFailureFor}).
 */
function rejectionFor(name: string, mode: string): unknown {
  switch (bucketOf(name) % 4) {
    case 0:
      return new Error(`${MODE_NAME} ${mode} failure from ${name}`);
    case 1:
      return { code: 'EHOSTILE', method: name, message: `${MODE_NAME} ${mode} failure from ${name}` };
    case 2:
      return `${MODE_NAME} ${mode} failure from ${name}`;
    default:
      return null;
  }
}

/** The exception thrown by a synchronous failure - always a real `Error`. */
function syncFailureFor(name: string, mode: string): Error {
  return new Error(`${MODE_NAME} ${mode} failure from ${name}`);
}

/**
 * A value of a plausible but wrong shape for the method, aimed at the
 * renderer's assumptions: `.map` over a non-array, `.toFixed` on a string,
 * truthiness checks on an object.
 */
function wrongTypeFor(name: string): unknown {
  if (/List$/.test(name)) return { notAnArray: true };
  if (/Count$/.test(name)) return '12';
  if (/State$|Enabled$/.test(name)) return 'enabled';
  if (/^set|Add$|Remove$|Move|Update|Export|Import|Clear|Cancel|Pause|Resume|Start|Open|Reveal|Install|Download/.test(name)) return 42;
  return null;
}

/**
 * A large, hostile payload: 1 MB of bytes, or a self-referential object. The
 * cyclic variant exists because structured clone preserves cycles, so a store
 * that JSON-stringifies a bridge result - several do when persisting - throws
 * where a shallow copy would not.
 */
function garbageFor(name: string): unknown {
  if (bucketOf(name) % 2 === 0) {
    const bytes = new Uint8Array(1024 * 1024);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 31 + bucketOf(name)) & 0xff;
    return bytes.buffer;
  }
  const cyclic: Record<string, unknown> = { kind: 'garbage', depth: 0 };
  cyclic.self = cyclic;
  return cyclic;
}

/**
 * The benign value a healthy pass-through resolves with - the unit tier's
 * stand-in for "main answered", matching the defaults the test-setup stub
 * returns so pages mount the same content they do in every other unit test.
 */
function benignResolveFor(name: string): unknown {
  switch (name) {
    case 'selectFile':
    case 'selectOutput':
    case 'selectDirectory':
      return null;
    case 'selectFiles':
    case 'selectFolderFiles':
    case 'expandPaths':
    case 'queueList':
      return [];
    case 'getMediaInfo':
      return { file: '', format: '', size: 0, duration: 0, bitrate: '', streams: [] };
    case 'getImageInfo':
    case 'getImagePreview':
    case 'getImageFileInfo':
    case 'getVideoPreview':
    case 'getCapabilities':
    case 'playerGetFrame':
    case 'extractWaveform':
    case 'extractThumbnails':
    case 'getPendingInstall':
      return null;
    case 'queueGetState':
      return { paused: false, concurrency: 1 };
    case 'queueClearCompleted':
    case 'queueExport':
    case 'queueImport':
      return 0;
    case 'queueMoveTo':
      return true;
    case 'queueUpdateOptions':
      return false;
    case 'queueAdd':
      return '';
    default:
      return undefined;
  }
}

/** @interface */
export interface HostileControl {
  /** The mode currently injected. */
  getMode(): string;
  /** Switches the mode applied from now on. */
  setMode(next: string): string;
  /** Restricts failure to the named methods; `null` fails everything. */
  setFailures(list: string[] | null): string[];
  /** The restricted failure set, or `null` when everything fails. */
  getFailures(): string[] | null;
  /** Method names that reached the bridge, in order. */
  getCalls(): string[];
  /** The member names this bridge exposes. */
  getMembers(): string[];
  /** Every mode this bridge understands. */
  getModes(): string[];
}

/** @interface */
export interface HostileBridge {
  /** The hostile `window.electronAPI` stand-in. */
  api: Record<string, (...args: unknown[]) => unknown>;
  /** The `__hostile`-style control surface for the sweeping test. */
  control: HostileControl;
}

/**
 * Builds a `window.electronAPI` stand-in that injects the given failure mode
 * into every call whose method the mode applies to.
 *
 * A single instance is installed once and its mode is switched with
 * {@link HostileControl.setMode} between scenarios; because renderer consumers
 * read `window.electronAPI.<method>` at call time rather than capturing it at
 * import time, a mode change on the same object affects every future call even
 * from already-imported modules - which is exactly how the E2E mock behaves.
 *
 * @param initialMode - The mode to inject from construction on.
 * @returns The bridge and its control surface.
 */
export function createHostileElectronAPI(initialMode: string = 'healthy'): HostileBridge {
  let mode = initialMode;

  /** Methods to fail, or `null` for all of them. */
  let failures: Set<string> | null = null;

  /** Method names that reached the bridge, in order. */
  const calls: string[] = [];

  function interferes(name: string): boolean {
    return failures === null || failures.has(name);
  }

  function respond(name: string): unknown {
    if (!interferes(name)) return Promise.resolve(benignResolveFor(name));
    if (mode === 'reject-sync') throw syncFailureFor(name, mode);
    if (mode === 'reject-async') return Promise.reject(rejectionFor(name, mode));
    if (mode === 'never') return new Promise(() => {});
    if (mode === 'wrong-type') return Promise.resolve(wrongTypeFor(name));
    if (mode === 'garbage') return Promise.resolve(garbageFor(name));
    if (mode === 'partial' && bucketOf(name) < 70) return Promise.reject(rejectionFor(name, mode));
    return Promise.resolve(benignResolveFor(name));
  }

  const api: Record<string, (...args: unknown[]) => unknown> = {};

  for (const [name, entry] of Object.entries(API_TABLE)) {
    api[name] = (...args: unknown[]): unknown => {
      calls.push(name);
      if (entry.kind === 'send') {
        // `send` methods return void in the real bridge: there is no promise to
        // reject, so the only real failures are a synchronous throw or silence.
        // `never`, `garbage` and `wrong-type` resolve to silence (main simply
        // never acts on the send); `reject-*` and a partial hit throw.
        if (interferes(name)) {
          if (mode === 'never' || mode === 'garbage' || mode === 'wrong-type') return undefined;
          if (mode === 'reject-async' || mode === 'reject-sync' || (mode === 'partial' && bucketOf(name) < 70)) {
            throw syncFailureFor(name, mode);
          }
        }
        return undefined;
      }
      return respond(name);
    };
  }

  // `webUtils.getPathForFile` is synchronous in the real bridge, so its failure
  // mode must be too.
  api.getPathForFile = (file: unknown): unknown => {
    calls.push('getPathForFile');
    if (
      interferes('getPathForFile') &&
      (mode === 'reject-sync' || mode === 'reject-async' || (mode === 'partial' && bucketOf('getPathForFile') < 70))
    ) {
      throw syncFailureFor('getPathForFile', mode);
    }
    if (!interferes('getPathForFile')) return '';
    if (mode === 'wrong-type') return 12345;
    if (mode === 'never' || mode === 'garbage') return '/hostile/no-such-path';
    return '';
  };

  for (const name of SUBSCRIBERS) {
    api[name] = (): (() => void) => {
      calls.push(name);
      return () => {};
    };
  }

  const control: HostileControl = {
    getMode: () => mode,
    setMode: (next: string): string => {
      mode = next;
      return mode;
    },
    setFailures: (list: string[] | null): string[] => {
      failures = list === null || list === undefined ? null : new Set(list);
      return failures === null ? [] : [...failures];
    },
    getFailures: (): string[] | null => (failures === null ? null : [...failures]),
    getCalls: (): string[] => calls.slice(),
    getMembers: (): string[] => Object.keys(api).sort(),
    getModes: (): string[] => MODE_LIST.slice(),
  };

  return { api, control };
}
