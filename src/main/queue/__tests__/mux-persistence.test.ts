/**
 * @fileoverview Temp-directory tests for the mux queue snapshot adapter.
 *
 * The mux snapshot lives beside the batch snapshot but uses its own file,
 * version, and job guard. These tests pin the tolerant-read contract: missing,
 * corrupt, version-mismatched, and partially invalid files all yield null so a
 * hostile userData directory cannot construct a malformed queue.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MUX_QUEUE_STATE_FILENAME, MUX_QUEUE_STATE_VERSION } from '../../../shared/constants';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { MuxQueueJob, MuxQueueSnapshot } from '../../../shared/types';

const { FileMuxQueuePersistence } = await import('../persistence');

function aJob(overrides: Partial<MuxQueueJob> = {}): MuxQueueJob {
  return {
    id: 'mux-1',
    kind: 'remux',
    input: 'C:/in/a.mp4',
    output: 'C:/out/a.mkv',
    targets: [{ output: 'C:/out/a.mkv', options: { copy: true, map: ['0'] } }],
    transcoder: 'FFMPEG',
    status: QUEUE_STATUS.QUEUED,
    progress: 0,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function aSnapshot(overrides: Partial<MuxQueueSnapshot> = {}): MuxQueueSnapshot {
  return {
    version: MUX_QUEUE_STATE_VERSION,
    concurrency: 1,
    jobs: [aJob()],
    ...overrides,
  };
}

describe('FileMuxQueuePersistence', () => {
  let dir: string;
  let persistence: InstanceType<typeof FileMuxQueuePersistence>;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mux-queue-'));
    persistence = new FileMuxQueuePersistence(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when no snapshot exists', () => {
    expect(persistence.load()).toBeNull();
  });

  it('round-trips a valid snapshot through mux-queue-state.json', () => {
    const snapshot = aSnapshot();
    persistence.save(snapshot);
    expect(fs.existsSync(path.join(dir, MUX_QUEUE_STATE_FILENAME))).toBe(true);
    expect(persistence.load()).toEqual(snapshot);
  });

  it('creates the parent directory when it is missing', () => {
    const nested = path.join(dir, 'a', 'b');
    const target = new FileMuxQueuePersistence(nested);
    target.save(aSnapshot({ jobs: [] }));
    expect(fs.existsSync(path.join(nested, MUX_QUEUE_STATE_FILENAME))).toBe(true);
  });

  it('clears the snapshot and tolerates a missing file', () => {
    persistence.save(aSnapshot());
    persistence.clear();
    expect(persistence.load()).toBeNull();
    expect(() => persistence.clear()).not.toThrow();
  });

  it.each([
    ['truncated JSON', '{"version":1,"concurrency":1,"jobs":['],
    ['an empty file', ''],
    ['a bare array', '[]'],
    ['null', 'null'],
    ['jobs that is not an array', `{"version":${MUX_QUEUE_STATE_VERSION},"concurrency":1,"jobs":"x"}`],
  ])('returns null for %s', (_label, contents) => {
    fs.writeFileSync(path.join(dir, MUX_QUEUE_STATE_FILENAME), contents, 'utf8');
    expect(persistence.load()).toBeNull();
  });

  it('rejects a version mismatch', () => {
    fs.writeFileSync(path.join(dir, MUX_QUEUE_STATE_FILENAME), JSON.stringify(aSnapshot({ version: MUX_QUEUE_STATE_VERSION + 1 })), 'utf8');
    expect(persistence.load()).toBeNull();
  });

  it('rejects a snapshot containing one malformed job', () => {
    const raw = {
      ...aSnapshot(),
      jobs: [aJob(), { id: 'half' }],
    };
    fs.writeFileSync(path.join(dir, MUX_QUEUE_STATE_FILENAME), JSON.stringify(raw), 'utf8');
    expect(persistence.load()).toBeNull();
  });

  it('rejects a job with duplicate target outputs', () => {
    const raw = aSnapshot({
      jobs: [
        aJob({
          targets: [
            { output: 'C:/out/a.mkv', options: {} },
            { output: 'c:/out/A.MKV', options: {} },
          ],
        }),
      ],
    });
    fs.writeFileSync(path.join(dir, MUX_QUEUE_STATE_FILENAME), JSON.stringify(raw), 'utf8');
    expect(persistence.load()).toBeNull();
  });
});
