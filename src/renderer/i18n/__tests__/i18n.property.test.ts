/**
 * @fileoverview Property-based tests for i18n interpolation in the test harness (Phase 1).
 *
 * The app's translation strings come from 56 locale JSON files, and a missing or
 * extra `{{token}}` is only ever going to be discovered by rendering a page that
 * nobody translated. The mock in `test-setup.ts` is what resolves those tokens in
 * every renderer test, so its behavior is the contract: a token that has no
 * value must be left visible rather than blanked, and interpolation must never
 * throw or corrupt the prototype chain via a `__proto__` key.
 *
 * i18next's real interpolator is exercised through the mock for the same reason
 * the renderer tests exercise it at all - it is the path a missing-translation
 * bug actually travels.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

// Re-derive the mocked hook's `t` without importing the setup module's side
// effects: the mock is declared with vi.mock at module scope, so importing
// `react-i18next` here yields the same factory result under vitest.
async function translate(key: string, opts?: Record<string, unknown>): Promise<string> {
  const mod = (await import('react-i18next')) as unknown as {
    useTranslation: () => { t: (key: string, opts?: Record<string, string | number>) => string };
  };
  return mod.useTranslation().t(key, opts as Record<string, string | number>);
}

/** Tokens the mock dictionary actually defines, for the "well-formed" case. */
const REAL_KEYS: [string, Record<string, string | number>][] = [
  ['batchQueue.stats', { queued: 1, running: 2, done: 3, failed: 0 }],
  ['batchQueue.etaEstimate', { eta: '1m 30s' }],
  ['batchQueue.finished', { done: 5, failed: 1 }],
  ['batchQueue.editOptionsTitle', { file: 'clip.mp4' }],
  ['imageCompress.selectedImage', { file: 'a.png' }],
  ['audioExtract.selectedVideo', { file: 'b.mp4' }],
  ['remux.thumbnailMode', { mode: 'attached' }],
  ['remux.thumbnailUnsupported', { container: 'MP4' }],
  ['remux.chaptersUnsupported', { container: 'MP4' }],
  ['convert.chainPreview', { chain: 'fps=30' }],
  ['footer.downloading', { version: '1.0.0', percent: 50 }],
];

describe('i18n interpolation', () => {
  it('substitutes every declared token for a real key', async () => {
    for (const [key, opts] of REAL_KEYS) {
      const result = await translate(key, opts);
      expect(result).not.toContain('{{');
      for (const value of Object.values(opts)) {
        expect(result).toContain(String(value));
      }
    }
  });

  it('never throws for an adversarial key', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (key) => {
        expect(await translate(key)).toBeTypeOf('string');
      }),
      { seed: 12345 },
    );
  });

  it('never throws for adversarial interpolation values', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.dictionary(fc.string(), fc.string(), { maxKeys: 5 }), async (key, opts) => {
        expect(await translate(key, opts)).toBeTypeOf('string');
      }),
      { seed: 12345 },
    );
  });

  it('leaves an unsatisfied token visible instead of blanking it', async () => {
    // The bug this catches: a missing value silently rendering an empty gap, so
    // "ETA ~" ships with no time in it. A visible "{{eta}}" is a loud failure.
    const result = await translate('batchQueue.etaEstimate', {});
    expect(result).toContain('{{eta}}');
  });

  it('tolerates extra values that no token consumes', async () => {
    const result = await translate('batchQueue.etaEstimate', { eta: '45s', unused: 'ignored', extra: 1 });
    expect(result).toBe('ETA ~45s');
  });

  it('does not let a __proto__ key reach Object.prototype', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant('__proto__'), fc.constant('polluted'), async (k, v) => {
        expect(await translate('batchQueue.etaEstimate', { [k]: v })).toBeTypeOf('string');
      }),
      { seed: 12345 },
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('does not let a __proto__ *key* leak through the lookup path', async () => {
    const result = await translate('__proto__', { polluted: 'yes' });
    expect(result).toBeTypeOf('string');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('survives a RegExp-metacharacter key without corrupting the string', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom('(', ')', '[', ']', '*', '+', '?', '\\', '.', '^', '$'), async (key) => {
        expect(await translate(key, { [key]: 'x' })).toBeTypeOf('string');
      }),
      { seed: 12345 },
    );
  });

  it('falls back to the key when no dictionary entry exists', async () => {
    const result = await translate('totally.unknown.key');
    expect(result).toBe('totally.unknown.key');
  });

  it('honours defaultValue for an unknown key', async () => {
    const result = await translate('totally.unknown.key', { defaultValue: 'Fallback' });
    expect(result).toBe('Fallback');
  });
});

describe('locale JSON corpus', () => {
  // Guard against a locale file shipping a prototype-polluting key, which would
  // poison the i18next resource store for every language.
  it('no locale contains a __proto__ or constructor key', async () => {
    const { default: fs } = await import('node:fs');
    const { default: path } = await import('node:path');
    const dir = path.resolve(__dirname, '../locales');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

    expect(files.length).toBeGreaterThan(50);

    for (const file of files) {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__'), file).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(parsed, 'constructor'), file).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(parsed, 'prototype'), file).toBe(false);
    }
  });

  it('every locale parses as JSON without throwing', async () => {
    const { default: fs } = await import('node:fs');
    const { default: path } = await import('node:path');
    const dir = path.resolve(__dirname, '../locales');

    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...fs.readdirSync(dir).filter((f) => f.endsWith('.json'))), async (file) => {
        const raw = fs.readFileSync(path.join(dir, file), 'utf8');
        expect(() => JSON.parse(raw)).not.toThrow();
      }),
      { seed: 12345 },
    );
  });
});
