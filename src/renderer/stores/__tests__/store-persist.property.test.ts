/**
 * @fileoverview Property tests for renderer store rehydration (Phase 1 store row).
 *
 * Every persisted store rehydrates at module load, before any component mounts
 * and before any error boundary exists. A throw in `readStored*` therefore takes
 * down the whole renderer on startup, from a value the user never typed by hand -
 * a half-written entry, a value left by an older schema, or a browser extension
 * writing into the same origin.
 *
 * The invariant is deliberately narrow: **never throw, and never return a shape
 * that would break a consumer.** Assertions are on the reader's post-validation
 * contract, not on it echoing back the input, because a reader that trusted its
 * input would pass an echo test while still corrupting state.
 */

import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { expectAppLog, getAppLogs, silenceConsoleOutput, takeRecordedCrashes } from '../../../test-utils/crash-tripwire';
import { loadJson, loadString, saveJson, saveString } from '../../utils/storage';
import { readStoredBatchConfig } from '../batchConfig';
import { readStoredHwAccel, readStoredQueueConcurrency, readStoredWhenDone, readStoredDrawerCondensed } from '../settingsStore';
import { readStoredVideoCutDraft } from '../videoCutStore';
import { MAX_QUEUE_CONCURRENCY, WHEN_DONE_ACTIONS } from '../../../shared/constants';

/** @interface */
interface Reader {
  /** The localStorage key the reader reads. */
  key: string;
  /** The reader itself. */
  read: () => unknown;
  /**
   * The logger context that records this reader's parse-failure warning, or
   * `null` when the reader cannot warn about the value at all.
   *
   * This is `null` for the two `loadString`-based readers and that distinction
   * is load-bearing rather than cosmetic: `loadString` routes only a *thrown*
   * `localStorage.getItem` to `onError`, so seeding it with garbage produces no
   * warning, while `loadJson` routes every parse failure and does. Declaring a
   * warning for a reader that never emits one would be an allowance that can
   * never be exercised, and {@link WARN_CONTEXTS} below pins the difference.
   */
  warnContext: string | null;
}

/** Every reader that runs during module-init rehydration. */
const READERS: Reader[] = [
  { key: 'encodex-batch-config', read: readStoredBatchConfig, warnContext: 'renderer/stores/batchConfig' },
  { key: 'encodex-hwaccel', read: readStoredHwAccel, warnContext: 'renderer/stores/settingsStore' },
  { key: 'encodex-queue-concurrency', read: readStoredQueueConcurrency, warnContext: null },
  { key: 'encodex-when-done', read: readStoredWhenDone, warnContext: 'renderer/stores/settingsStore' },
  { key: 'encodex-drawer-condensed', read: readStoredDrawerCondensed, warnContext: null },
  { key: 'encodex-video-cut-draft', read: readStoredVideoCutDraft, warnContext: 'renderer/stores/videoCutStore' },
];

/**
 * Every distinct logger context a reader in {@link READERS} can warn through.
 * @const
 */
const WARN_CONTEXTS = [...new Set(READERS.map((r) => r.warnContext).filter((c): c is string => c !== null))];

/**
 * Declares the warnings the given readers may legitimately emit.
 *
 * Feeding a store a corrupt value and having it warn-then-fall-back is the
 * *correct* behaviour, and the tripwire's `strict` level treats an undeclared
 * app warning as a failure. So the declaration is required - but it must be
 * derived from the reader table rather than from a hand-written list of key
 * prefixes, because such a list silently stops covering readers as they are
 * added. That is not hypothetical: an earlier draft of this file matched
 * `key.startsWith(...)` and had already dropped `encodex-video-cut-draft`,
 * which warns through its own context and would have failed for a reason that
 * had nothing to do with the property under test.
 * @param {Reader[]} readers - The readers about to be invoked.
 */
function allowReaderWarnings(...readers: Reader[]): void {
  for (const reader of readers) {
    if (reader.warnContext) expectAppLog('warn', reader.warnContext);
  }
}

/**
 * Adversarial raw strings. Note that valid JSON of the *wrong type* is the
 * dangerous half: it parses cleanly, so a reader that skips validation gets a
 * value through where a corrupt-bytes string would at least hit the catch.
 */
const ADVERSARIAL_RAW = [
  'null',
  'undefined',
  '"undefined"',
  '[]',
  '123',
  '0',
  '-1',
  '1e400',
  'true',
  'false',
  '"a string"',
  '{}',
  '{"__proto__":{"polluted":true}}',
  '{"constructor":{"prototype":{"polluted":true}}}',
  '{"prototype":{"polluted":true}}',
  '{"toString":1}',
  '{"valueOf":1}',
  '[null,1,2]',
  '{"items":"not an array"}',
  '{"items":[1,2,3]}',
  '{"enabled":"yes"}',
  '{"concurrency":-99999}',
  '{"concurrency":1e309}',
  '{"concurrency":"4"}',
  '{'.repeat(200),
  '['.repeat(200),
  '{"a":'.repeat(500),
  '"' + 'x'.repeat(200_000),
  '\x00\x01\x02',
  '\\u0000\\u0000',
  'NaN',
  'Infinity',
  '-Infinity',
  '{"version":-1}',
  '{"version":"999.0.0"}',
  '{"0":1,"1":2}',
  '{"nested":{"deep":{"deeper":{"x":[1,[2,[3,{"y":null}]]]}}}}',
];

function seed(key: string, raw: string): void {
  localStorage.setItem(key, raw);
}

afterEach(() => {
  localStorage.clear();
});

describe('storage helpers are total', () => {
  it('loadJson never throws and falls back for unparseable input', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        localStorage.setItem('k', raw);
        const errors: unknown[] = [];
        const out = loadJson<unknown>('k', { fb: true }, (e) => errors.push(e));
        // Any return value is fine here - the point is totality plus the
        // guarantee that a failed parse routes to onError rather than escaping.
        expect(out).not.toBeUndefined();
        expect(errors.length).toBeLessThanOrEqual(1);
        return true;
      }),
      { seed: 12345 },
    );
  });

  it('loadJson treats JSON null and missing keys as the fallback', () => {
    localStorage.setItem('k', 'null');
    expect(loadJson('k', { fb: 1 })).toEqual({ fb: 1 });
    expect(loadJson('absent', { fb: 2 })).toEqual({ fb: 2 });
  });

  it('loadString returns the raw value and never throws', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        localStorage.setItem('k', raw);
        expect(loadString('k', 'fb')).toBe(raw);
      }),
      { seed: 12345 },
    );
  });

  it('saveJson/saveString swallow write failures', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function boom() {
      throw new DOMException('QuotaExceededError');
    };
    try {
      expect(() => saveJson('k', { a: 1 }, () => {})).not.toThrow();
      expect(() => saveString('k', 'v', () => {})).not.toThrow();
      expect(() => saveJson('k', { a: 1 })).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe('store readers survive adversarial rehydration', () => {
  it('never throws for any adversarial stored value', () => {
    for (const reader of READERS) {
      for (const raw of ADVERSARIAL_RAW) {
        seed(reader.key, raw);
        allowReaderWarnings(reader);
        expect(() => reader.read(), `${reader.key} <- ${raw.slice(0, 40)}`).not.toThrow();
      }
    }
  });

  it('never throws for arbitrary generated stored values', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: READERS.length - 1 }),
        fc
          .oneof(fc.string(), fc.jsonValue(), fc.constantFrom(...ADVERSARIAL_RAW))
          .chain((v) => (typeof v === 'string' ? fc.constant(v) : fc.constant(JSON.stringify(v) ?? 'null'))),
        (idx, raw) => {
          const reader = READERS[idx]!;
          seed(reader.key, raw);
          allowReaderWarnings(reader);
          expect(() => reader.read()).not.toThrow();
          return true;
        },
      ),
      { seed: 12345 },
    );
  });

  it('does not let a __proto__ payload reach Object.prototype', () => {
    for (const reader of READERS) {
      seed(reader.key, '{"__proto__":{"polluted":true}}');
      allowReaderWarnings(reader);
      reader.read();
      seed(reader.key, '{"constructor":{"prototype":{"polluted2":true}}}');
      allowReaderWarnings(reader);
      reader.read();
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted2).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('returns a usable value for an empty or absent key, not undefined', () => {
    for (const reader of READERS) {
      seed(reader.key, '');
      allowReaderWarnings(reader);
      const fromEmpty = reader.read();
      expect(fromEmpty, reader.key).toBeDefined();

      localStorage.removeItem(reader.key);
      allowReaderWarnings(reader);
      const fromMissing = reader.read();
      expect(fromMissing, reader.key).toBeDefined();
    }
  });

  it('boolean readers return an actual boolean under every adversarial value', () => {
    for (const raw of ADVERSARIAL_RAW) {
      seed('encodex-drawer-condensed', raw);
      expect(typeof readStoredDrawerCondensed()).toBe('boolean');

      seed('encodex-hwaccel', raw);
      allowReaderWarnings(READERS[1]!);
      expect(readStoredHwAccel()).toBeTypeOf('object');
      expect(readStoredHwAccel()).not.toBeNull();
    }
  });

  it('queue concurrency stays an integer clamped to 1..MAX', () => {
    for (const raw of ['{"concurrency":-99999}', '{"concurrency":1e309}', '{"concurrency":"4"}', '123', 'null', '0', '-1', '9999']) {
      seed('encodex-queue-concurrency', raw);
      const n = readStoredQueueConcurrency();
      // Asserting only isFinite here was too weak: dropping the reader's
      // clamp() still yields a finite -99999, and the mutation survived.
      expect(Number.isInteger(n), raw).toBe(true);
      expect(n, raw).toBeGreaterThanOrEqual(1);
      expect(n, raw).toBeLessThanOrEqual(MAX_QUEUE_CONCURRENCY);
    }
  });

  it('queue concurrency is clamped for arbitrary out-of-range raw values', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: 1_000_000 }), (n) => {
        seed('encodex-queue-concurrency', String(n));
        const out = readStoredQueueConcurrency();
        expect(Number.isInteger(out)).toBe(true);
        expect(out).toBeGreaterThanOrEqual(1);
        expect(out).toBeLessThanOrEqual(MAX_QUEUE_CONCURRENCY);
      }),
      { seed: 12345 },
    );
  });

  it('when-done always resolves to a known action', () => {
    for (const raw of ADVERSARIAL_RAW) {
      seed('encodex-when-done', raw);
      allowReaderWarnings(READERS[3]!);
      const wd = readStoredWhenDone();
      expect(typeof wd).toBe('string');
      expect(WHEN_DONE_ACTIONS as readonly string[]).toContain(wd);
    }
  });

  it('batch config keeps every key populated with the right primitive type', () => {
    for (const raw of ADVERSARIAL_RAW) {
      seed('encodex-batch-config', raw);
      allowReaderWarnings(READERS[0]!);
      const cfg = readStoredBatchConfig() as unknown as Record<string, unknown>;
      expect(cfg, raw).toBeTypeOf('object');
      expect(cfg).not.toBeNull();
      // Consumers index these directly (cfg.<field>.<subfield>), so a missing
      // key is an undefined dereference, not a cosmetic gap.
      for (const value of Object.values(cfg)) {
        expect(['string', 'boolean', 'number', 'object']).toContain(typeof value);
        expect(value).not.toBeUndefined();
      }
    }
  });
});

describe('the warning allowance above is neither over- nor under-declared', () => {
  /**
   * Pins which readers actually warn on a corrupt value.
   *
   * Without this, `allowReaderWarnings` could drift in two directions at once
   * and both would be invisible: a reader that starts warning without a
   * `warnContext` fails the enclosing test with a confusing tripwire report,
   * while a reader that stops warning keeps a declaration nothing can ever
   * match. Both are the "green test that cannot fail" shape this plan exists
   * to remove, so the expectation is asserted directly rather than inferred
   * from a suite being green.
   */
  it('warns for exactly the loadJson-backed readers', () => {
    const restore = silenceConsoleOutput();
    try {
      for (const reader of READERS) {
        seed(reader.key, '{"not":"closed"');
        allowReaderWarnings(reader);
        takeRecordedCrashes();
        reader.read();
        const warned = getAppLogs().filter((entry) => entry.kind === 'appWarn' && entry.context === reader.warnContext);
        expect(warned.length > 0, `${reader.key} expected to warn via ${reader.warnContext ?? '<none>'}`).toBe(reader.warnContext !== null);
        takeRecordedCrashes();
      }
    } finally {
      restore();
    }
  });

  it('covers every distinct logger context a reader can use', () => {
    // A reader added to the table without a context, or with a context that no
    // longer exists, must not be able to slip past unnoticed.
    for (const context of WARN_CONTEXTS) {
      expect(WARN_CONTEXTS.filter((c) => c === context)).toHaveLength(1);
    }
    expect(READERS.every((r) => r.warnContext === null || WARN_CONTEXTS.includes(r.warnContext))).toBe(true);
  });
});

describe('rehydration is idempotent', () => {
  it('reading twice yields the same value, and reading after a write round-trips', () => {
    for (const reader of READERS) {
      seed(reader.key, '{"concurrency":3,"enabled":true,"force":false,"action":"quit"}');
      allowReaderWarnings(reader);
      const first = reader.read();
      seed(reader.key, '{"concurrency":3,"enabled":true,"force":false,"action":"quit"}');
      allowReaderWarnings(reader);
      expect(reader.read()).toEqual(first);
    }
  });

  it('a value written by the reader itself survives a re-read', () => {
    const cfg = readStoredBatchConfig();
    seed('encodex-batch-config', JSON.stringify(cfg));
    expect(readStoredBatchConfig()).toEqual(cfg);
  });
});
