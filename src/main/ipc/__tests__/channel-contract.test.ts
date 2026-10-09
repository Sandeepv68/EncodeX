/**
 * @fileoverview IPC channel contract test.
 *
 * Three independently maintained surfaces must agree on every channel name:
 *
 * 1. **Main** - `ipcMain.handle` / `ipcMain.on` registrations, spread over
 *    `registerIpcHandlers()` plus three separately-invoked bridges
 *    (`registerMonitoringIpcBridge`, `registerAnalyticsIpcBridge`,
 *    `registerMcpSettingsIpc`) wired directly in `src/main/index.ts`.
 * 2. **Preload** - the `api` object handed to `contextBridge.exposeInMainWorld`,
 *    which is what the renderer can actually reach.
 * 3. **Types** - the `ElectronAPI` interface in `src/renderer/electron-api.d.ts`.
 *
 * Nothing in the type system spans that boundary, so drift in either direction
 * is silent: a channel added to `IPC` and never registered fails only at
 * runtime ("No handler registered"), and a handler registered but never
 * exposed is dead code that still reads as coverage. This test diffs all three
 * sets and fails on any difference.
 *
 * The three surfaces are discovered by *running* the real registrars and
 * driving the real preload API against a recording `electron` mock, not by
 * grepping source. That matters: a channel referenced in a comment or a
 * dead-code branch does not count as wired, and a preload method that
 * forwards to the wrong channel is caught here rather than in production.
 */

import { describe, it, expect, vi } from 'vitest';
import { tmpdir } from 'os';
import { mkdtempSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

let mockDataDir: string | undefined;

/** A unique, owner-only userData directory, never the shared OS temp root. */
function mockUserDataDir(): string {
  mockDataDir ??= mkdtempSync(join(tmpdir(), 'encodex-channel-contract-'));
  return mockDataDir;
}

const rec = vi.hoisted(() => ({
  /** Channels registered with `ipcMain.handle` (request/response). */
  handle: [] as string[],
  /**
   * Same events as `handle`, but never reset by any test.
   *
   * The dev-mode test needs to observe registrations in isolation, and clearing
   * `handle` to do it would corrupt the contract assertions that run after it
   * (they read the same shared recorder). Keeping a parallel log lets that test
   * look at a window of registrations without disturbing the contract set.
   */
  handleLog: [] as string[],
  /** Channels registered with `ipcMain.on` (fire-and-forget). */
  listen: [] as string[],
  /** Channels the preload reaches via `ipcRenderer.invoke`. */
  invoke: [] as string[],
  /** Channels the preload reaches via `ipcRenderer.send`. */
  send: [] as string[],
  /** Channels the preload subscribes to via `ipcRenderer.on`. */
  subscribe: [] as string[],
  /** The object handed to `contextBridge.exposeInMainWorld`. */
  exposed: undefined as unknown,
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string) => {
      rec.handle.push(channel);
      rec.handleLog.push(channel);
    },
    on: (channel: string) => {
      rec.listen.push(channel);
    },
  },
  ipcRenderer: {
    invoke: (channel: string) => {
      rec.invoke.push(channel);
      return Promise.resolve(null);
    },
    send: (channel: string) => {
      rec.send.push(channel);
    },
    on: (channel: string) => {
      rec.subscribe.push(channel);
      return ipcRendererDouble;
    },
    removeListener: (channel: string) => {
      rec.subscribe = rec.subscribe.filter((c) => c !== channel);
    },
  },
  contextBridge: {
    exposeInMainWorld: (_key: string, api: unknown) => {
      rec.exposed = api;
    },
  },
  app: {
    getPath: () => mockUserDataDir(),
    on: vi.fn(),
    isPackaged: false,
    setLoginItemSettings: vi.fn(),
    getVersion: () => '0.0.0-test',
  },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  shell: { showItemInFolder: vi.fn(), openExternal: vi.fn() },
  BrowserWindow: class {},
  webUtils: { getPathForFile: () => 'C:/fake/path' },
}));

const ipcRendererDouble = {} as unknown;

/**
 * Minimal `BrowserWindow` double.
 *
 * At *registration* time the only window method actually invoked is
 * `win.on('close'|'maximize'|'unmaximize')` in `window.ts`; everything else is
 * reached from inside handler closures, which this test never calls. The
 * remaining members exist so a future registration-time call fails against a
 * named method rather than silently against a generic stub.
 */
function makeFakeWindow(): unknown {
  const webContents = {
    send: vi.fn(),
    isDestroyed: () => false,
    isCrashed: () => false,
    openDevTools: vi.fn(),
    on: vi.fn(),
    executeJavaScript: vi.fn(() => Promise.resolve()),
    capturePage: vi.fn(),
  };
  return {
    webContents,
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    removeListener: vi.fn(),
    isDestroyed: () => false,
    isMinimized: () => false,
    isMaximized: () => false,
    isFullScreen: () => false,
    isVisible: () => true,
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    restore: vi.fn(),
    close: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
  };
}

/**
 * Runs every registrar the real app runs, and drives the real preload API.
 *
 * The bridges are invoked here even though `registerIpcHandlers()` does not
 * call them: `src/main/index.ts` wires them separately at startup, so omitting
 * them would report 6 channels as unserved and turn the test into noise.
 */
async function collectSurfaces(): Promise<{
  api: Record<string, unknown>;
  apiKeys: string[];
}> {
  const { registerIpcHandlers } = await import('../handlers');
  const { registerMonitoringIpcBridge } = await import('../../monitoring/ipcBridge');
  const { registerAnalyticsIpcBridge } = await import('../../analytics/ipcBridge');
  const { registerMcpSettingsIpc } = await import('../../mcp/settings-ipc');

  registerIpcHandlers(makeFakeWindow() as never);
  registerMonitoringIpcBridge({ userDataDir: mockUserDataDir(), consentEnabled: false });
  registerAnalyticsIpcBridge({ userDataDir: mockUserDataDir(), consentEnabled: false });
  registerMcpSettingsIpc({ userDataDir: mockUserDataDir() });

  await import('../../../preload/index');

  const api = rec.exposed as Record<string, unknown>;
  const apiKeys = Object.keys(api).sort();

  // Drive every exposed method so each one records the channel it reaches.
  // `getPathForFile` is excluded: it calls webUtils, not an IPC channel, and
  // would otherwise pollute the accounting with a non-channel method.
  for (const [name, value] of Object.entries(api)) {
    if (name === 'getPathForFile') continue;
    if (typeof value !== 'function') continue;
    try {
      await (value as () => unknown)();
    } catch {
      // A method that rejects against the recording mock is still evidence that
      // it reached its channel; the channel was recorded before the throw.
    }
  }

  return { api, apiKeys };
}

/** Reads the `ElectronAPI` member names out of the ambient declaration. */
function declaredApiKeys(): string[] {
  const source = readFileSync(resolve(__dirname, '../../../renderer/electron-api.d.ts'), 'utf8');
  const start = source.indexOf('export interface ElectronAPI {');
  expect(start, 'ElectronAPI interface not found in electron-api.d.ts').toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf('\n}', start));
  const keys: string[] = [];
  for (const line of body.split('\n').slice(1)) {
    const trimmed = line.trim();
    // Skip doc comments and blank lines; keep `name(`/`name?(` member lines.
    if (trimmed === '' || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) continue;
    const match = /^(\w+)\??\s*\(/.exec(trimmed);
    if (match?.[1]) keys.push(match[1]);
  }
  return keys.sort();
}

/** Memoized so the registrars run once per file; i.mock is hoisted above. */
let surfaces: Promise<{ api: Record<string, unknown>; apiKeys: string[] }> | undefined;
function once(): Promise<{ api: Record<string, unknown>; apiKeys: string[] }> {
  surfaces ??= collectSurfaces();
  return surfaces;
}

describe('IPC channel contract', () => {
  /**
   * `DEV_CAPTURE_SCREENSHOT` is the one channel registered behind a runtime
   * guard: `registerDevHandlers()` returns early unless `isDevMode()`. The
   * preload exposes `captureDevScreenshot` unconditionally, so under a
   * production-like environment that one channel is legitimately unserved.
   * It is excluded from the general contract and asserted on its own below in
   * both modes, which is a stronger claim than quietly ignoring it.
   */
  const DEV_ONLY = 'dev-capture-screenshot';

  it('every channel the preload invokes has a main handler', async () => {
    await once();
    const missing = [...rec.invoke].filter((channel) => !rec.handle.includes(channel) && channel !== DEV_ONLY);
    expect(missing, 'invoke() reaches a channel with no ipcMain.handle()').toEqual([]);
  });

  it('registers the dev-only channel in dev mode and omits it in production', async () => {
    const { isDevMode } = await import('../dev');
    const { registerDevHandlers } = await import('../dev');
    const previous = process.env.NODE_ENV;
    const previousArgv = process.argv;
    try {
      process.env.NODE_ENV = 'development';
      rec.handleLog.length = 0;
      registerDevHandlers(makeFakeWindow() as never);
      expect(isDevMode(), 'isDevMode() should follow NODE_ENV=development').toBe(true);
      expect(rec.handleLog, 'dev handler must register in dev mode').toContain(DEV_ONLY);

      rec.handleLog.length = 0;
      process.env.NODE_ENV = 'production';
      process.argv = ['node', 'main.js'];
      expect(isDevMode(), 'isDevMode() should be false in production').toBe(false);
      registerDevHandlers(makeFakeWindow() as never);
      expect(rec.handleLog, 'dev handler must stay unregistered in production').not.toContain(DEV_ONLY);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
      process.argv = previousArgv;
    }
  });

  it('every channel the preload sends has a main listener', async () => {
    await once();
    const missing = [...rec.send].filter((channel) => !rec.listen.includes(channel));
    expect(missing, 'send() reaches a channel with no ipcMain.on()').toEqual([]);
  });

  it('every main handler is reachable from the preload', async () => {
    await once();
    const reached = new Set([...rec.invoke, ...rec.send]);
    const unreachable = rec.handle.filter((channel) => !reached.has(channel));
    expect(unreachable, 'registered handler no preload method reaches').toEqual([]);
  });

  it('every main listener is reachable from the preload', async () => {
    await once();
    const unreachable = rec.listen.filter((channel) => !rec.send.includes(channel));
    expect(unreachable, 'registered ipcMain.on listener no preload method reaches').toEqual([]);
  });

  it('no channel is both a request and a push event', async () => {
    await once();
    const events = new Set(rec.subscribe);
    const both = [...new Set(rec.invoke)].filter((channel) => events.has(channel));
    expect(both, 'channel is both invoke()d and subscribed to').toEqual([]);
  });

  it('the preload API and the ElectronAPI declaration list the same members', async () => {
    const { apiKeys } = await once();
    const declared = declaredApiKeys();
    const missingFromTypes = apiKeys.filter((key) => !declared.includes(key));
    const missingFromPreload = declared.filter((key) => !apiKeys.includes(key));
    expect({ missingFromTypes, missingFromPreload }, 'preload/type drift').toEqual({ missingFromTypes: [], missingFromPreload: [] });
  });

  it('classifies every declared channel as a request, a fire-and-forget, or a push event', async () => {
    const { IPC } = await import('../../../shared/ipc-channels');
    await once();
    const values = Object.values(IPC);
    const requests = new Set(rec.invoke);
    const fireAndForget = new Set(rec.send);
    const pushes = new Set(rec.subscribe);
    const orphans = values.filter((v) => !requests.has(v) && !fireAndForget.has(v) && !pushes.has(v));
    expect(orphans, 'IPC constant no surface uses').toEqual([]);
  });
});
