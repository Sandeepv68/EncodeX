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
  createWriteStream: vi.fn(() => {
    const stream = new EventEmitter();
    (stream as unknown as { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }).write = vi.fn();
    (stream as unknown as { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }).end = vi.fn((cb?: () => void) => cb?.());
    (stream as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy = vi.fn();
    return stream;
  }),
}));

import { compareVersions, selectAsset, checkForUpdate, installUpdate, openReleaseNotes, cancelDownload } from '../updater';
import type { UpdateAsset } from '../../../shared/types';

const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_ARCH = process.arch;

describe('updater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(selectAsset(assets(['EncodeX-1.0.0-x64-setup.exe', 'EncodeX-1.0.0-arm64-setup.exe']))?.name).toBe('EncodeX-1.0.0-x64-setup.exe');
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
    function mockHttpsGet(handler: (res: EventEmitter & { statusCode: number; headers: Record<string, string> }) => void, initialStatus = 200) {
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
      const data = JSON.stringify({ tag_name: 'v1.0.0', body: '', html_url: 'https://', assets: [{ name: 'app.exe', browser_download_url: 'https://', size: 100 }] });
      mockHttpsGet((res) => {
        res.emit('data', Buffer.from(data));
        res.emit('end');
      });
      const result = await checkForUpdate();
      expect(result).toBeNull();
    });

    it('returns null when no matching asset exists', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });
      const data = JSON.stringify({ tag_name: 'v2.0.0', body: 'New', html_url: 'https://', assets: [{ name: 'app.dmg', browser_download_url: 'https://', size: 100 }] });
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
      const data = JSON.stringify({
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
      const data = JSON.stringify({
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

  describe('installUpdate', () => {
    it('calls shell.openPath and app.quit', async () => {
      await installUpdate('/tmp/app.exe');
      expect(openPathMock).toHaveBeenCalledWith('/tmp/app.exe');
      expect(quitMock).toHaveBeenCalledOnce();
    });
  });

  describe('openReleaseNotes', () => {
    it('calls shell.openExternal', async () => {
      await openReleaseNotes('https://github.com/releases');
      expect(openExternalMock).toHaveBeenCalledWith('https://github.com/releases');
    });
  });

  describe('cancelDownload', () => {
    it('does not throw when no download is active', () => {
      expect(() => cancelDownload()).not.toThrow();
    });
  });
});
