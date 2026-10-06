/**
 * @fileoverview Phase 7 - hostile input against the real updater module.
 *
 * Every test here drives `src/main/updater.ts` through mocked `electron`, `https` and
 * `fs`, so each one is a statement about the updater rather than about a literal in the
 * test file. The names are the defect each one was written for: they are the tripwire for
 * the trust model documented in the module's fileoverview.
 *
 * Two of these arrived as scaffolding that asserted on literals and imported nothing; the
 * rewrite found 13 defects, all of which are now fixed. The tests are written as
 * "the module refuses X" so a regression re-opens the hole rather than quietly passing.
 *
 * @see src/main/updater.ts, src/main/__tests__/updater.test.ts (the happy-path suite)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { expectAppLog } from '../../test-utils/crash-tripwire';

const { openPathMock, openExternalMock, quitMock, getVersionMock, getPathMock } = vi.hoisted(() => ({
  openPathMock: vi.fn().mockResolvedValue(''),
  openExternalMock: vi.fn().mockResolvedValue(undefined),
  quitMock: vi.fn(),
  getVersionMock: vi.fn(() => '1.0.0'),
  getPathMock: vi.fn((name: string) => (name === 'userData' ? '/userData' : '/tmp')),
}));

const { httpsGetMock } = vi.hoisted(() => ({ httpsGetMock: vi.fn() }));

/** @interface FakeWriteStream - the slice of `fs.WriteStream` the updater touches. */
interface FakeWriteStream extends EventEmitter {
  writes: Buffer[];
  write: (chunk: Buffer) => boolean;
  end: (cb?: () => void) => void;
  destroy: ReturnType<typeof vi.fn>;
}

const writeStreams = vi.hoisted(() => [] as FakeWriteStream[]);

vi.mock('electron', () => ({
  app: { getVersion: getVersionMock, getPath: getPathMock, quit: quitMock },
  shell: { openPath: openPathMock, openExternal: openExternalMock },
  BrowserWindow: class {},
}));

vi.mock('https', () => ({ get: httpsGetMock }));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => ''),
  unlinkSync: vi.fn(),
  createWriteStream: vi.fn(() => {
    const stream = new EventEmitter() as unknown as FakeWriteStream;
    stream.writes = [];
    stream.write = (chunk: Buffer) => {
      stream.writes.push(chunk);
      return true;
    };
    stream.end = (cb?: () => void) => cb?.();
    stream.destroy = vi.fn();
    writeStreams.push(stream);
    return stream;
  }),
}));

import * as fs from 'fs';
import * as nodePath from 'path';
import type { BrowserWindow } from 'electron';

import {
  compareVersions,
  selectAsset,
  checkForUpdate,
  downloadUpdate,
  cancelDownload,
  installUpdate,
  openReleaseNotes,
  scheduleInstallOnRestart,
  readPendingInstall,
  autoInstallPendingUpdate,
} from '../updater';
import type { UpdateAsset, UpdateInfo, UpdateProgress } from '../../shared/types';
import { MAX_OS_STRING_LENGTH } from '../../shared/validation';

/** Header bag as Node hands it over: values are `string | string[]`. */
type ResHeaders = Record<string, string | string[]>;

/** @interface FakeRes - a fake `http.IncomingMessage`. */
interface FakeRes extends EventEmitter {
  statusCode: number;
  headers: ResHeaders;
  destroy: ReturnType<typeof vi.fn>;
}

/** @interface One captured `https.get` call. */
interface CapturedGet {
  url: unknown;
  opts: Record<string, unknown>;
  /** Delivers the response head to the updater's callback and returns the response for events. */
  respond: (init?: { statusCode?: number; headers?: ResHeaders }) => FakeRes;
  /** Emits a request-level error, the way a DNS or connection failure would. */
  fail: (err: Error) => void;
}

/** @interface FakeWin - a `BrowserWindow` whose `webContents.send` is a spy. */
interface FakeWin extends BrowserWindow {
  webContents: BrowserWindow['webContents'] & { send: ReturnType<typeof vi.fn> };
}

/**
 * The directory the updater is allowed to write installers into.
 *
 * `resolve`d rather than `join`ed so the expectation matches what `path.resolve` hands back on
 * this platform (`C:\tmp\...` on Windows, `/tmp/...` elsewhere).
 */
const UPDATE_DIR = nodePath.resolve('/tmp', 'EncodeX-updater');

/** A legitimate asset URL: on the allowlist, https, GitHub-owned. */
const ASSET_URL = 'https://github.com/Sandeepv68/EncodeX/releases/download/v2.0.0/EncodeX-2.0.0-x64-setup.exe';

/** A legitimate asset name. */
const ASSET_NAME = 'EncodeX-2.0.0-x64-setup.exe';

/** The legitimate absolute path of a downloaded installer. */
const INSTALLER_PATH = nodePath.join(UPDATE_DIR, ASSET_NAME);

/** The fake window `downloadUpdate` reports progress to. */
const win = { isDestroyed: () => false, webContents: { send: vi.fn() } } as unknown as FakeWin;

/** A destroyed-window double, for the case where the window went away mid-download. */
const destroyedWin = { isDestroyed: () => true, webContents: { send: vi.fn() } } as unknown as FakeWin;

/** Progress events `win` received, oldest first. */
function progressEvents(): UpdateProgress[] {
  return win.webContents.send.mock.calls
    .filter((call: unknown[]) => call[0] === 'update-progress')
    .map((call: unknown[]) => call[1] as UpdateProgress);
}

/** Builds a `release/latest` body with any shape at all. */
function release(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    tag_name: 'v2.0.0',
    body: 'notes',
    html_url: 'https://github.com/Sandeepv68/EncodeX/releases/tag/v2.0.0',
    assets: [{ name: ASSET_NAME, browser_download_url: ASSET_URL, size: 1024 }],
    ...overrides,
  });
}

/** A minimal asset. */
function asset(name: string, url = ASSET_URL, size = 1024, digest?: string): UpdateAsset {
  return { name, url, size, digest };
}

/** An `UpdateInfo` wrapping one asset, for the download tests. */
function infoFor(name: string, url = ASSET_URL, digest?: string): UpdateInfo {
  return { version: '2.0.0', releaseNotes: '', releaseUrl: 'https://example.invalid', asset: asset(name, url, 1024, digest) };
}

/**
 * True when `target` resolves inside `dir`. The invariant the traversal tests assert
 * from the other direction: nothing the update flow touches lands outside this dir.
 */
function isInside(dir: string, target: string): boolean {
  const rel = nodePath.relative(nodePath.resolve(dir), nodePath.resolve(target));
  return rel !== '' && !rel.startsWith('..') && !nodePath.isAbsolute(rel);
}

const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_ARCH = process.arch;

describe('updater hostile input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeStreams.length = 0;
    vi.mocked(fs.existsSync).mockImplementation(() => true);
    vi.mocked(fs.readFileSync).mockImplementation(() => '');
    openPathMock.mockResolvedValue('');
    getVersionMock.mockReturnValue('1.0.0');
    getPathMock.mockImplementation((name: string) => (name === 'userData' ? '/userData' : '/tmp'));
    Object.defineProperty(process, 'platform', { value: 'win32' });
    Object.defineProperty(process, 'arch', { value: 'x64' });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
    Object.defineProperty(process, 'arch', { value: ORIGINAL_ARCH });
    vi.restoreAllMocks();
  });

  /**
   * Installs a `https.get` double that records every call and lets the test drive each
   * response by hand, so no socket is ever opened.
   */
  function useFakeTransport(): CapturedGet[] {
    const calls: CapturedGet[] = [];
    httpsGetMock.mockImplementation((url: unknown, opts: Record<string, unknown>, cb: (res: FakeRes) => void) => {
      const req = new EventEmitter();
      calls.push({
        url,
        opts,
        respond: (init = {}) => {
          const res = new EventEmitter() as unknown as FakeRes;
          res.statusCode = init.statusCode ?? 200;
          res.headers = init.headers ?? {};
          res.destroy = vi.fn();
          cb(res);
          return res;
        },
        fail: (err: Error) => req.emit('error', err),
      });
      return req;
    });
    return calls;
  }

  /**
   * Runs `checkForUpdate` against a transport that serves one canned body.
   * @param body - Raw response body, exactly as a hostile endpoint would send it.
   * @returns {Promise<unknown>} The check's outcome, resolved or rejected.
   */
  function checkAgainst(body: string): Promise<unknown> {
    const calls = useFakeTransport();
    const pending = checkForUpdate();
    const res = calls[0]!.respond({ statusCode: 200 });
    res.emit('data', Buffer.from(body));
    res.emit('end');
    return pending;
  }

  /** Drives one successful download of `body` from the allowlisted URL. */
  function serveDownload(body: Buffer, headers: ResHeaders = {}): Promise<string> {
    const calls = useFakeTransport();
    const pending = downloadUpdate(infoFor(ASSET_NAME), win);
    const res = calls[0]!.respond({ statusCode: 200, headers });
    res.emit('data', body);
    res.emit('end');
    return pending;
  }

  describe('compareVersions against garbage', () => {
    it('throws on a non-string version rather than comparing it', () => {
      for (const hostile of [null, undefined, 42, {}, [], 10n ** 30n, Symbol('v1')]) {
        expect(() => compareVersions(hostile as unknown as string, '1.0.0'), `payload ${String(hostile)}`).toThrow();
      }
    });

    it('rejects a version that is not a version, naming it', () => {
      // The `Number('abc') || 0` collapse reported a corrupt tag as `0.0.0`, which
      // told the app it was up to date. There is no safe ordering of garbage, so it throws.
      for (const hostile of ['', '   ', 'not-a-version', '1.x.3', '1.2.3.4.5', '1.-1.0', '1.0.0-', 'v', null, undefined]) {
        expect(() => compareVersions(hostile as unknown as string, '1.0.0'), `payload ${String(hostile)}`).toThrow(/Unparseable version/);
      }
    });

    it('ignores build metadata, as semver 2.0.0 section 10 requires', () => {
      // Otherwise `1.0.0+build.7` outranks `1.0.0` and a rebuild is offered as an update.
      expect(compareVersions('1.0.0+build.7', '1.0.0')).toBe(0);
      expect(compareVersions('v2.0.0+20261006', '2.0.0')).toBe(0);
      expect(compareVersions('1.0.1+build.1', '1.0.0+build.9')).toBe(1);
    });

    it('orders a pathologically long version without hanging', () => {
      expect(() => compareVersions(`${'1.'.repeat(200_000)}0`, '1.0.0')).toThrow(/Unparseable version/);
    });
  });

  describe('selectAsset against hostile asset names', () => {
    it('drops an asset whose name is not a string instead of throwing', () => {
      for (const hostile of [undefined, null, 42, {}, []]) {
        expect(
          selectAsset([{ name: hostile, url: ASSET_URL, size: 1 } as unknown as UpdateAsset]),
          `payload ${String(hostile)}`,
        ).toBeNull();
      }
    });

    it('refuses an asset name that would escape the update directory', () => {
      for (const traversal of ['../../../../evil.exe', '..\\..\\..\\evil.exe', '/etc/cron.d/evil.exe', 'sub/dir/app.exe', 'evil .exe']) {
        expect(selectAsset([asset(traversal)]), traversal).toBeNull();
      }
    });

    it('refuses an asset name containing a NUL byte', () => {
      // `path.join` keeps the NUL, and the real `fs.createWriteStream` throws
      // `ERR_INVALID_ARG_VALUE` for it -- from inside the HTTPS response callback,
      // which is an uncaught exception rather than a rejected download.
      expect(selectAsset([asset(`evil\u0000.exe`)])).toBeNull();
    });

    it('refuses an asset that is not this platform installer format', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(selectAsset([asset('notes.txt')])).toBeNull();
      expect(selectAsset([asset('app.dmg')])).toBeNull();
      expect(selectAsset([asset(`${ASSET_NAME}.blockmap`)])).toBeNull();

      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(selectAsset([asset(`${ASSET_NAME}`)])).toBeNull();
      expect(selectAsset([asset('EncodeX-2.0.0-x86_64.AppImage')])?.name).toBe('EncodeX-2.0.0-x86_64.AppImage');
    });

    it('scans 5,000 assets and still picks the arch match', () => {
      // The noise names deliberately omit the arch: `selectAsset` matches on a
      // substring, so a hostile `evil-x64.exe` is a legitimate winner. What is
      // pinned here is only that a long list neither throws nor misses.
      const many: UpdateAsset[] = Array.from({ length: 5_000 }, (_, i) => asset(`EncodeX-2.0.0-setup-${i}.exe`));
      many.push(asset(ASSET_NAME));
      expect(selectAsset(many)?.name).toBe(ASSET_NAME);
    });

    it('returns null for an empty asset list', () => {
      expect(selectAsset([])).toBeNull();
    });
  });

  describe('checkForUpdate against a malformed releases payload', () => {
    it('names the problem when the top-level JSON is not an object', async () => {
      for (const body of ['[]', '"v2.0.0"', '123', 'true', 'null']) {
        await expect(checkAgainst(body), `body ${body}`).rejects.toThrow(/not a JSON object/);
      }
    });

    it('names the problem when a required field is missing or mistyped', async () => {
      for (const tag of [undefined, null, 42, {}, ['v2.0.0'], '   ']) {
        await expect(checkAgainst(release({ tag_name: tag })), `tag ${JSON.stringify(tag)}`).rejects.toThrow(/no usable tag_name/);
      }
      await expect(checkAgainst(release({ html_url: 42 }))).rejects.toThrow(/no usable html_url/);
      await expect(checkAgainst(release({ assets: null }))).rejects.toThrow(/no asset array/);
      await expect(checkAgainst(release({ assets: {} }))).rejects.toThrow(/no asset array/);
    });

    it('names the asset that is malformed', async () => {
      await expect(checkAgainst(release({ assets: [null] }))).rejects.toThrow(/non-object asset/);
      await expect(checkAgainst(release({ assets: ['app.exe'] }))).rejects.toThrow(/non-object asset/);
      await expect(checkAgainst(release({ assets: [{ browser_download_url: ASSET_URL, size: 1 }] }))).rejects.toThrow(/asset with no name/);
      await expect(checkAgainst(release({ assets: [{ name: '', browser_download_url: ASSET_URL }] }))).rejects.toThrow(
        /asset with no name/,
      );
      await expect(checkAgainst(release({ assets: [{ name: ASSET_NAME }] }))).rejects.toThrow(/had no download URL/);
    });

    it('treats an unorderable tag as up to date instead of throwing at the user', async () => {
      expectAppLog('warn', 'main/updater');

      await expect(checkAgainst(release({ tag_name: 'v2.0.0-nightly-garbage!!' }))).resolves.toBeNull();
    });

    it('reports no update when the platform has no asset, rather than crashing', async () => {
      expectAppLog('warn', 'main/updater');

      await expect(checkAgainst(release({ assets: [{ name: 'app.dmg', browser_download_url: ASSET_URL, size: 1 }] }))).resolves.toBeNull();
    });

    it('normalises a hostile asset size to zero', async () => {
      // `size` is untrusted data crossing the IPC boundary into a field typed as a byte
      // count. `-1` and `2**53` were passed through verbatim before.
      for (const size of [-1, 2 ** 53, '4 GB', null, Number.NaN, Infinity]) {
        const body = release({ assets: [{ name: ASSET_NAME, browser_download_url: ASSET_URL, size }] });
        const info = (await checkAgainst(body)) as UpdateInfo;
        expect(info.asset.size, `size ${String(size)}`).toBe(0);
      }
    });

    it('issues exactly one request for 200 concurrent checks', async () => {
      // No single-flight meant 200 concurrent checks became 200 requests to GitHub, and
      // the renderer can trigger that alone since `CHECK_FOR_UPDATES` has no debounce.
      const calls = useFakeTransport();
      const pending = Array.from({ length: 200 }, () => checkForUpdate());
      for (const call of calls) {
        const res = call.respond({ statusCode: 404 });
        res.emit('end');
      }
      await expect(Promise.all(pending)).resolves.toEqual(Array.from({ length: 200 }, () => null));
      expect(httpsGetMock).toHaveBeenCalledOnce();
    });

    it('starts a fresh check after the previous one settles', async () => {
      const calls = useFakeTransport();
      for (let i = 0; i < 2; i++) {
        const pending = checkForUpdate();
        const res = calls[i]!.respond({ statusCode: 404 });
        res.emit('end');
        await expect(pending).resolves.toBeNull();
      }
      expect(httpsGetMock).toHaveBeenCalledTimes(2);
    });

    it('rejects a 429 carrying Retry-After without reading it', async () => {
      const calls = useFakeTransport();
      const pending = checkForUpdate();
      calls[0]!.respond({ statusCode: 429, headers: { 'retry-after': '3600' } });
      await expect(pending).rejects.toThrow('GitHub API returned status 429');
    });

    it('gives the request a deadline', async () => {
      const calls = useFakeTransport();
      const pending = checkForUpdate();
      expect(calls[0]!.opts.signal).toBeInstanceOf(AbortSignal);
      // Settled before the test ends: the in-flight check is module state, so a
      // request left open here would be handed to every later caller.
      const res = calls[0]!.respond({ statusCode: 404 });
      res.emit('end');
      await expect(pending).resolves.toBeNull();
    });

    it('refuses a release body past the size cap instead of buffering it', async () => {
      const calls = useFakeTransport();
      const pending = checkForUpdate();
      const res = calls[0]!.respond({ statusCode: 200 });
      const chunk = Buffer.alloc(1024 * 1024, 0x61);
      for (let i = 0; i < 5; i++) res.emit('data', chunk);
      await expect(pending).rejects.toThrow(/exceeded the size limit/);
    });

    it('rejects a body that is not JSON', async () => {
      await expect(checkAgainst('not-json')).rejects.toThrow(/Failed to parse GitHub API response/);
    });
  });

  describe('downloadUpdate against a hostile asset name', () => {
    it('refuses to write outside the update dir for a traversal asset name', async () => {
      expectAppLog('warn', 'main/updater');

      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor('../../../../evil.exe'), win);
      await expect(pending).rejects.toThrow(/Refusing to download an asset named/);
      expect(fs.createWriteStream).not.toHaveBeenCalled();
      expect(calls).toHaveLength(0);
    });

    it('writes only inside the update dir for a legitimate asset', async () => {
      await expect(serveDownload(Buffer.from('MZ\r\n'), { 'content-length': '4' })).resolves.toBe(INSTALLER_PATH);
      const dest = vi.mocked(fs.createWriteStream).mock.calls[0]![0] as string;
      expect(isInside(UPDATE_DIR, dest), `${dest} escaped the update dir`).toBe(true);
    });

    it('rejects a truncated download and removes the partial file', async () => {
      expectAppLog('warn', 'main/updater');

      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      const res = calls[0]!.respond({ statusCode: 200, headers: { 'content-length': '1048576' } });
      res.emit('data', Buffer.alloc(1024, 0x4d));
      // The connection closing short of the advertised size is what truncation
      // looks like on the wire, so `end` still arrives.
      res.emit('end');

      await expect(pending).rejects.toThrow(/ended before the advertised size/);
      expect(fs.unlinkSync).toHaveBeenCalledWith(INSTALLER_PATH);
      expect(writeStreams[0]!.destroy).toHaveBeenCalled();
    });

    it('rejects a body longer than advertised rather than reporting over 100 percent', async () => {
      expectAppLog('warn', 'main/updater');

      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      const res = calls[0]!.respond({ statusCode: 200, headers: { 'content-length': '10' } });
      res.emit('data', Buffer.alloc(100));
      res.emit('end');

      await expect(pending).rejects.toThrow(/ended before the advertised size/);
      for (const event of progressEvents()) expect(event.percent).toBeLessThanOrEqual(100);
    });

    it('rejects an HTML error page served as a 200', async () => {
      // A captive portal answering `<!doctype html>` is the realistic way a download turns
      // into a web page, and nothing downstream could tell it from an installer.
      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      const res = calls[0]!.respond({ statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
      res.emit('data', Buffer.from('<!doctype html><title>Sign in to the network</title>'));
      res.emit('end');

      await expect(pending).rejects.toThrow(/served as text\/html/);
      expect(fs.createWriteStream).not.toHaveBeenCalled();
    });

    it('never leaves progress as NaN for a hostile content-length', async () => {
      // Each case sends a body matching whatever length is advertised, so the
      // only way this can reject is the length arithmetic itself being wrong.
      // A repeated header is legitimate: Node exposes it as an array.
      const hostile: Array<{ headers: ResHeaders; bytes: number }> = [
        { headers: {}, bytes: 16 },
        { headers: { 'content-length': '-5' }, bytes: 16 },
        { headers: { 'content-length': 'abc' }, bytes: 16 },
        { headers: { 'content-length': ['10', '10'] }, bytes: 10 },
      ];
      for (const { headers, bytes } of hostile) {
        win.webContents.send.mockClear();
        const calls = useFakeTransport();
        const pending = downloadUpdate(infoFor(ASSET_NAME), win);
        const res = calls[0]!.respond({ statusCode: 200, headers });
        res.emit('data', Buffer.alloc(bytes));
        res.emit('end');

        await expect(pending, `headers ${JSON.stringify(headers)}`).resolves.toBe(INSTALLER_PATH);
        for (const event of progressEvents()) {
          expect(Number.isFinite(event.percent), `headers ${JSON.stringify(headers)}`).toBe(true);
          expect(event.percent).toBeGreaterThanOrEqual(0);
          expect(event.percent).toBeLessThanOrEqual(100);
        }
      }
    });

    it('verifies the published digest and rejects a mismatch', async () => {
      expectAppLog('warn', 'main/updater');

      const digest = `sha256:${'a'.repeat(64)}`;
      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME, ASSET_URL, digest), win);
      const res = calls[0]!.respond({ statusCode: 200, headers: { 'content-length': '4' } });
      res.emit('data', Buffer.from('MZ\r\n'));
      res.emit('end');

      await expect(pending).rejects.toThrow(/failed its checksum/);
      expect(fs.unlinkSync).toHaveBeenCalledWith(INSTALLER_PATH);
    });

    it('accepts a download whose digest matches', async () => {
      const body = Buffer.from('MZ\r\n');
      const digest = `sha256:${crypto.createHash('sha256').update(body).digest('hex')}`;
      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME, ASSET_URL, digest), win);
      const res = calls[0]!.respond({ statusCode: 200, headers: { 'content-length': String(body.length) } });
      res.emit('data', body);
      res.emit('end');
      await expect(pending).resolves.toBe(INSTALLER_PATH);
    });

    it('ignores a digest it cannot use rather than skipping verification silently', async () => {
      // A weak or malformed algorithm is dropped, so the download proceeds unverified --
      // the honest outcome, since refusing every release that omits a usable digest would
      // break the updater entirely.
      const body = Buffer.from('MZ\r\n');
      for (const digest of [`md5:${'a'.repeat(32)}`, 'sha256:zzzz', 'nocolon', '']) {
        writeStreams.length = 0;
        const calls = useFakeTransport();
        const pending = downloadUpdate(infoFor(ASSET_NAME, ASSET_URL, digest), win);
        const res = calls[0]!.respond({ statusCode: 200, headers: { 'content-length': String(body.length) } });
        res.emit('data', body);
        res.emit('end');
        await expect(pending, `digest ${digest}`).resolves.toBe(INSTALLER_PATH);
      }
    });

    it('rejects rather than hanging when the write stream errors', async () => {
      // Disk-full or a locked file: the stream used to have no `error` listener, so the
      // emit threw on a listener-less emitter and nothing ever settled the promise. The
      // renderer sat on "Downloading" until the user restarted the app.
      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      const res = calls[0]!.respond({ statusCode: 200, headers: { 'content-length': '8' } });
      res.emit('data', Buffer.alloc(4));

      const settled = pending.then(
        () => 'resolved',
        () => 'rejected',
      );
      writeStreams[0]!.emit('error', new Error('ENOSPC: no space left on device'));

      await expect(settled).resolves.toBe('rejected');
      await expect(pending).rejects.toThrow(/ENOSPC/);
      expect(fs.unlinkSync).toHaveBeenCalledWith(INSTALLER_PATH);
    });

    it('does not send progress to a destroyed window', async () => {
      destroyedWin.webContents.send.mockClear();
      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), destroyedWin);
      const res = calls[0]!.respond({ statusCode: 200, headers: { 'content-length': '4' } });
      res.emit('data', Buffer.from('MZ\r\n'));
      res.emit('end');
      await pending;
      expect(destroyedWin.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('downloadUpdate redirect handling', () => {
    it('refuses to download from an untrusted host at all', async () => {
      expectAppLog('warn', 'main/updater');

      const calls = useFakeTransport();
      await expect(downloadUpdate(infoFor(ASSET_NAME, 'http://evil.invalid/payload.exe'), win)).rejects.toThrow(/untrusted host/);
      expect(calls).toHaveLength(0);
    });

    it('refuses a redirect to a different host', async () => {
      expectAppLog('warn', 'main/updater');

      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      calls[0]!.respond({ statusCode: 302, headers: { location: 'https://evil.invalid/payload.exe' } });

      await expect(pending).rejects.toThrow(/untrusted host/);
      expect(calls).toHaveLength(1);
      expect(fs.createWriteStream).not.toHaveBeenCalled();
    });

    it('refuses a redirect that downgrades to http', async () => {
      expectAppLog('warn', 'main/updater');

      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      calls[0]!.respond({ statusCode: 302, headers: { location: 'http://github.com/objects/payload.exe' } });

      await expect(pending).rejects.toThrow(/untrusted host/);
    });

    it('follows a redirect to a GitHub CDN host', async () => {
      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      const cdn = 'https://release-assets.githubusercontent.com/github-production-release-asset/abc123';
      calls[0]!.respond({ statusCode: 302, headers: { location: cdn } });
      const second = calls[1]!.respond({ statusCode: 200, headers: { 'content-length': '4' } });
      second.emit('data', Buffer.from('MZ\r\n'));
      second.emit('end');

      await expect(pending).resolves.toBe(INSTALLER_PATH);
      expect(calls.map((call) => call.url)).toEqual([ASSET_URL, cdn]);
    });

    it('refuses a redirect chain past the hop budget', async () => {
      expectAppLog('warn', 'main/updater');

      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      const HOP_BUDGET = 5;
      // Answer one redirect at a time and stop as soon as the updater refuses, so the loop
      // never reads past the requests that were actually made.
      for (let i = 0; i < HOP_BUDGET + 2; i++) {
        if (calls[i] === undefined) break;
        calls[i]!.respond({
          statusCode: 302,
          headers: { location: `https://objects.githubusercontent.com/hop-${i}` },
        });
      }

      await expect(pending).rejects.toThrow(/Too many redirects/);
      expect(calls.length).toBeLessThanOrEqual(HOP_BUDGET + 2);
    });

    it('rejects a redirect whose Location header is missing', async () => {
      // `res.headers.location!` used to hand `undefined` to `https.get`, which throws
      // ERR_INVALID_ARG_TYPE from inside the response callback -- an uncaught exception,
      // not a rejected download.
      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      const res = calls[0]!.respond({ statusCode: 302 });

      await expect(pending).rejects.toThrow(/no Location header/);
      expect(res.destroy).toHaveBeenCalled();
      expect(calls).toHaveLength(1);
    });

    it('rejects with the status when the server answers 403', async () => {
      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      calls[0]!.respond({ statusCode: 403 });
      await expect(pending).rejects.toThrow('Download failed with status 403');
    });

    it('surfaces an aborted download as a cancellation', async () => {
      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      const abort = new Error('The operation was aborted');
      abort.name = 'AbortError';
      calls[0]!.fail(abort);
      await expect(pending).rejects.toThrow('Download cancelled');
    });

    it('destroys the active stream and aborts the request on cancel', async () => {
      const calls = useFakeTransport();
      const pending = downloadUpdate(infoFor(ASSET_NAME), win);
      const res = calls[0]!.respond({ statusCode: 200, headers: { 'content-length': '8' } });
      res.emit('data', Buffer.alloc(4));
      expect(calls[0]!.opts.signal).toBeInstanceOf(AbortSignal);
      const signal = calls[0]!.opts.signal as AbortSignal;

      cancelDownload();
      expect(writeStreams[0]!.destroy).toHaveBeenCalledOnce();
      expect(signal.aborted, 'cancelDownload must abort the in-flight request').toBe(true);

      res.emit('data', Buffer.alloc(4));
      res.emit('end');
      await pending;
    });
  });

  describe('pending-install marker as an attack surface', () => {
    const marker = (payload: unknown): void => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(payload));
    };

    it('refuses a marker naming any file outside the update dir', async () => {
      expectAppLog('warn', 'main/updater');

      for (const hostile of ['C:\\Windows\\System32\\cmd.exe', '../../evil.exe', '/usr/bin/xcalc', `${INSTALLER_PATH}.bat`, 'notes.txt']) {
        openPathMock.mockClear();
        quitMock.mockClear();
        marker({ installerPath: hostile, version: '2.0.0' });
        await autoInstallPendingUpdate();
        expect(openPathMock, `payload ${hostile} must not reach the OS`).not.toHaveBeenCalled();
        expect(quitMock, `payload ${hostile} must not quit the app`).not.toHaveBeenCalled();
      }
    });

    it('refuses to apply a marker with an empty version', async () => {
      // The guard was `if (pending.version && compareVersions(...) <= 0)`, so an empty
      // string short-circuited it and the installer ran unconditionally.
      expectAppLog('warn', 'main/updater');

      marker({ installerPath: INSTALLER_PATH, version: '' });
      await autoInstallPendingUpdate();
      expect(openPathMock).not.toHaveBeenCalled();
      expect(quitMock).not.toHaveBeenCalled();
    });

    it('refuses to apply a marker whose version is not a version', async () => {
      expectAppLog('warn', 'main/updater');

      marker({ installerPath: INSTALLER_PATH, version: 'garbage' });
      await autoInstallPendingUpdate();
      expect(openPathMock).not.toHaveBeenCalled();
    });

    it('refuses a megabyte-long marker path', async () => {
      // The exact payload `ipc-abuse.spec.ts` found reaching `shell.openPath` through
      // `installUpdate`, which Phase 3.3 capped at MAX_OS_STRING_LENGTH. The marker route
      // skipped the cap entirely.
      expectAppLog('warn', 'main/updater');

      marker({ installerPath: `${'x'.repeat(1024 * 1024)}.exe`, version: '2.0.0' });
      expect(readPendingInstall()).toBeNull();

      openPathMock.mockClear();
      await autoInstallPendingUpdate();
      expect(openPathMock).not.toHaveBeenCalled();
    });

    it('applies a legitimate marker', async () => {
      marker({ installerPath: INSTALLER_PATH, version: '2.0.0' });
      await autoInstallPendingUpdate();
      expect(openPathMock).toHaveBeenCalledWith(INSTALLER_PATH);
      expect(quitMock).toHaveBeenCalledOnce();
      expect(fs.unlinkSync).toHaveBeenCalledWith(nodePath.join('/userData', 'pending-install.json'));
    });

    it('does not pollute Object.prototype from the marker', async () => {
      marker({ __proto__: { polluted: true }, installerPath: INSTALLER_PATH, version: '2.0.0', extra: 'ignored' });
      expect(readPendingInstall()).toEqual({ installerPath: INSTALLER_PATH, version: '2.0.0' });
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('returns null for every non-string marker field', () => {
      expectAppLog('warn', 'main/updater');

      for (const payload of [
        { installerPath: 42, version: '2.0.0' },
        { installerPath: INSTALLER_PATH, version: null },
        { installerPath: null, version: null },
        { installerPath: { path: INSTALLER_PATH }, version: '2.0.0' },
        [],
        null,
        'not-json',
      ]) {
        vi.mocked(fs.readFileSync).mockReturnValue(typeof payload === 'string' ? payload : JSON.stringify(payload));
        expect(readPendingInstall(), `payload ${JSON.stringify(payload)}`).toBeNull();
      }
    });

    it('refuses an implausibly large marker file without parsing it', () => {
      expectAppLog('warn', 'main/updater');

      const huge = JSON.stringify({ installerPath: INSTALLER_PATH, version: '2.0.0', pad: 'x'.repeat(MAX_OS_STRING_LENGTH * 8) });
      vi.mocked(fs.readFileSync).mockReturnValue(huge);
      expect(readPendingInstall()).toBeNull();
    });

    it('clears the marker before deciding whether to run it', () => {
      // Single-fire ordering is intentional; this pins that it holds even when the
      // installer file has since disappeared.
      expectAppLog('warn', 'main/updater');

      const gone = nodePath.join(UPDATE_DIR, 'gone.exe');
      marker({ installerPath: gone, version: '2.0.0' });
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => p !== gone);
      return autoInstallPendingUpdate().then(() => {
        expect(fs.unlinkSync).toHaveBeenCalledWith(nodePath.join('/userData', 'pending-install.json'));
        expect(openPathMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('renderer-controlled install and release-notes targets', () => {
    it('installs a legitimate downloaded installer', async () => {
      await installUpdate(INSTALLER_PATH);
      expect(openPathMock).toHaveBeenCalledWith(INSTALLER_PATH);
      expect(quitMock).toHaveBeenCalledOnce();
    });

    it('refuses to launch any path the renderer names outside the update dir', async () => {
      expectAppLog('warn', 'main/updater');

      for (const target of ['C:\\Windows\\System32\\calc.exe', '/usr/bin/xcalc', '../../evil.exe', '/tmp/app.exe']) {
        openPathMock.mockClear();
        quitMock.mockClear();
        await installUpdate(target);
        expect(openPathMock, `payload ${target} must not reach the OS`).not.toHaveBeenCalled();
        expect(quitMock, `payload ${target} must not quit the app`).not.toHaveBeenCalled();
      }
    });

    it('refuses a non-string install target', async () => {
      expectAppLog('warn', 'main/updater');

      for (const hostile of [10n ** 30n, 0, null, undefined, true, { path: INSTALLER_PATH }, '', '  ']) {
        openPathMock.mockClear();
        await installUpdate(hostile as unknown as string);
        expect(openPathMock, `payload ${String(hostile)} must not reach the OS`).not.toHaveBeenCalled();
      }
    });

    it('refuses an install target that is a megabyte of string', async () => {
      expectAppLog('warn', 'main/updater');

      openPathMock.mockClear();
      await installUpdate('x'.repeat(1024 * 1024));
      expect(openPathMock).not.toHaveBeenCalled();
    });

    it('opens an https release-notes URL', async () => {
      await openReleaseNotes('https://github.com/Sandeepv68/EncodeX/releases/tag/v2.0.0');
      expect(openExternalMock).toHaveBeenCalledWith('https://github.com/Sandeepv68/EncodeX/releases/tag/v2.0.0');
    });

    it('refuses a release-notes URL that is not https', async () => {
      expectAppLog('warn', 'main/updater');

      // The renderer supplies this URL, so `file://`, `javascript:` and `smb://` all hand
      // the OS a target the release page has no business naming.
      for (const target of [
        'file:///C:/Windows/System32/calc.exe',
        'javascript:alert(1)',
        'smb://attacker/share/x.exe',
        'http://github.com/r',
      ]) {
        openExternalMock.mockClear();
        await openReleaseNotes(target);
        expect(openExternalMock, `payload ${target} must not reach the OS`).not.toHaveBeenCalled();
      }
    });

    it('refuses a release-notes URL that is not a usable string', async () => {
      expectAppLog('warn', 'main/updater');

      for (const hostile of [10n ** 30n, 0, null, undefined, true, ['https://x.invalid'], '', '  ', 'not a url']) {
        openExternalMock.mockClear();
        await openReleaseNotes(hostile as unknown as string);
        expect(openExternalMock, `payload ${String(hostile)} must not reach the OS`).not.toHaveBeenCalled();
      }
    });

    it('refuses a release-notes URL that is a megabyte of string', async () => {
      expectAppLog('warn', 'main/updater');

      openExternalMock.mockClear();
      await openReleaseNotes(`https://github.com/${'x'.repeat(1024 * 1024)}`);
      expect(openExternalMock).not.toHaveBeenCalled();
    });

    it('refuses to schedule a restart install for a path outside the update dir', () => {
      // The write side of the same boundary: whatever the renderer hands to
      // SCHEDULE_RESTART_INSTALL used to be written verbatim to userData and read back by
      // autoInstallPendingUpdate at the next launch.
      expectAppLog('warn', 'main/updater');

      scheduleInstallOnRestart('../../../../evil.exe', '2.0.0');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('refuses to schedule a restart install with an unusable version', () => {
      expectAppLog('warn', 'main/updater');

      scheduleInstallOnRestart(INSTALLER_PATH, '');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('persists a legitimate marker', () => {
      scheduleInstallOnRestart(INSTALLER_PATH, '2.0.0');
      const [filePath, contents] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(filePath).toBe(nodePath.join('/userData', 'pending-install.json'));
      expect(JSON.parse(contents as string)).toEqual({ installerPath: INSTALLER_PATH, version: '2.0.0' });
    });
  });
});
