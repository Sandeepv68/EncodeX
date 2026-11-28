import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { HISTORY_LIMITS, HISTORY_STORE } from '../../../shared/history/limits';
import type { HistoryEntry } from '../../../shared/history/types';
import { HistoryStore } from '../store';

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
    userDataDir = mkdtempSync(join(tmpdir(), 'encodex-history-store-'));
    filePath = join(userDataDir, HISTORY_STORE.directory, HISTORY_STORE.filename);
    backupPath = `${filePath}${HISTORY_STORE.backupSuffix}`;
  });

  afterEach(() => {
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
});
