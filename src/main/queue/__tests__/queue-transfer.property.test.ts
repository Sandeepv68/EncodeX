/**
 * @fileoverview Property-based tests for the queue export/import contract (Phase 1).
 *
 * An imported queue file is attacker-controlled input: it arrives from disk, and
 * the fields it feeds (`input`, `output`) end up as ffmpeg argv entries. The
 * properties below are the ones that keep a hostile file from becoming a
 * prototype-pollution vector, an unbounded allocation, or an exception in the
 * middle of the import handler.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  buildQueueExport,
  parseQueueExport,
  validateQueueExport,
  QUEUE_EXPORT_VERSION,
  type QueueExport,
  type QueueExportJob,
} from '../queue-transfer';

const validJob: QueueExportJob = {
  input: 'C:\\videos\\a.mp4',
  output: 'C:\\videos\\a.mkv',
  options: { videoCodec: 'libx264' },
  transcoder: 'FFMPEG',
};

const validExport: QueueExport = {
  version: QUEUE_EXPORT_VERSION,
  concurrency: 2,
  jobs: [validJob],
};

describe('validateQueueExport', () => {
  it('never throws for any JSON-representable value', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        let result: unknown;
        expect(() => {
          result = validateQueueExport(value);
        }).not.toThrow();
        expect(result === null || typeof result === 'object').toBe(true);
      }),
      { seed: 12345 },
    );
  });

  it('never throws for any string of JSON text', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        expect(() => parseQueueExport(raw)).not.toThrow();
      }),
      { seed: 12345 },
    );
  });

  it('returns null for a non-object', () => {
    for (const value of [null, undefined, 42, 'string', true, Symbol('s')]) {
      expect(validateQueueExport(value)).toBeNull();
    }
  });

  it('rejects a wrong version', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }).filter((v) => v !== QUEUE_EXPORT_VERSION),
        (version) => {
          expect(validateQueueExport({ ...validExport, version })).toBeNull();
        },
      ),
      { seed: 12345 },
    );
  });

  it('rejects a non-numeric concurrency', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.boolean(), fc.constant(null), fc.constant(undefined)), (concurrency) => {
        expect(validateQueueExport({ ...validExport, concurrency })).toBeNull();
      }),
      { seed: 12345 },
    );
  });

  it('rejects a non-array jobs', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.dictionary(fc.string(), fc.string())), (jobs) => {
        expect(validateQueueExport({ ...validExport, jobs })).toBeNull();
      }),
      { seed: 12345 },
    );
  });

  it('rejects any job missing a required string field', () => {
    for (const field of ['input', 'output', 'transcoder'] as const) {
      const broken: Record<string, unknown> = { ...validJob };
      delete broken[field];
      expect(validateQueueExport({ ...validExport, jobs: [broken] })).toBeNull();
    }
  });

  it('rejects a job whose options are missing or non-object', () => {
    expect(validateQueueExport({ ...validExport, jobs: [{ ...validJob, options: null }] })).toBeNull();
    expect(validateQueueExport({ ...validExport, jobs: [{ ...validJob, options: 'nope' }] })).toBeNull();
    expect(validateQueueExport({ ...validExport, jobs: [{ ...validJob, options: 7 }] })).toBeNull();
  });

  it('rejects an array containing a non-object entry', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)), (entry) => {
        expect(validateQueueExport({ ...validExport, jobs: [entry] })).toBeNull();
      }),
      { seed: 12345 },
    );
  });
});

describe('validateQueueExport prototype pollution', () => {
  it('never lets an imported key reach Object.prototype', () => {
    fc.assert(
      fc.property(fc.constantFrom('__proto__', 'constructor', 'prototype'), (key) => {
        const hostile = JSON.parse(
          `{"version":${QUEUE_EXPORT_VERSION},"concurrency":1,"jobs":[{"input":"a","output":"b","options":{},"transcoder":"ffmpeg","${key}":{"polluted":"yes"}}]}`,
        );
        // Whatever the verdict, the global prototype must be untouched.
        validateQueueExport(hostile);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Object.prototype).not.toHaveProperty('polluted');
      }),
      { seed: 12345 },
    );
  });

  it('rejects an export whose only job is a bare __proto__ key', () => {
    const hostile = JSON.parse('{"version":1,"concurrency":1,"jobs":[{"__proto__":{"polluted":true}}]}');
    expect(validateQueueExport(hostile)).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('keeps a literal "__proto__" string key as data, not as a prototype write', () => {
    const withLiteralKey = JSON.parse(
      '{"version":1,"concurrency":1,"jobs":[{"input":"a","output":"b","options":{},"transcoder":"ffmpeg","__proto__":"literal"}]}',
    );
    const result = validateQueueExport(withLiteralKey);
    expect(result).not.toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('validateQueueExport job-count cap', () => {
  it('rejects an absurd job count rather than allocating for it', () => {
    const huge = { ...validExport, jobs: Array.from({ length: 200_000 }, () => validJob) };
    expect(validateQueueExport(huge)).toBeNull();
  });

  it('accepts a normal batch', () => {
    const batch = { ...validExport, jobs: Array.from({ length: 500 }, () => validJob) };
    expect(validateQueueExport(batch)).not.toBeNull();
  });
});

describe('parseQueueExport', () => {
  it('round-trips an export produced by buildQueueExport', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ input: fc.string(), output: fc.string(), transcoder: fc.constantFrom('FFMPEG', 'BMF') }), {
          maxLength: 20,
        }),
        fc.integer({ min: 1, max: 16 }),
        (jobs, concurrency) => {
          const live = jobs.map((job, i) => ({
            ...job,
            id: `job-${i}`,
            status: 'queued',
            options: {},
            // buildQueueExport projects only input/output/options/transcoder.
          })) as unknown as Parameters<typeof buildQueueExport>[0];

          const raw = JSON.stringify(buildQueueExport(live, concurrency));
          const parsed = parseQueueExport(raw);
          expect(parsed).not.toBeNull();
          expect(parsed!.version).toBe(QUEUE_EXPORT_VERSION);
          expect(parsed!.concurrency).toBe(concurrency);
          expect(parsed!.jobs).toHaveLength(jobs.length);
        },
      ),
      { seed: 12345 },
    );
  });

  it('returns null for malformed JSON text', () => {
    for (const raw of ['', '{', 'null', '[]', 'not json at all', '{"version":1,']) {
      expect(parseQueueExport(raw)).toBeNull();
    }
  });

  it('never throws for truncated or oversized text', () => {
    const prefix = '{"version":1,"concurrency":1,"jobs":[{"input":"a","output":"b","options":{},"transcoder":"ffmpeg"}]}';
    fc.assert(
      fc.property(fc.nat(200), (cut) => {
        expect(() => parseQueueExport(prefix.slice(0, cut))).not.toThrow();
      }),
      { seed: 12345 },
    );
    expect(() => parseQueueExport('x'.repeat(1_000_000))).not.toThrow();
  });
});
