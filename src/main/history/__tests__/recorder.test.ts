import { describe, expect, it, vi } from 'vitest';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import type { HistoryEntry, HistoryMimeType, HistoryThumbnail, HistoryThumbnailData } from '../../../shared/history/types';
import { HistoryRecorder } from '../recorder';

function fakeStore() {
  const entries: HistoryEntry[] = [];
  const thumbnails = new Map<string, HistoryThumbnail & { bytes: number }>();
  return {
    entries,
    thumbnails,
    add(entry: HistoryEntry) {
      entries.push(entry);
      return entry;
    },
    saveThumbnail(id: string, data: Uint8Array, mimeType: HistoryMimeType): HistoryThumbnail {
      thumbnails.set(id, { path: `${id}.png`, mimeType, bytes: data.byteLength });
      return { path: `${id}.png`, mimeType };
    },
  };
}

describe('HistoryRecorder', () => {
  it('normalizes an operation, saves a thumbnail, and notifies listeners', async () => {
    const store = fakeStore();
    const onEntry = vi.fn();
    const recorder = new HistoryRecorder({
      store,
      onEntry,
      generateThumbnail: async () => ({ data: Buffer.from('png'), mimeType: 'image/png' }) satisfies HistoryThumbnailData,
    });

    const entry = await recorder.record({
      family: 'convert',
      source: 'gui',
      status: 'succeeded',
      startedAt: 1000,
      finishedAt: 1750,
      inputs: ['/input.mp4'],
      outputs: ['/output.mp4'],
      transcoder: 'FFMPEG',
      metadata: { codec: 'libx264' },
      thumbnailSource: '/input.mp4',
    });

    expect(entry.durationMs).toBe(750);
    expect(entry.thumbnail).toEqual({ path: `${entry.id}.png`, mimeType: 'image/png' });
    expect(store.entries).toEqual([entry]);
    expect(store.thumbnails.get(entry.id)?.bytes).toBe(3);
    expect(onEntry).toHaveBeenCalledWith(entry);
  });

  it('records the operation when thumbnail generation fails', async () => {
    expectAppLog('warn', 'main/history/recorder');
    const store = fakeStore();
    const recorder = new HistoryRecorder({
      store,
      generateThumbnail: async () => {
        throw new Error('decoder unavailable');
      },
    });

    const entry = await recorder.record({
      family: 'batch',
      source: 'gui',
      status: 'failed',
      startedAt: 100,
      finishedAt: 300,
      inputs: ['/input.mp4'],
      error: { code: 'FFMPEG_FAILED', message: 'encoder exited' },
    });

    expect(entry.status).toBe('failed');
    expect(entry.thumbnail).toBeNull();
    expect(store.entries).toEqual([entry]);
  });

  it('does not propagate persistence failures to callers', async () => {
    expectAppLog('warn', 'main/history/recorder');
    const onEntry = vi.fn();
    const recorder = new HistoryRecorder({
      store: {
        add() {
          throw new Error('disk full');
        },
      },
      onEntry,
    });

    const entry = await recorder.record({ family: 'automation', source: 'automation', status: 'succeeded', startedAt: 0 });
    expect(entry.family).toBe('automation');
    expect(onEntry).toHaveBeenCalledWith(entry);
  });
});
