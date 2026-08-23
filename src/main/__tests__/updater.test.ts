import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '0.0.0') },
  shell: { openPath: vi.fn(), openExternal: vi.fn() },
  BrowserWindow: class {},
}));

import { compareVersions, selectAsset } from '../updater';
import type { UpdateAsset } from '../../../shared/types';

const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_ARCH = process.arch;

describe('updater', () => {
  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
    Object.defineProperty(process, 'arch', { value: ORIGINAL_ARCH });
    vi.restoreAllMocks();
  });

  describe('compareVersions', () => {
    it('detects a beta-to-beta bump that the old suffix-stripping logic missed', () => {
      expect(compareVersions('1.0.0-beta.1', '1.0.0-beta.0')).toBe(1);
      expect(compareVersions('1.0.0-beta.0', '1.0.0-beta.1')).toBe(-1);
      expect(compareVersions('1.0.0-beta.1', '1.0.0-beta.1')).toBe(0);
    });

    it('ranks stable above pre-release of the same core version', () => {
      expect(compareVersions('1.0.0', '1.0.0-beta.9')).toBe(1);
      expect(compareVersions('1.0.0-rc.1', '1.0.0')).toBe(-1);
    });

    it('compares numeric core fields numerically', () => {
      expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
      expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    });

    it('compares numeric pre-release identifiers numerically, not lexically', () => {
      expect(compareVersions('1.0.0-beta.10', '1.0.0-beta.9')).toBe(1);
      expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1);
    });

    it('orders identifiers: shorter set loses when prefix is equal', () => {
      expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
      expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha')).toBe(1);
    });

    it('treats equal versions with identical pre-releases as equal, tolerating a v prefix', () => {
      expect(compareVersions('v1.2.3-beta.4', '1.2.3-beta.4')).toBe(0);
      expect(compareVersions('V1.2.3-beta.4', 'v1.2.3-beta.4')).toBe(0);
    });
  });

  describe('selectAsset', () => {
    const assets = (names: string[]): UpdateAsset[] => names.map((name) => ({ name, url: `https://example.com/${name}`, size: 1024 }));

    it('prefers the arch-matching setup executable on win32', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });
      const asset = selectAsset(
        assets(['EncodeX-1.0.0-x64-setup.exe', 'EncodeX-1.0.0-x64-setup.exe.blockmap', 'EncodeX-1.0.0-arm64-setup.exe']),
      );
      expect(asset?.name).toBe('EncodeX-1.0.0-x64-setup.exe');
    });

    it('falls back to the first platform asset when no arch matches', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });
      const asset = selectAsset(assets(['EncodeX-1.0.0-setup.exe']));
      expect(asset?.name).toBe('EncodeX-1.0.0-setup.exe');
    });

    it('returns null when no platform asset exists', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });
      expect(selectAsset(assets(['EncodeX-1.0.0-x86_64.AppImage', 'notes.txt']))).toBeNull();
    });

    it('selects the arch-matching dmg on darwin and the AppImage on linux', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      Object.defineProperty(process, 'arch', { value: 'arm64' });
      expect(selectAsset(assets(['EncodeX-1.0.0-x64.dmg', 'EncodeX-1.0.0-arm64.dmg']))?.name).toBe('EncodeX-1.0.0-arm64.dmg');

      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(selectAsset(assets(['EncodeX-1.0.0-x86_64.AppImage', 'EncodeX-1.0.0-setup.exe']))?.name).toBe('EncodeX-1.0.0-x86_64.AppImage');
    });

    it('never matches blockmap files', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'arm64' });
      const asset = selectAsset(assets(['EncodeX-1.0.0-arm64-setup.exe.blockmap']));
      expect(asset).toBeNull();
    });
  });
});
