import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

const { openPathMock, openExternalMock, quitMock } = vi.hoisted(() => ({
  openPathMock: vi.fn().mockResolvedValue(''),
  openExternalMock: vi.fn().mockResolvedValue(undefined),
  quitMock: vi.fn(),
}));

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    getPath: vi.fn(() => '/tmp'),
    quit: quitMock,
  },
  shell: { openPath: openPathMock, openExternal: openExternalMock },
  BrowserWindow: class {},
}));

vi.mock('https', () => ({
  get: getMock,
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => ''),
  unlinkSync: vi.fn(),
  createWriteStream: vi.fn(() => {
    const stream = new EventEmitter();
    (stream as unknown as { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }).write = vi.fn();
    (stream as unknown as { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }).end = vi.fn((cb?: () => void) => cb?.());
    (stream as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy = vi.fn();
    return stream;
  }),
}));

import * as fs from 'fs';
import * as nodePath from 'path';

import {
  compareVersions,
  selectAsset,
  checkForUpdate,
  channelForVersion,
  installUpdate,
  openReleaseNotes,
  cancelDownload,
  scheduleInstallOnRestart,
  cancelRestartInstall,
  readPendingInstall,
  autoInstallPendingUpdate,
} from '../updater';
import { app } from 'electron';
import type { UpdateAsset, UpdateInfo } from '../../shared/types';
import { expectAppLog } from '../../test-utils/crash-tripwire';

const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_ARCH = process.arch;

/**
 * The update directory, and a legitimate installer inside it.
 *
 * `resolve`d rather than `join`ed so the expectation matches what `path.resolve` hands back on
 * this platform (`C:\tmp\...` on Windows, `/tmp/...` elsewhere).
 *
 * The extension follows the host platform because `resolveInstallerTarget` only accepts
 * `installerExtensions()` for the running platform (`.exe` / `.dmg` / `.appimage`), so a
 * hard-coded `.exe` would be rejected outright by the Linux CI runner instead of reaching
 * the behaviour these tests pin.
 */
const UPDATE_DIR = nodePath.resolve('/tmp', 'EncodeX-updater');
const INSTALLER_NAME = `EncodeX-2.0.0-x64-setup${
  ORIGINAL_PLATFORM === 'win32' ? '.exe' : ORIGINAL_PLATFORM === 'darwin' ? '.dmg' : '.appimage'
}`;
const INSTALLER = nodePath.join(UPDATE_DIR, INSTALLER_NAME);

/**
 * A GitHub releases-list body.
 *
 * The updater reads the **list** endpoint, so the payload is an array of
 * releases rather than a single release object. One release is the common case
 * in these tests, which is why the helper takes a single object.
 *
 * @param {Record<string, unknown>} release - One release object.
 * @returns {string} The serialized response body.
 */
function releaseList(release: Record<string, unknown>): string {
  return JSON.stringify([release]);
}

/**
 * A GitHub releases-list body carrying several releases.
 *
 * @param {Record<string, unknown>[]} releases - The releases, in any order.
 * @returns {string} The serialized response body.
 */
function releasesList(...releases: Record<string, unknown>[]): string {
  return JSON.stringify(releases);
}

/**
 * A release object with sensible defaults for the channel tests.
 *
 * @param {string} tag - The tag name.
 * @param {boolean} prerelease - Whether GitHub marks it as a pre-release.
 * @param {boolean} draft - Whether it is still a draft.
 * @returns {Record<string, unknown>} The release object.
 */
function releaseEntry(tag: string, prerelease = false, draft = false): Record<string, unknown> {
  return {
    tag_name: tag,
    body: `notes for ${tag}`,
    html_url: `https://github.com/Sandeepv68/EncodeX/releases/tag/${tag}`,
    assets: [{ name: 'EncodeX-2.0.0-x64-setup.exe', browser_download_url: 'https://dl', size: 1024 }],
    prerelease,
    draft,
  };
}

describe('updater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockImplementation(() => true);
    vi.mocked(fs.readFileSync).mockImplementation(() => '');
    // The channel tests override the running version; restore the default so a
    // version override cannot leak into an unrelated test.
    vi.mocked(app.getVersion).mockReturnValue('1.0.0');
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
    Object.defineProperty(process, 'arch', { value: ORIGINAL_ARCH });
    vi.restoreAllMocks();
  });

  describe('compareVersions', () => {
    it('detects a beta-to-beta bump', () => {
      expect(compareVersions('1.0.0-beta.1', '1.0.0-beta.0')).toBe(1);
      expect(compareVersions('1.0.0-beta.0', '1.0.0-beta.1')).toBe(-1);
      expect(compareVersions('1.0.0-beta.1', '1.0.0-beta.1')).toBe(0);
    });

    it('ranks stable above pre-release', () => {
      expect(compareVersions('1.0.0', '1.0.0-beta.9')).toBe(1);
      expect(compareVersions('1.0.0-rc.1', '1.0.0')).toBe(-1);
    });

    it('compares numeric core fields', () => {
      expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
      expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    });

    it('compares numeric pre-release identifiers numerically', () => {
      expect(compareVersions('1.0.0-beta.10', '1.0.0-beta.9')).toBe(1);
      expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1);
    });

    it('shorter pre-release set loses', () => {
      expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
      expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha')).toBe(1);
    });

    it('tolerates v prefix', () => {
      expect(compareVersions('v1.2.3-beta.4', '1.2.3-beta.4')).toBe(0);
      expect(compareVersions('V1.2.3-beta.4', 'v1.2.3-beta.4')).toBe(0);
    });

    it('compares mixed alphanumeric pre-release ids', () => {
      expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
      expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1);
    });

    it('handles different core field counts', () => {
      expect(compareVersions('1.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.1', '1.0.0')).toBe(1);
    });
  });

  describe('selectAsset', () => {
    const assets = (names: string[]): UpdateAsset[] => names.map((name) => ({ name, url: `https://example.com/${name}`, size: 1024 }));

    it('prefers arch-matching exe on win32', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });
      expect(selectAsset(assets(['EncodeX-1.0.0-x64-setup.exe', 'EncodeX-1.0.0-arm64-setup.exe']))?.name).toBe(
        'EncodeX-1.0.0-x64-setup.exe',
      );
    });

    it('falls back to first platform asset', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });
      expect(selectAsset(assets(['EncodeX-1.0.0-setup.exe']))?.name).toBe('EncodeX-1.0.0-setup.exe');
    });

    it('returns null when no platform asset', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });
      expect(selectAsset(assets(['EncodeX-1.0.0-x86_64.AppImage']))).toBeNull();
    });

    it('selects dmg on darwin and AppImage on linux', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      Object.defineProperty(process, 'arch', { value: 'arm64' });
      expect(selectAsset(assets(['EncodeX-1.0.0-x64.dmg', 'EncodeX-1.0.0-arm64.dmg']))?.name).toBe('EncodeX-1.0.0-arm64.dmg');

      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(selectAsset(assets(['EncodeX-1.0.0-x86_64.AppImage']))?.name).toBe('EncodeX-1.0.0-x86_64.AppImage');
    });

    it('never matches blockmap files', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'arm64' });
      expect(selectAsset(assets(['EncodeX-1.0.0-arm64-setup.exe.blockmap']))).toBeNull();
    });
  });

  describe('checkForUpdate', () => {
    function mockHttpsGet(
      handler: (res: EventEmitter & { statusCode: number; headers: Record<string, string> }) => void,
      initialStatus = 200,
    ) {
      getMock.mockImplementationOnce((_url: unknown, _opts: unknown, cb: unknown) => {
        const res = new EventEmitter() as EventEmitter & { statusCode: number; headers: Record<string, string> };
        (res as unknown as { statusCode: number }).statusCode = initialStatus;
        (res as unknown as { headers: Record<string, string> }).headers = {};
        (cb as (r: typeof res) => void)(res);
        handler(res);
        return { on: vi.fn() };
      });
    }

    it('returns null when GitHub API returns 404', async () => {
      mockHttpsGet((res) => {
        res.emit('end');
      }, 404);
      const result = await checkForUpdate();
      expect(result).toBeNull();
    });

    it('returns null when remote version is not newer', async () => {
      const data = releaseList({
        tag_name: 'v1.0.0',
        body: '',
        html_url: 'https://',
        assets: [{ name: 'app.exe', browser_download_url: 'https://', size: 100 }],
      });
      mockHttpsGet((res) => {
        res.emit('data', Buffer.from(data));
        res.emit('end');
      });
      const result = await checkForUpdate();
      expect(result).toBeNull();
    });

    it('returns null when no matching asset exists', async () => {
      expectAppLog('warn', 'main/updater');

      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });
      const data = releaseList({
        tag_name: 'v2.0.0',
        body: 'New',
        html_url: 'https://',
        assets: [{ name: 'app.dmg', browser_download_url: 'https://', size: 100 }],
      });
      mockHttpsGet((res) => {
        res.emit('data', Buffer.from(data));
        res.emit('end');
      });
      const result = await checkForUpdate();
      expect(result).toBeNull();
    });

    it('returns UpdateInfo when newer version with matching asset exists', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });
      const data = releaseList({
        tag_name: 'v2.0.0',
        body: 'New features',
        html_url: 'https://github.com/r',
        assets: [{ name: 'EncodeX-2.0.0-x64-setup.exe', browser_download_url: 'https://dl', size: 1024 }],
      });
      mockHttpsGet((res) => {
        res.emit('data', Buffer.from(data));
        res.emit('end');
      });
      const result = await checkForUpdate();
      expect(result).not.toBeNull();
      expect(result!.version).toBe('2.0.0');
      expect(result!.releaseNotes).toBe('New features');
      expect(result!.asset.name).toBe('EncodeX-2.0.0-x64-setup.exe');
    });

    it('handles network error', async () => {
      getMock.mockImplementationOnce(() => {
        const req = new EventEmitter();
        setTimeout(() => req.emit('error', new Error('network fail')), 0);
        return { on: req.on.bind(req) };
      });
      await expect(checkForUpdate()).rejects.toThrow('network fail');
    });

    it('handles non-200 status code', async () => {
      mockHttpsGet((res) => {
        res.emit('end');
      }, 500);
      await expect(checkForUpdate()).rejects.toThrow('GitHub API returned status 500');
    });

    it('handles invalid JSON response', async () => {
      mockHttpsGet((res) => {
        res.emit('data', Buffer.from('not-json'));
        res.emit('end');
      });
      await expect(checkForUpdate()).rejects.toThrow('Failed to parse GitHub API response');
    });

    it('strips v prefix from tag_name', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });
      const data = releaseList({
        tag_name: 'v3.0.0-beta.1',
        body: '',
        html_url: 'https://',
        assets: [{ name: 'EncodeX-3.0.0-x64.exe', browser_download_url: 'https://', size: 100 }],
      });
      mockHttpsGet((res) => {
        res.emit('data', Buffer.from(data));
        res.emit('end');
      });
      const result = await checkForUpdate();
      expect(result!.version).toBe('3.0.0-beta.1');
    });
  });

  describe('update channels', () => {
    /**
     * Serves a releases-list body and returns the check's outcome.
     *
     * @param {string} data - The serialized releases list.
     * @returns {Promise<unknown>} The check's outcome.
     */
    function checkList(data: string): Promise<unknown> {
      getMock.mockImplementationOnce((_url: unknown, _opts: unknown, cb: unknown) => {
        const res = new EventEmitter() as EventEmitter & { statusCode: number; headers: Record<string, string> };
        (res as unknown as { statusCode: number }).statusCode = 200;
        (res as unknown as { headers: Record<string, string> }).headers = {};
        (cb as (r: typeof res) => void)(res);
        res.emit('data', Buffer.from(data));
        res.emit('end');
        return { on: vi.fn() };
      });
      return checkForUpdate();
    }

    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });
    });

    it('classifies a pre-release version as the beta channel', () => {
      expect(channelForVersion('1.0.0-beta.5')).toBe('beta');
      expect(channelForVersion('1.0.0')).toBe('stable');
      expect(channelForVersion('not-a-version')).toBe('stable');
    });

    it('offers a newer pre-release to a beta client', async () => {
      vi.mocked(app.getVersion).mockReturnValue('1.0.0-beta.5');
      const result = (await checkList(releasesList(releaseEntry('v1.0.0-beta.6', true)))) as UpdateInfo | null;
      expect(result).not.toBeNull();
      expect(result!.version).toBe('1.0.0-beta.6');
    });

    it('never offers a pre-release to a stable client', async () => {
      vi.mocked(app.getVersion).mockReturnValue('1.0.0');
      const result = await checkList(releasesList(releaseEntry('v1.0.1-beta.1', true)));
      expect(result).toBeNull();
    });

    it('offers a newer stable release to a stable client', async () => {
      vi.mocked(app.getVersion).mockReturnValue('1.0.0');
      const result = (await checkList(releasesList(releaseEntry('v1.0.1')))) as UpdateInfo | null;
      expect(result).not.toBeNull();
      expect(result!.version).toBe('1.0.1');
    });

    it('offers a stable release to a beta client as well as a beta', async () => {
      vi.mocked(app.getVersion).mockReturnValue('1.0.0-beta.5');
      const result = (await checkList(releasesList(releaseEntry('v1.0.0', false, false)))) as UpdateInfo | null;
      expect(result).not.toBeNull();
      expect(result!.version).toBe('1.0.0');
    });

    it('picks the highest version across pre-releases and stable releases', async () => {
      vi.mocked(app.getVersion).mockReturnValue('1.0.0-beta.5');
      const result = (await checkList(
        releasesList(releaseEntry('v1.0.0-beta.9', true), releaseEntry('v1.0.0'), releaseEntry('v1.0.0-beta.6', true)),
      )) as UpdateInfo | null;
      expect(result!.version).toBe('1.0.0');
    });

    it('never offers a draft', async () => {
      vi.mocked(app.getVersion).mockReturnValue('1.0.0-beta.5');
      const result = await checkList(releasesList(releaseEntry('v1.0.0-beta.6', true, true)));
      expect(result).toBeNull();
    });

    it('skips a malformed release without losing the usable ones', async () => {
      vi.mocked(app.getVersion).mockReturnValue('1.0.0-beta.5');
      const result = (await checkList(releasesList({ tag_name: 42 }, releaseEntry('v1.0.0-beta.6', true)))) as UpdateInfo | null;
      expect(result).not.toBeNull();
      expect(result!.version).toBe('1.0.0-beta.6');
    });
  });

  describe('installUpdate', () => {
    it('calls shell.openPath and app.quit', async () => {
      await installUpdate(INSTALLER);
      expect(openPathMock).toHaveBeenCalledWith(INSTALLER);
      expect(quitMock).toHaveBeenCalledOnce();
    });

    it('does nothing when the installer path is not a usable string', async () => {
      expectAppLog('warn', 'main/updater');

      // Found by `e2e/specs/ipc-abuse.spec.ts`. These payloads came straight off the renderer and
      // reached `shell.openPath`, and `app.quit()` would have run regardless of whether the
      // installer ever started.
      for (const hostile of [10n ** 30n, 0, null, undefined, true, { path: INSTALLER }, '', '  ']) {
        openPathMock.mockClear();
        quitMock.mockClear();
        await installUpdate(hostile as unknown as string);
        expect(openPathMock, `payload ${String(hostile)} must not reach the OS`).not.toHaveBeenCalled();
        expect(quitMock, `payload ${String(hostile)} must not quit the app`).not.toHaveBeenCalled();
      }
    });

    it('does nothing when the installer path is a megabyte long', async () => {
      expectAppLog('warn', 'main/updater');

      // Long *and* a valid string, so only a length bound catches it.
      openPathMock.mockClear();
      quitMock.mockClear();
      await installUpdate('x'.repeat(1024 * 1024));
      expect(openPathMock).not.toHaveBeenCalled();
      expect(quitMock).not.toHaveBeenCalled();
    });
  });

  describe('scheduleInstallOnRestart', () => {
    it('persists a marker JSON with installer path and version', () => {
      scheduleInstallOnRestart(INSTALLER, '2.0.0');
      expect(fs.writeFileSync).toHaveBeenCalled();
      const [filePath, contents] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(filePath).toBe(nodePath.join('/tmp', 'pending-install.json'));
      const parsed = JSON.parse(contents as string);
      expect(parsed).toEqual({ installerPath: INSTALLER, version: '2.0.0' });
    });

    it('does not throw when the marker cannot be written', () => {
      expectAppLog('warn', 'main/updater');

      vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
        throw new Error('disk full');
      });
      expect(() => scheduleInstallOnRestart(INSTALLER, '2.0.0')).not.toThrow();
    });
  });

  describe('cancelRestartInstall', () => {
    it('removes the marker when present', () => {
      cancelRestartInstall();
      expect(fs.unlinkSync).toHaveBeenCalledWith(nodePath.join('/tmp', 'pending-install.json'));
    });

    it('does not remove the marker when absent', () => {
      vi.mocked(fs.existsSync).mockImplementationOnce(() => false);
      cancelRestartInstall();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('does not throw when unlink fails', () => {
      expectAppLog('warn', 'main/updater');

      vi.mocked(fs.unlinkSync).mockImplementationOnce(() => {
        throw new Error('permission denied');
      });
      expect(() => cancelRestartInstall()).not.toThrow();
    });
  });

  describe('readPendingInstall', () => {
    it('returns null when no marker exists', () => {
      vi.mocked(fs.existsSync).mockImplementationOnce(() => false);
      expect(readPendingInstall()).toBeNull();
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('returns null for an empty marker file', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('   ');
      expect(readPendingInstall()).toBeNull();
    });

    it('returns the parsed payload for a valid marker', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ installerPath: INSTALLER, version: '2.0.0' }));
      expect(readPendingInstall()).toEqual({ installerPath: INSTALLER, version: '2.0.0' });
    });

    it('returns null for corrupt JSON', () => {
      expectAppLog('warn', 'main/updater');

      vi.mocked(fs.readFileSync).mockReturnValue('not-json');
      expect(readPendingInstall()).toBeNull();
    });

    it('returns null when required fields are missing', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ installerPath: INSTALLER }));
      expect(readPendingInstall()).toBeNull();
    });
  });

  describe('autoInstallPendingUpdate', () => {
    it('does nothing when no marker exists', async () => {
      vi.mocked(fs.existsSync).mockImplementation(() => false);
      await autoInstallPendingUpdate();
      expect(openPathMock).not.toHaveBeenCalled();
      expect(quitMock).not.toHaveBeenCalled();
    });

    it('launches the installer and quits the app for a valid pending version', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ installerPath: INSTALLER, version: '2.0.0' }));
      await autoInstallPendingUpdate();
      expect(openPathMock).toHaveBeenCalledWith(INSTALLER);
      expect(quitMock).toHaveBeenCalledOnce();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('skips applying when the pending version is already installed', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ installerPath: INSTALLER, version: '1.0.0' }));
      await autoInstallPendingUpdate();
      expect(openPathMock).not.toHaveBeenCalled();
      expect(quitMock).not.toHaveBeenCalled();
    });

    it('clears the marker but skips a missing installer', async () => {
      expectAppLog('warn', 'main/updater');

      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ installerPath: INSTALLER, version: '2.0.0' }));
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => p !== INSTALLER);
      await autoInstallPendingUpdate();
      expect(fs.unlinkSync).toHaveBeenCalled();
      expect(openPathMock).not.toHaveBeenCalled();
      expect(quitMock).not.toHaveBeenCalled();
    });
  });

  describe('openReleaseNotes', () => {
    it('calls shell.openExternal', async () => {
      await openReleaseNotes('https://github.com/releases');
      expect(openExternalMock).toHaveBeenCalledWith('https://github.com/releases');
    });

    it('does nothing when the URL is not a usable string', async () => {
      expectAppLog('warn', 'main/updater');

      // Same abuse-harness origin as the `installUpdate` case above.
      for (const hostile of [10n ** 30n, 0, null, undefined, true, ['https://x.invalid'], '', '  ']) {
        openExternalMock.mockClear();
        await openReleaseNotes(hostile as unknown as string);
        expect(openExternalMock, `payload ${String(hostile)} must not reach the OS`).not.toHaveBeenCalled();
      }
    });

    it('does nothing when the URL is a megabyte long', async () => {
      expectAppLog('warn', 'main/updater');

      openExternalMock.mockClear();
      await openReleaseNotes(`https://github.com/${'x'.repeat(1024 * 1024)}`);
      expect(openExternalMock).not.toHaveBeenCalled();
    });
  });

  describe('cancelDownload', () => {
    it('does not throw when no download is active', () => {
      expect(() => cancelDownload()).not.toThrow();
    });
  });
});
