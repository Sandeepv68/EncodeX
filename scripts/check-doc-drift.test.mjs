/**
 * @fileoverview Tests for the documentation drift checker.
 *
 * Run with: npm run doc:drift:test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'path';
import { checkFile, collectDocFiles, computeFacts, parseMarkers } from './lib/doc-drift.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

test('computeFacts returns the documented fact set', () => {
  const facts = computeFacts(ROOT);
  const expectedKeys = [
    'video-codecs',
    'audio-codecs',
    'pixel-formats',
    'builtin-profiles',
    'profile-categories',
    'shortcuts',
    'shortcut-sections',
    'locales',
    'locale-subtags',
    'error-codes',
    'ipc-channels',
    'renderer-pages',
    'renderer-stores',
    'renderer-components',
    'renderer-components-top',
    'renderer-component-tests',
    'renderer-styles',
    'test-files',
    'log-constants',
    'mcp-tools',
    'mcp-registrations',
    'mcp-gui-tools',
    'cli-subcommands',
    'e2e-specs',
    'video-filter-presets',
    'copilot-operations',
  ];
  assert.deepEqual(Object.keys(facts).sort(), expectedKeys.sort());
  for (const [key, value] of Object.entries(facts)) {
    assert.equal(typeof value, 'number', `${key} should be a number`);
    assert.ok(value > 0, `${key} should be positive`);
  }
});

test('every computed fact is internally consistent', () => {
  const facts = computeFacts(ROOT);
  assert.equal(facts['mcp-registrations'], facts['mcp-tools'] + 1);
  assert.equal(facts['profile-categories'], 8);
  assert.ok(facts['renderer-components'] > facts['renderer-components-top']);
  assert.ok(facts['renderer-component-tests'] > 0);
});

test('parseMarkers extracts drift markers', () => {
  const markers = parseMarkers('text <!-- drift:video-codecs=51 --> more <!-- drift:locales=56 -->');
  assert.deepEqual(markers, [
    { key: 'video-codecs', value: '51' },
    { key: 'locales', value: '56' },
  ]);
});

test('parseMarkers ignores non-drift comments', () => {
  assert.deepEqual(parseMarkers('<!-- note --><!-- drift --><!-- drift:bad key=1 -->'), []);
});

test('checkFile reports a mismatch', () => {
  const result = checkFile('doc.md', '<!-- drift:video-codecs=50 -->', { 'video-codecs': 51 });
  assert.equal(result.markerCount, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].expected, 51);
});

test('checkFile reports an unknown fact key', () => {
  const result = checkFile('doc.md', '<!-- drift:not-a-fact=1 -->', { 'video-codecs': 51 });
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].reason, 'unknown fact key');
});

test('checkFile accepts a matching marker', () => {
  const result = checkFile('doc.md', '<!-- drift:video-codecs=51 -->', { 'video-codecs': 51 });
  assert.equal(result.failures.length, 0);
  assert.equal(result.markerCount, 1);
});

test('collectDocFiles finds every documentation tree', () => {
  const files = collectDocFiles(ROOT).map((entry) => entry.file);
  assert.ok(files.includes(path.join('wiki', 'Features.md')));
  assert.ok(files.includes(path.join('site', 'docs', 'ipc.md')));
  assert.ok(files.some((file) => file.startsWith(path.join('docs', 'de'))));
  assert.ok(files.some((file) => file.startsWith(path.join('site', 'locales', 'de'))));
});
