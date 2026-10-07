/**
 * @fileoverview Committed unit-tier sweep of every request IPC handler with
 * hostile input.
 *
 * The e2e suite (`e2e/specs/ipc-abuse.spec.ts`) drives the *real* bridge +
 * real main process, which is the most faithful surface but only runs locally
 * (the `test:e2e:real` config is not part of CI). This file runs on every PR
 * in the normal unit tier and enforces the same class of guarantee at
 * handler width:
 *
 * - Every channel registered with `ipcMain.handle` is driven once per hostile
 *   input from the same catalogue the e2e suite uses (the plan's thirteen
 *   inputs plus `cyclic`, `bigint`, `symbol` and `function`).
 * - A handler that resolves, rejects with a formatted AppError, or throws a
 *   benign non-Error is fine. A handler that rejects or throws with a raw
 *   JavaScript engine error ("Cannot read properties of ...", "is not a
 *   function", ...) is the defect this harness exists to catch.
 * - Every rejection must be formattable by the app's own `formatError`, and
 *   nothing hostile may reach an OS-facing boundary (`shell.*`,
 *   `app.setLoginItemSettings`) with an argument type that boundary does not
 *   accept.
 *
 * The external boundaries are mocked so the sweep stays hermetic and fast:
 * no ffmpeg/ffprobe is spawned, no files are written, no dialogs open, no
 * network is reached. Handlers still run through their real validation,
 * coercion and error-wrapping code paths; only the medium they would reach
 * out of the process is substituted.
 *
 * One deliberate difference from the e2e counterpart: the e2e sweep invokes
 * handlers through the real `contextBridge`/structured-clone boundary, where
 * a value that cannot be cloned (`proxy-throws`) is rejected *before* main is
 * reached ("blocked at bridge"). This file hands the payload to the handler
 * in-process, so clone-incapable inputs are delivered in the form the bridge
 * would actually deliver: `proxy-throws` becomes a plain object, because a
 * live Proxy that throws on property read can never reach a handler.
 *
 * @see e2e/specs/ipc-abuse.spec.ts (the sibling e2e surface)
 * @see src/main/ipc/__tests__/channel-contract.test.ts (proves handler reachability)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { tmpdir } from 'os';
import { IPC } from '../../../shared/ipc-channels';
import { formatError } from '../../../shared/errors';
import { expectAppLog } from '../../../test-utils/crash-tripwire';

interface StubCall {
  boundary: string;
  argTypes: string[];
  maxArgLength: number;
  preview: string;
}

interface RequestChannel {
  channel: string;
  handler: (event: unknown, ...args: unknown[]) => unknown;
}

type CallStatus = 'resolved' | 'rejected' | 'threw-sync' | 'timeout' | 'non-promise';

interface CallOutcome {
  channel: string;
  status: CallStatus;
  errorName?: string;
  errorMessage?: string;
}

const rec = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: unknown, ...args: unknown[]) => unknown>,
  boundary: [] as StubCall[],
  recordBoundary(boundary: string, args: unknown[]): void {
    const typeOf = (value: unknown): string => {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    };
    let preview: string;
    try {
      preview = JSON.stringify(args, (_key, value: unknown) => (typeof value === 'bigint' ? `${String(value)}n` : value));
    } catch {
      preview = '[unserialisable]';
    }
    let maxArgLength = 0;
    for (const arg of args) {
      let length = 0;
      if (typeof arg === 'string') {
        length = arg.length;
      } else if (arg !== null && arg !== undefined) {
        try {
          length = JSON.stringify(arg)?.length ?? 0;
        } catch {
          length = String(arg).length;
        }
      }
      if (length > maxArgLength) maxArgLength = length;
    }
    rec.boundary.push({ boundary, argTypes: args.map(typeOf), maxArgLength, preview: (preview ?? '[undefined]').slice(0, 400) });
  },
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => {
      rec.handlers[channel] = fn;
    },
    on: () => undefined,
  },
  app: {
    getPath: () => tmpdir(),
    on: () => undefined,
    quit: () => undefined,
    getVersion: () => '0.0.0-test',
    isPackaged: false,
    setLoginItemSettings: (opts: unknown) => {
      rec.recordBoundary('app.setLoginItemSettings', [opts]);
    },
  },
  dialog: {
    showOpenDialog: () => ({ canceled: true, filePaths: [] }),
    showSaveDialog: () => ({ canceled: true, filePath: '' }),
  },
  shell: {
    showItemInFolder: (target: unknown) => {
      rec.recordBoundary('shell.showItemInFolder', [target]);
    },
    openExternal: (target: unknown) => {
      rec.recordBoundary('shell.openExternal', [target]);
    },
    openPath: (target: unknown) => {
      rec.recordBoundary('shell.openPath', [target]);
    },
  },
  BrowserWindow: class {},
}));

vi.mock('fs', () => {
  const util = {
    existsSync: () => false,
    readFileSync: () => '',
    readdirSync: () => [],
    mkdirSync: () => undefined,
    writeFileSync: () => undefined,
    unlink: (_path: string, cb?: (err: unknown) => void) => cb?.(null),
    unlinkSync: () => undefined,
    rmSync: () => undefined,
    statSync: () => ({ isDirectory: () => false, isFile: () => false, isSymbolicLink: () => false }),
    createReadStream: () => ({ on: () => undefined }),
  };
  return { ...util, default: util };
});

vi.mock('../../transcoders/factory', () => {
  const { EventEmitter } = require('events') as typeof import('events');
  return {
    createTranscoder: () => ({
      getInfo: async () => {
        throw new Error('seeded probe failure');
      },
      convert: () => {
        const emitter = new EventEmitter();
        setImmediate(() => emitter.emit('error', new Error('seeded convert failure')));
        return emitter;
      },
      pause: () => undefined,
      resume: () => undefined,
      cancel: () => undefined,
    }),
  };
});

vi.mock('../../transcoders/ffmpeg-core', () => ({
  FfmpegCore: class {
    async getInfo(): Promise<never> {
      throw new Error('seeded probe failure');
    }
  },
}));

vi.mock('../../player/frame-decoder', () => {
  const { EventEmitter } = require('events') as typeof import('events');
  return {
    FrameDecoder: class extends EventEmitter {
      // The real handler adds one 'frame' listener per PLAYER_OPEN and this
      // mock instance lives for the whole file, so the default cap is reached
      // mid-sweep and Node starts printing MaxListenersExceededWarning.
      constructor() {
        super();
        this.setMaxListeners(64);
      }

      open = () => undefined;
      seek = () => undefined;
      close = () => undefined;
    },
  };
});

vi.mock('../../image-info', () => ({ getImageInfo: async () => null }));
vi.mock('../../image-preview', () => ({ getImagePreview: async () => null }));
vi.mock('../../image-file-info', () => ({ getImageFileInfo: async () => null }));
vi.mock('../../video-preview', () => ({ getVideoPreview: async () => null }));
vi.mock('../../preview-cache', () => ({
  PreviewCache: class {
    async get(_key: string, factory: () => Promise<unknown>): Promise<unknown> {
      return factory();
    }
  },
}));

vi.mock('../../timeline/timeline-media', () => ({
  extractWaveform: async () => null,
  extractThumbnails: async () => null,
}));

vi.mock('../../capabilities', () => ({
  getEncoderCapabilities: () => null,
}));

vi.mock('../../updater', () => ({
  checkForUpdate: async () => null,
  downloadUpdate: async () => 'C:/fake-installer.exe',
  installUpdate: async () => undefined,
  cancelDownload: () => undefined,
  openReleaseNotes: async () => undefined,
  scheduleInstallOnRestart: () => undefined,
  cancelRestartInstall: () => undefined,
  readPendingInstall: () => null,
}));

vi.mock('../../queue/job-queue', () => {
  const { EventEmitter } = require('events') as typeof import('events');
  class JobQueue extends EventEmitter {
    addJob = async () => 'job-swept';
    cancelJob = () => undefined;
    cancelAll = () => undefined;
    getJobs = () => [] as unknown[];
    clearCompleted = () => 0;
    setConcurrency = () => undefined;
    moveJobTo = () => false;
    updateJobOptions = () => false;
    pause = () => undefined;
    resume = () => undefined;
    start = () => undefined;
    getConcurrency = () => 2;
    isPaused = () => false;
  }
  return { JobQueue };
});

vi.mock('../../queue/persistence', () => ({
  FileQueuePersistence: class {},
}));

vi.mock('../../power-actions', () => ({
  performPowerAction: () => undefined,
}));

vi.mock('../../../shared/analytics/AnalyticsService', () => ({
  recordAnalyticsEvent: () => undefined,
  getAnalyticsBackendName: () => 'none',
  setAnalyticsEnabled: async () => undefined,
}));

vi.mock('../../../shared/monitoring/MonitoringService', () => ({
  getMonitoringBackendName: () => 'none',
  setMonitoringEnabled: async () => undefined,
}));

/** Minimal `BrowserWindow` double (registration-time surface only). */
function makeFakeWindow(): unknown {
  return {
    webContents: {
      send: vi.fn(),
      isDestroyed: () => false,
      isCrashed: () => false,
      capturePage: vi.fn(() => ({ toPNG: () => Buffer.from('') })),
    },
    on: vi.fn(),
    once: vi.fn(),
    isDestroyed: () => false,
    isMinimized: () => false,
    isMaximized: () => false,
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
    setAlwaysOnTop: vi.fn(),
  };
}

/** Runs every registrar the real app runs, then snapshots the request handlers. */
async function registerEverything(): Promise<RequestChannel[]> {
  const { registerIpcHandlers } = await import('../handlers');
  const { registerMonitoringIpcBridge } = await import('../../monitoring/ipcBridge');
  const { registerAnalyticsIpcBridge } = await import('../../analytics/ipcBridge');
  const { registerMcpSettingsIpc } = await import('../../mcp/settings-ipc');

  const win = makeFakeWindow() as never;
  registerIpcHandlers(win);
  registerMonitoringIpcBridge({ userDataDir: tmpdir(), consentEnabled: false });
  registerAnalyticsIpcBridge({ userDataDir: tmpdir(), consentEnabled: false });
  registerMcpSettingsIpc({ userDataDir: tmpdir() });

  return Object.entries(rec.handlers).map(([channel, handler]) => ({ channel, handler }));
}

/**
 * Hostile input catalogue, mirroring `e2e/specs/ipc-abuse.spec.ts`. At unit
 * width the payload reaches the handler directly (structured-clone is the
 * e2e surface's concern), so the values are built here in the test process.
 */
const HOSTILE_INPUT_IDS = [
  'no-args',
  'undefined',
  'null',
  'zero',
  'empty-string',
  'nan',
  'traversal',
  'big-string',
  'big-array',
  'wide-object',
  'proto-keys',
  'frozen',
  'cyclic',
  'proxy-throws',
  'bigint',
  'symbol',
  'function',
] as const;

type HostileInputId = (typeof HOSTILE_INPUT_IDS)[number];

function buildInput(which: HostileInputId): unknown {
  switch (which) {
    case 'undefined':
      return undefined;
    case 'null':
      return null;
    case 'zero':
      return 0;
    case 'empty-string':
      return '';
    case 'nan':
      return NaN;
    case 'traversal':
      return '../../../../etc/passwd';
    case 'big-string':
      return 'x'.repeat(1024 * 1024);
    case 'big-array':
      return new Array(10000).fill(0);
    case 'wide-object': {
      const wide: Record<string, number> = {};
      for (let i = 0; i < 200; i += 1) wide[`key${i}`] = i;
      return wide;
    }
    case 'proto-keys': {
      const hostile: Record<string, unknown> = { innocent: true };
      Object.defineProperty(hostile, '__proto__', { value: { polluted: true }, enumerable: true, writable: true, configurable: true });
      Object.defineProperty(hostile, 'constructor', { value: { polluted: true }, enumerable: true, configurable: true });
      Object.defineProperty(hostile, 'prototype', { value: { polluted: true }, enumerable: true, configurable: true });
      return hostile;
    }
    case 'frozen':
      return Object.freeze({ path: '/etc/passwd', width: 1, height: 1 });
    case 'cyclic': {
      const root: Record<string, unknown> = { name: 'root' };
      root.self = root;
      root.list = [root];
      return root;
    }
    case 'proxy-throws':
      // The values assembled below are what this sweep *invokes* handlers
      // with. A live `new Proxy({}, { get(){ throw } })` cannot survive the
      // structured-clone boundary the real bridge sits behind: the clone step
      // throws before main is ever called, so no handler can receive it (see
      // the e2e sibling, where 'proxy-throws' reports 'blocked-at-bridge').
      // Delivery-equivalent form at handler width: a bare plain object,
      // which is what a hostile *deliverable* renderer value is.
      return {};
    case 'bigint':
      return 10n ** 30n;
    case 'symbol':
      return Symbol('hostile');
    case 'function':
      return function hostileFunction(): void {};
    default:
      return undefined;
  }
}

function describeFailure(err: unknown): { errorName: string; errorMessage: string } {
  if (err instanceof Error) return { errorName: err.name || 'Error', errorMessage: String(err.message) };
  if (typeof err === 'object' && err !== null) {
    const maybe = err as { name?: unknown; message?: unknown };
    return {
      errorName: typeof maybe.name === 'string' ? maybe.name : 'Object',
      errorMessage: String(maybe.message ?? '[no message property]'),
    };
  }
  return { errorName: typeof err, errorMessage: String(err) };
}

/** Signals of a handler that crashed on its own argument instead of validating it. */
const RAW_CRASH_SIGNATURES: RegExp[] = [
  /Cannot read propert(?:y|ies) of (?:undefined|null)/i,
  /Cannot convert undefined or null to object/i,
  /Cannot destructure propert/i,
  /\bis not a function\b/i,
  /\bis not iterable\b/i,
  /Object prototype may only be an Object or null/i,
  /Converting circular structure to JSON/i,
  /Maximum call stack size exceeded/i,
  /Cannot assign to read only property/i,
];

/** Per-call ceiling. A handler that keeps running past this is a hang. */
const PER_CALL_TIMEOUT_MS = 300;

/**
 * Channels that legitimately block when their precondition is unmet and so
 * hit the per-call budget when driven bare. Mirrors the e2e list (minus
 * `checkForUpdates`, which is mocked here and resolves instantly).
 */
const BLOCKING_BY_DESIGN = new Set<string>([IPC.PLAYER_GET_FRAME]);

async function callHandler(
  channel: string,
  handler: (event: unknown, ...args: unknown[]) => unknown,
  args: unknown[],
): Promise<CallOutcome> {
  let returned: unknown;
  try {
    returned = args.length === 0 ? handler({}) : handler({}, ...args);
  } catch (err) {
    return { channel, status: 'threw-sync', ...describeFailure(err) };
  }
  if (!returned || typeof (returned as Promise<unknown>).then !== 'function') {
    return { channel, status: 'non-promise' };
  }
  return Promise.race<CallOutcome>([
    (returned as Promise<unknown>).then(
      () => ({ channel, status: 'resolved' as const }),
      (err: unknown) => ({ channel, status: 'rejected' as const, ...describeFailure(err) }),
    ),
    new Promise<CallOutcome>((resolve) =>
      setTimeout(() => resolve({ channel, status: 'timeout' as const }), PER_CALL_TIMEOUT_MS).unref?.(),
    ),
  ]);
}

/**
 * Audits the OS-facing boundary log: only documented argument types may reach
 * `shell.*` and `app.setLoginItemSettings`, and no argument may be oversized.
 */
const BOUNDARY_ARGUMENT_CONTRACTS: Record<string, readonly string[]> = {
  'shell.openExternal': ['string'],
  'shell.openPath': ['string'],
  'shell.showItemInFolder': ['string'],
  'app.setLoginItemSettings': ['object'],
};

/**
 * The largest argument the audit tolerates at a contract-checked boundary.
 *
 * Mirrors `MAX_OS_STRING_LENGTH` in `src/shared/validation.ts`, with
 * headroom. Stated in absolute terms so the assertion is independent of the
 * constant it guards (same convention as the e2e suite).
 */
const MAX_OS_STRING_LENGTH_EXPECTED = 8192;

function expectBoundaryContracts(calls: StubCall[], inputId: HostileInputId): void {
  const checked = calls.filter((call) => call.boundary in BOUNDARY_ARGUMENT_CONTRACTS);

  const offenders = checked.filter((call) => {
    const allowed = BOUNDARY_ARGUMENT_CONTRACTS[call.boundary];
    return call.argTypes.some((type) => !allowed.includes(type));
  });
  expect(
    offenders,
    `${inputId}: handlers forwarded arguments the boundary does not accept:\n${offenders
      .map(
        (o) =>
          `  ${o.boundary} accepts [${(BOUNDARY_ARGUMENT_CONTRACTS[o.boundary] ?? []).join(', ')}] but got [${o.argTypes.join(', ')}]: ${o.preview}`,
      )
      .join('\n')}`,
  ).toHaveLength(0);

  const oversized = checked.filter((call) => call.maxArgLength > MAX_OS_STRING_LENGTH_EXPECTED);
  expect(
    oversized,
    `${inputId}: handlers forwarded an oversized payload to the OS:\n${oversized
      .map((o) => `  ${o.boundary} received an argument of ${o.maxArgLength} characters: ${o.preview}`)
      .join('\n')}`,
  ).toHaveLength(0);
}

function describeBadOutcomes(label: string, outcomes: CallOutcome[]): string {
  return `${label}:\n${outcomes.map((o) => `  ${o.channel} -> ${o.status}${o.errorName ? ` ${o.errorName}` : ''}: ${String(o.errorMessage).slice(0, 300)}`).join('\n')}`;
}

describe('IPC handler abuse (committed unit-tier sweep)', () => {
  let channels: RequestChannel[];

  beforeAll(async () => {
    channels = await registerEverything();
  });

  it('registers a request handler for every real request channel', () => {
    expect(channels.length).toBeGreaterThan(40);
  });

  for (const inputId of HOSTILE_INPUT_IDS) {
    it(`survives every request handler called with ${inputId}`, async () => {
      // Hostile input legitimately triggers app warnings (coerced-away reveal
      // requests, ignored expand calls, unpackable settings). The sweep drives
      // error paths on purpose, so any application WARN is expected here.
      expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);

      const args = inputId === 'no-args' ? [] : [buildInput(inputId)];
      const outcomes: CallOutcome[] = [];
      for (const { channel, handler } of channels) {
        outcomes.push(await callHandler(channel, handler, args));
      }

      expect(outcomes.length, 'the sweep must actually call every channel').toBe(channels.length);

      const timeouts = outcomes.filter((o) => o.status === 'timeout' && !BLOCKING_BY_DESIGN.has(o.channel));
      expect(timeouts, describeBadOutcomes(`handlers that hung beyond ${PER_CALL_TIMEOUT_MS}ms`, timeouts)).toHaveLength(0);

      const rawCrashes = outcomes.filter(
        (o) =>
          (o.status === 'rejected' || o.status === 'threw-sync') &&
          RAW_CRASH_SIGNATURES.some((pattern) => pattern.test(String(o.errorMessage))),
      );
      expect(rawCrashes, describeBadOutcomes('handlers crashed on an unvalidated argument', rawCrashes)).toHaveLength(0);

      const malformed = outcomes.filter((o) => {
        if (o.status !== 'rejected' && o.status !== 'threw-sync') return false;
        if (String(o.errorMessage).trim() === '') return true;
        if (!o.errorName || o.errorName === 'Object') return true;
        try {
          return formatError(new Error(String(o.errorMessage))).message.trim() === '';
        } catch {
          return true;
        }
      });
      expect(malformed, describeBadOutcomes('rejections that are not a formattable Error', malformed)).toHaveLength(0);

      expectBoundaryContracts([...rec.boundary], inputId);
      rec.boundary.length = 0;
    });
  }

  it('still answers a benign call on every handler after the abusive sweep', async () => {
    // Abuse once more with the input that historically crashed two
    // `JSON.stringify` call sites, then prove the handlers still work.
    expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);
    const args = [buildInput('cyclic')];
    for (const { channel, handler } of channels) {
      await callHandler(channel, handler, args);
    }

    const queueList = channels.find((c) => c.channel === IPC.QUEUE_LIST);
    const capabilities = channels.find((c) => c.channel === IPC.GET_CAPABILITIES);
    expect(queueList).toBeDefined();
    expect(capabilities).toBeDefined();

    const jobs = await (queueList?.handler({}) as Promise<unknown[]>);
    const caps = capabilities?.handler({}) as unknown;
    expect(jobs).toEqual([]);
    expect(caps).toBeNull();
  });
});
