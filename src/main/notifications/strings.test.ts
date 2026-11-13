import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getLocaleMock, getAppPathMock, existsSyncMock, readFileSyncMock } = vi.hoisted(() => ({
  getLocaleMock: vi.fn(() => 'en-US'),
  getAppPathMock: vi.fn(() => 'C:/app'),
  existsSyncMock: vi.fn((_p: string) => false),
  readFileSyncMock: vi.fn((_p: string) => '{}'),
}));

vi.mock('electron', () => ({
  app: { getLocale: getLocaleMock, getAppPath: getAppPathMock },
}));

vi.mock('fs', () => ({
  default: { existsSync: existsSyncMock, readFileSync: readFileSyncMock },
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock,
}));

/**
 * Makes only the given locale files exist, with the given contents.
 *
 * @param maps - The locale file contents, keyed by the file name.
 * @returns {void}
 */
function setLocaleFiles(maps: Record<string, unknown>): void {
  existsSyncMock.mockImplementation((p: string) => {
    const name = String(p).split(/[\\/]/).pop() ?? '';
    return Object.prototype.hasOwnProperty.call(maps, name);
  });
  readFileSyncMock.mockImplementation((p: string) => {
    const name = String(p).split(/[\\/]/).pop() ?? '';
    return JSON.stringify(maps[name] ?? {});
  });
}

describe('tNotification', () => {
  beforeEach(() => {
    vi.resetModules();
    getLocaleMock.mockReset();
    getLocaleMock.mockReturnValue('en-US');
    getAppPathMock.mockReset();
    getAppPathMock.mockReturnValue('C:/app');
    existsSyncMock.mockReset();
    existsSyncMock.mockReturnValue(false);
    readFileSyncMock.mockReset();
    readFileSyncMock.mockReturnValue('{}');
  });

  it('reads the string from the current locale file', async () => {
    setLocaleFiles({ 'de-DE.json': { notifications: { jobCompletedTitle: 'Fertig' } } });
    getLocaleMock.mockReturnValue('de-DE');
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedTitle')).toBe('Fertig');
  });

  it('falls back to the default language file when the locale has no such key', async () => {
    setLocaleFiles({
      'de-DE.json': { notifications: { somethingElse: 'x' } },
      'en-US.json': { notifications: { jobCompletedTitle: 'Conversion complete' } },
    });
    getLocaleMock.mockReturnValue('de-DE');
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedTitle')).toBe('Conversion complete');
  });

  it('uses the built-in fallback when no locale file has the key', async () => {
    setLocaleFiles({ 'en-US.json': {} });
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedTitle')).toBe('Conversion complete');
  });

  it('interpolates the variables into the body', async () => {
    setLocaleFiles({ 'en-US.json': { notifications: { jobCompletedBody: '{{fileName}} finished successfully.' } } });
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedBody', { fileName: 'clip.mp4' })).toBe('clip.mp4 finished successfully.');
  });

  it('replaces a missing variable with an empty string', async () => {
    setLocaleFiles({ 'en-US.json': { notifications: { jobCompletedBody: '{{fileName}} finished successfully.' } } });
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedBody', {})).toBe(' finished successfully.');
  });

  it('leaves the placeholders alone when no variables are given', async () => {
    setLocaleFiles({ 'en-US.json': { notifications: { jobCompletedBody: '{{fileName}} finished successfully.' } } });
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedBody')).toBe('{{fileName}} finished successfully.');
  });

  it('uses the default language when the locale lookup throws', async () => {
    setLocaleFiles({ 'en-US.json': { notifications: { jobCompletedTitle: 'Conversion complete' } } });
    getLocaleMock.mockImplementation(() => {
      throw new Error('no locale');
    });
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedTitle')).toBe('Conversion complete');
  });

  it('uses the default language when the locale is empty', async () => {
    setLocaleFiles({ 'en-US.json': { notifications: { jobCompletedTitle: 'Conversion complete' } } });
    getLocaleMock.mockReturnValue('');
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedTitle')).toBe('Conversion complete');
  });

  it('returns the key itself when the key is unknown', async () => {
    setLocaleFiles({ 'en-US.json': {} });
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.notARealKey')).toBe('notifications.notARealKey');
  });

  it('skips a locale entry that is not a string', async () => {
    setLocaleFiles({
      'de-DE.json': { notifications: { jobCompletedTitle: 42 } },
      'en-US.json': { notifications: { jobCompletedTitle: 'Conversion complete' } },
    });
    getLocaleMock.mockReturnValue('de-DE');
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedTitle')).toBe('Conversion complete');
  });

  it('keeps the built-in fallback when the locale file cannot be read', async () => {
    setLocaleFiles({ 'en-US.json': { notifications: { jobCompletedTitle: 'Conversion complete' } } });
    readFileSyncMock.mockImplementation(() => {
      throw new Error('unreadable');
    });
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedTitle')).toBe('Conversion complete');
  });

  it('keeps the built-in fallback when the file lookup throws', async () => {
    existsSyncMock.mockImplementation(() => {
      throw new Error('no filesystem');
    });
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedTitle')).toBe('Conversion complete');
  });

  it('reuses the loaded map for the same locale', async () => {
    setLocaleFiles({ 'en-US.json': { notifications: { jobCompletedTitle: 'Conversion complete' } } });
    const { tNotification } = await import('./strings');
    expect(tNotification('notifications.jobCompletedTitle')).toBe('Conversion complete');
    const readsAfterFirst = readFileSyncMock.mock.calls.length;
    expect(tNotification('notifications.jobCompletedTitle')).toBe('Conversion complete');
    expect(readFileSyncMock.mock.calls.length).toBe(readsAfterFirst);
  });
});
