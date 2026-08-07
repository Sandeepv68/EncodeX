import { describe, it, expect } from 'vitest';
import { QUEUE_EXPORT_VERSION, buildQueueExport, parseQueueExport, validateQueueExport } from '../queue-transfer';
import type { QueueJob } from '../../../shared/types';

function makeJob(overrides: Partial<QueueJob> = {}): QueueJob {
  return {
    id: 'id-1',
    input: 'in.mp4',
    output: 'out.mp4',
    options: { videoCodec: 'libx264' },
    transcoder: 'FFMPEG',
    status: 'queued',
    progress: 0,
    createdAt: 1234567890,
    ...overrides,
  };
}

describe('buildQueueExport', () => {
  it('projects jobs down to input/output/options/transcoder', () => {
    const snapshot = buildQueueExport([makeJob(), makeJob({ id: 'id-2', input: 'b.png', output: 'c.png' })], 2);
    expect(snapshot.version).toBe(QUEUE_EXPORT_VERSION);
    expect(snapshot.concurrency).toBe(2);
    expect(snapshot.jobs).toEqual([
      { input: 'in.mp4', output: 'out.mp4', options: { videoCodec: 'libx264' }, transcoder: 'FFMPEG' },
      { input: 'b.png', output: 'c.png', options: { videoCodec: 'libx264' }, transcoder: 'FFMPEG' },
    ]);
  });

  it('drops runtime fields such as id, status, progress and createdAt', () => {
    const snapshot = buildQueueExport([makeJob()], 1);
    const job = snapshot.jobs[0];
    expect(job).not.toHaveProperty('id');
    expect(job).not.toHaveProperty('status');
    expect(job).not.toHaveProperty('progress');
    expect(job).not.toHaveProperty('createdAt');
  });

  it('produces an empty job list for an empty queue', () => {
    expect(buildQueueExport([], 1)).toEqual({ version: QUEUE_EXPORT_VERSION, concurrency: 1, jobs: [] });
  });
});

describe('parseQueueExport', () => {
  it('parses a valid JSON export', () => {
    const snapshot = parseQueueExport(
      JSON.stringify({
        version: QUEUE_EXPORT_VERSION,
        concurrency: 3,
        jobs: [{ input: 'in.mp4', output: 'out.mp4', options: {}, transcoder: 'FFMPEG' }],
      }),
    );
    expect(snapshot).not.toBeNull();
    expect(snapshot?.concurrency).toBe(3);
  });

  it('returns null for malformed JSON', () => {
    expect(parseQueueExport('not json')).toBeNull();
    expect(parseQueueExport('')).toBeNull();
  });

  it('returns null for non-object values', () => {
    expect(parseQueueExport('42')).toBeNull();
    expect(parseQueueExport('null')).toBeNull();
    expect(parseQueueExport('"hello"')).toBeNull();
  });

  it('returns null when the version does not match', () => {
    expect(parseQueueExport(JSON.stringify({ version: QUEUE_EXPORT_VERSION + 1, concurrency: 1, jobs: [] }))).toBeNull();
  });

  it('returns null when concurrency is missing or not a number', () => {
    expect(parseQueueExport(JSON.stringify({ version: QUEUE_EXPORT_VERSION, jobs: [] }))).toBeNull();
    expect(parseQueueExport(JSON.stringify({ version: QUEUE_EXPORT_VERSION, concurrency: '2', jobs: [] }))).toBeNull();
  });

  it('returns null when jobs is missing or not an array', () => {
    expect(parseQueueExport(JSON.stringify({ version: QUEUE_EXPORT_VERSION, concurrency: 1 }))).toBeNull();
    expect(parseQueueExport(JSON.stringify({ version: QUEUE_EXPORT_VERSION, concurrency: 1, jobs: {} }))).toBeNull();
  });

  it('returns null when a job is missing a required string field', () => {
    const base = { version: QUEUE_EXPORT_VERSION, concurrency: 1, jobs: [] };
    expect(parseQueueExport(JSON.stringify({ ...base, jobs: [{}] }))).toBeNull();
    expect(parseQueueExport(JSON.stringify({ ...base, jobs: [{ output: 'o', options: {}, transcoder: 'FFMPEG' }] }))).toBeNull();
    expect(parseQueueExport(JSON.stringify({ ...base, jobs: [{ input: 'i', options: {}, transcoder: 'FFMPEG' }] }))).toBeNull();
    expect(parseQueueExport(JSON.stringify({ ...base, jobs: [{ input: 'i', output: 'o', transcoder: 'FFMPEG' }] }))).toBeNull();
    expect(parseQueueExport(JSON.stringify({ ...base, jobs: [{ input: 'i', output: 'o', options: {} }] }))).toBeNull();
    expect(parseQueueExport(JSON.stringify({ ...base, jobs: [{ input: 'i', output: 5, options: {}, transcoder: 'FFMPEG' }] }))).toBeNull();
  });

  it('returns null when a job carries no options object', () => {
    expect(
      parseQueueExport(
        JSON.stringify({
          version: QUEUE_EXPORT_VERSION,
          concurrency: 1,
          jobs: [{ input: 'i', output: 'o', options: null, transcoder: 'FFMPEG' }],
        }),
      ),
    ).toBeNull();
  });
});

describe('validateQueueExport', () => {
  it('accepts a structurally valid export', () => {
    const value = {
      version: QUEUE_EXPORT_VERSION,
      concurrency: 1,
      jobs: [{ input: 'i', output: 'o', options: {}, transcoder: 'FFMPEG' }],
    };
    expect(validateQueueExport(value)).not.toBeNull();
  });

  it('rejects null and primitives', () => {
    expect(validateQueueExport(null)).toBeNull();
    expect(validateQueueExport(undefined)).toBeNull();
    expect(validateQueueExport('x')).toBeNull();
    expect(validateQueueExport([])).toBeNull();
  });
});
