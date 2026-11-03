/**
 * @fileoverview Tests for the locale parity/usage validator. The checker gates
 * translation cleanup, so its key flattening, template matching and delete
 * semantics are pinned here rather than trusted by inspection.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  flattenKeys,
  extractUsage,
  matchKeys,
  findUnusedKeys,
  findUnknownKeys,
  compareKeys,
  deleteKeyPath,
  pruneUnusedKeys,
} from '../validate-locale-usage.mjs';

describe('flattenKeys', () => {
  it('flattens nested objects to dotted leaf keys', () => {
    const keys = flattenKeys({ nav: { home: 'Home', nested: { deep: 'Deep' } }, plain: 'x' });
    expect([...keys].sort()).toEqual(['nav.home', 'nav.nested.deep', 'plain']);
  });

  it('treats arrays and scalars as leaves', () => {
    const keys = flattenKeys({ list: ['a', 'b'], count: 2 });
    expect([...keys].sort()).toEqual(['count', 'list']);
  });
});

describe('extractUsage', () => {
  it('collects string literals including template literals without substitutions', () => {
    const usage = extractUsage("const a = 'nav.home'; const b = `nav.logs`;", 'sample.ts');
    expect(usage.literals.has('nav.home')).toBe(true);
    expect(usage.literals.has('nav.logs')).toBe(true);
  });

  it('builds a single-segment pattern from a namespaced template', () => {
    const usage = extractUsage('const label = t(`mediaInfo.tagKeys.${key}`);', 'sample.ts');
    expect([...usage.patterns]).toEqual(['mediaInfo\\.tagKeys\\.[^.]+']);
  });

  it('ignores templates without a namespaced static head', () => {
    const usage = extractUsage('const file = `${name}.${ext}`;', 'sample.ts');
    expect([...usage.patterns]).toEqual([]);
  });

  it('records literal translation arguments', () => {
    const usage = extractUsage("t('copilot.title'); i18n.t('settings.ai.save');", 'sample.ts');
    expect([...usage.referenced].sort()).toEqual(['copilot.title', 'settings.ai.save']);
  });

  it('records only fully-dotted *Key property values', () => {
    const usage = extractUsage("const a = { i18nKey: 'copilot', labelKey: 'shortcuts.sections.global' };", 'sample.ts');
    expect([...usage.referenced]).toEqual(['shortcuts.sections.global']);
  });

  it('records fully-dotted JSX key attributes', () => {
    const usage = extractUsage('<Shortcut i18nKey="shortcuts.save" labelKey="trim" />', 'sample.tsx');
    expect([...usage.referenced]).toEqual(['shortcuts.save']);
  });
});

describe('matchKeys', () => {
  it('marks literal and template matches, leaving the rest unmatched', () => {
    const usage = extractUsage("t('nav.home'); t(`copilot.op.${operation}`);", 'sample.ts');
    const matched = matchKeys(['nav.home', 'copilot.op.convert', 'copilot.title'], usage);
    expect(matched.get('nav.home')).toBe('literal');
    expect(matched.get('copilot.op.convert')).toBe('dynamic');
    expect(matched.has('copilot.title')).toBe(false);
  });

  it('does not let a one-segment template swallow deeper keys', () => {
    const usage = extractUsage('t(`mediaInfo.${kind}`);', 'sample.ts');
    const unused = findUnusedKeys(['mediaInfo.tagKeys.title', 'mediaInfo.video'], usage);
    expect(unused).toEqual(['mediaInfo.tagKeys.title']);
  });
});

describe('findUnknownKeys', () => {
  it('reports referenced literals missing from the base locale', () => {
    const usage = extractUsage("t('nav.home'); t('nav.typo');", 'sample.mjs');
    const unknown = findUnknownKeys(usage.referenced, new Set(['nav.home']));
    expect(unknown).toEqual(['nav.typo']);
  });
});

describe('compareKeys', () => {
  it('separates missing and extra keys', () => {
    const { missing, extra } = compareKeys(new Set(['a.b', 'a.c']), new Set(['a.b', 'a.d']));
    expect(missing).toEqual(['a.c']);
    expect(extra).toEqual(['a.d']);
  });
});

describe('deleteKeyPath', () => {
  it('removes a nested key and its now-empty parent on request', () => {
    const json = { a: { b: { c: 'x' }, keep: 'y' } };
    expect(deleteKeyPath(json, 'a.b.c')).toBe(true);
    expect(json).toEqual({ a: { b: {}, keep: 'y' } });
  });

  it('returns false for a path that does not exist', () => {
    const json = { a: { b: 'x' } };
    expect(deleteKeyPath(json, 'a.missing.leaf')).toBe(false);
    expect(deleteKeyPath(json, 'a.b')).toBe(true);
  });
});

describe('pruneUnusedKeys', () => {
  it('drops unused leaves and empty namespaces, then serializes with a trailing newline', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locale-usage-'));
    try {
      const original = { app: { name: 'EncodeX', stale: 'gone' }, retired: { only: 'x' }, keep: 'y' };
      fs.writeFileSync(path.join(dir, 'en-US.json'), JSON.stringify(original));
      const locales = [{ file: 'en-US.json', json: structuredClone(original) }];

      expect(pruneUnusedKeys(locales, ['app.stale', 'retired.only'], dir)).toBe(1);

      const written = fs.readFileSync(path.join(dir, 'en-US.json'), 'utf8');
      expect(written.endsWith('\n')).toBe(true);
      expect(JSON.parse(written)).toEqual({ app: { name: 'EncodeX' }, keep: 'y' });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
