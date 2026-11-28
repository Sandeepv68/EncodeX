import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { HISTORY_LIMITS, HISTORY_STORE } from '../../../shared/history/limits';
import type { HistoryEntry } from '../../../shared/history/types';
import { HistoryStore } from '../store';

const fsMockState = vi.hoisted(() => ({
  rmSyncMock: vi.fn(),
  renameSyncMock: vi.fn(),
  openSyncMock: vi.fn(),
  nativeRmSync: undefined as unknown as typeof import('fs').rmSync,
  nativeRenameSync: undefined as unknown as typeof import('fs').renameSync,
  nativeOpenSync: undefined as unknown as typeof import('fs').openSync,
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  fsMockState.nativeRmSync = actual.rmSync;
  fsMockState.nativeRenameSync = actual.renameSync;
  fsMockState.nativeOpenSync = actual.openSync;
  fsMockState.rmSyncMock.mockImplementation(actual.rmSync);
  fsMockState.renameSyncMock.mockImplementation(actual.renameSync);
  fsMockState.openSyncMock.mockImplementation(actual.openSync);
  return { ...actual, rmSync: fsMockState.rmSyncMock, renameSync: fsMockState.renameSyncMock, openSync: fsMockState.openSyncMock };
});

function restoreFsMocks(): void {
  vi.mocked(rmSync).mockImplementation(fsMockState.nativeRmSync);
  vi.mocked(renameSync).mockImplementation(fsMockState.nativeRenameSync);
  vi.mocked(openSync).mockImplementation(fsMockState.nativeOpenSync);
}

function makeEntry(id: string, finishedAt: number): HistoryEntry {
  return {
    id,
    family: 'convert',
    source: 'gui',
    status: 'succeeded',
    startedAt: finishedAt - 10,
    finishedAt,
    durationMs: 10,
    inputs: [`/input/${id}.mp4`],
    outputs: [`/output/${id}.mp4`],
    metadata: {},
    thumbnail: null,
  };
}

describe('HistoryStore', () => {
  let userDataDir: string;
  let filePath: string;
  let backupPath: string;

  beforeEach(() => {
    restoreFsMocks();
    userDataDir = mkdtempSync(join(tmpdir(), 'encodex-history-store-'));
    filePath = join(userDataDir, HISTORY_STORE.directory, HISTORY_STORE.filename);
    backupPath = `${filePath}${HISTORY_STORE.backupSuffix}`;
  });

  afterEach(() => {
    restoreFsMocks();
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('persists, replaces, removes, and clears entries', () => {
    const store = new HistoryStore(userDataDir);
    expect(store.list()).toEqual([]);

    const first = makeEntry('a', 1000);
    store.add(first);
    expect(existsSync(filePath)).toBe(true);
    expect(store.list()).toEqual([first]);

    const replacement = {
      ...first,
      status: 'failed' as const,
      error: { message: 'failed' },
      startedAt: 1000,
      finishedAt: 2000,
      durationMs: 1000,
    };
    store.add(replacement);
    expect(store.list()).toEqual([replacement]);

    const second = makeEntry('b', 3000);
    store.add(second);
    expect(store.list().map((entry) => entry.id)).toEqual(['b', 'a']);

    expect(store.remove('a')).toBe(true);
    expect(store.remove('a')).toBe(false);
    expect(store.list().map((entry) => entry.id)).toEqual(['b']);

    store.clear();
    expect(store.list()).toEqual([]);
    expect(existsSync(backupPath)).toBe(false);
  });

  it('recovers the previous snapshot when the primary file is corrupt', () => {
    const store = new HistoryStore(userDataDir);
    store.add(makeEntry('a', 1000));
    store.add(makeEntry('b', 2000));

    writeFileSync(filePath, '{ not json', 'utf8');
    expectAppLog('warn', 'main/history/store');
    const recovered = new HistoryStore(userDataDir).list();
    expect(recovered.map((entry) => entry.id)).toEqual(['a']);
    expect(JSON.parse(readFileSync(filePath, 'utf8')).entries[0].id).toBe('a');
  });

  it('stores and reads bounded thumbnails by entry id', () => {
    const store = new HistoryStore(userDataDir);
    const thumbnail = store.saveThumbnail('thumb', Buffer.from('image-bytes'), 'image/png');
    const entry = { ...makeEntry('thumb', 1000), thumbnail };
    store.add(entry);

    expect(store.getThumbnail('thumb')).toBe(`data:image/png;base64,${Buffer.from('image-bytes').toString('base64')}`);
    expect(store.getThumbnail('missing')).toBeNull();

    expect(() => store.saveThumbnail('too-large', Buffer.alloc(HISTORY_LIMITS.maxThumbnailBytes + 1), 'image/png')).toThrow();
  });

  it('trims entries to the configured cap', () => {
    const store = new HistoryStore(userDataDir);
    for (let index = 0; index < HISTORY_LIMITS.maxEntries + 10; index += 1) {
      store.add(makeEntry(`entry-${index}`, index));
    }
    expect(store.list()).toHaveLength(HISTORY_LIMITS.maxEntries);
    expect(store.list()[0].id).toBe(`entry-${HISTORY_LIMITS.maxEntries + 9}`);
  });

  it('warns when the backup removal during clear fails', () => {
    expectAppLog('warn', 'main/history/store');
    const store = new HistoryStore(userDataDir);
    store.add(makeEntry('a', 1000));
    let backupRemovals = 0;
    vi.mocked(rmSync).mockImplementation((path, options) => {
      if (path === backupPath && ++backupRemovals === 2) throw new Error('denied');
      return fsMockState.nativeRmSync(path, options);
    });

    store.clear();
    expect(store.list()).toEqual([]);
  });

  it('generates safe, uncolliding thumbnail paths for jpeg and png data', () => {
    const store = new HistoryStore(userDataDir);
    expect(store.saveThumbnail('!!!', Buffer.from('a'), 'image/png').path).toBe('entry.png');
    expect(store.saveThumbnail('thumb', Buffer.from('a'), 'image/png').path).toBe('thumb.png');
    expect(store.saveThumbnail('thumb', Buffer.from('b'), 'image/png').path).toBe('thumb-1.png');
    expect(store.saveThumbnail('photo', Buffer.from('c'), 'image/jpeg').path).toBe('photo.jpg');
  });

  it('rejects zero-length thumbnails and escaped thumbnail paths', () => {
    const store = new HistoryStore(userDataDir);
    const internals = store as unknown as { resolveThumbnail: (name: string) => string | null };

    expect(() => store.saveThumbnail('empty', Buffer.alloc(0), 'image/png')).toThrow();
    expect(internals.resolveThumbnail('../escape.png')).toBeNull();
    expect(internals.resolveThumbnail('safe.png')).toContain('safe.png');
  });

  it('rejects oversized history files and warns about the corrupt file', () => {
    expectAppLog('warn', 'main/history/store');
    const store = new HistoryStore(userDataDir);
    mkdirSync(join(userDataDir, HISTORY_STORE.directory), { recursive: true });
    writeFileSync(filePath, Buffer.alloc(HISTORY_LIMITS.maxFileBytes + 1));

    expect(store.list()).toEqual([]);
  });

  it('warns when restoring a recoverable backup fails', () => {
    expectAppLog('warn', 'main/history/store');
    expectAppLog('warn', 'main/history/store');
    const store = new HistoryStore(userDataDir);
    store.add(makeEntry('a', 1000));
    store.add(makeEntry('b', 2000));
    writeFileSync(filePath, '{ not json', 'utf8');

    vi.mocked(renameSync).mockImplementation(() => {
      throw new Error('rename denied');
    });

    expect(new HistoryStore(userDataDir).list().map((entry) => entry.id)).toEqual(['a']);
  });

  it('warns for non-ENOENT thumbnail read failures', () => {
    expectAppLog('warn', 'main/history/store');
    const store = new HistoryStore(userDataDir);
    const entry = { ...makeEntry('access', 1000), thumbnail: { path: 'access.png', mimeType: 'image/png' as const } };
    store.add(entry);

    vi.mocked(openSync).mockImplementation((path, flags, mode) => {
      if (typeof path === 'string' && path.endsWith('access.png')) {
        throw Object.assign(new Error('denied'), { code: 'EACCES' });
      }
      return fsMockState.nativeOpenSync(path, flags, mode);
    });

    expect(store.getThumbnail('access')).toBeNull();
  });

  it('ignores thumbnail entries that are not regular bounded files', () => {
    expectAppLog('warn', 'main/history/store');
    const store = new HistoryStore(userDataDir);
    const entry = { ...makeEntry('dir', 1000), thumbnail: { path: 'dir.png', mimeType: 'image/png' as const } };
    store.add(entry);
    mkdirSync(join(userDataDir, HISTORY_STORE.directory, HISTORY_STORE.thumbnailsDirectory, 'dir.png'), { recursive: true });

    expect(store.getThumbnail('dir')).toBeNull();
  });

  it('truncates oversized snapshots before writing them', () => {
    const store = new HistoryStore(userDataDir);
    const internals = store as unknown as { writeStore: (data: { version: number; entries: HistoryEntry[] }) => void };
    const blob = 'x'.repeat(Math.floor(HISTORY_LIMITS.maxJsonChars / 4));
    const entries = Array.from({ length: 4 }, (_, index) => makeEntry(`huge-${index}`, 1000 + index)).map((entry) => ({
      ...entry,
      metadata: { blob },
    }));

    internals.writeStore({ version: 1, entries });
    const written = JSON.parse(readFileSync(filePath, 'utf8')) as { entries: HistoryEntry[] };
    expect(written.entries.length).toBeLessThan(entries.length);
  });

  it('warns when thumbnail cleanup cannot remove a file', () => {
    expectAppLog('warn', 'main/history/store');
    const store = new HistoryStore(userDataDir);
    const internals = store as unknown as {
      resolveThumbnail: (name: string) => string | null;
      cleanupThumbnails: (entries: HistoryEntry[]) => void;
    };
    const entry = { ...makeEntry('gone', 1000), thumbnail: { path: 'gone.png', mimeType: 'image/png' as const } };
    const resolved = internals.resolveThumbnail('gone.png')!;
    vi.mocked(rmSync).mockImplementation((path, options) => {
      if (path === resolved) throw new Error('denied');
      return fsMockState.nativeRmSync(path, options);
    });

    internals.cleanupThumbnails([entry]);
  });
});
