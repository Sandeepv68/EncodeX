/**
 * @fileoverview Tests for the MCP App bundle loader.
 *
 * The bundle is a build artefact (`npm run build:mcp-ui`). The loader finds it
 * on disk, caches it, and injects the per-view bootstrap into it. The unit
 * tier must not depend on a build, so the tests point the loader at a
 * temporary file through the `ENCODEX_MCP_UI_BUNDLE` override.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildViewDocument, clearBundleCache, loadBundle, resolveBundlePath } from '../ui/bundle';

/** The document the fake bundle contains. @const {string} */
const FAKE_BUNDLE = '<!doctype html><html><head><title>EncodeX</title></head><body><div id="root"></div></body></html>';

/** The temporary directory of the fake bundle. @type {string} */
let dir = '';

describe('MCP App bundle loader', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mcp-bundle-'));
    fs.writeFileSync(path.join(dir, 'views.html'), FAKE_BUNDLE);
    process.env.ENCODEX_MCP_UI_BUNDLE = path.join(dir, 'views.html');
    clearBundleCache();
  });

  afterEach(() => {
    delete process.env.ENCODEX_MCP_UI_BUNDLE;
    clearBundleCache();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('finds the bundle through the environment override', () => {
    expect(resolveBundlePath()).toBe(path.join(dir, 'views.html'));
    expect(loadBundle()).toBe(FAKE_BUNDLE);
  });

  it('caches the bundle instead of reading it on every call', () => {
    expect(loadBundle()).toBe(FAKE_BUNDLE);
    fs.writeFileSync(path.join(dir, 'views.html'), 'changed');
    expect(loadBundle()).toBe(FAKE_BUNDLE);
    clearBundleCache();
    expect(loadBundle()).toBe('changed');
  });

  it('injects the view bootstrap into the head of the document', () => {
    const html = buildViewDocument('queue');
    expect(html).toContain('window.__ENCODEX_VIEW__="queue"');
    expect(html.indexOf('__ENCODEX_VIEW__')).toBeLessThan(html.indexOf('<title>'));
    expect(html).toContain('<title>EncodeX</title>');
  });

  it('builds from a supplied document without touching the disk', () => {
    const html = buildViewDocument('job', FAKE_BUNDLE);
    expect(html).toContain('window.__ENCODEX_VIEW__="job"');
  });

  it('prepends the bootstrap when the document has no head', () => {
    const html = buildViewDocument('job', '<div id="root"></div>');
    expect(html.startsWith('<script>window.__ENCODEX_VIEW__="job";</script>')).toBe(true);
  });

  it('finds the bundle by walking up from the search root', () => {
    delete process.env.ENCODEX_MCP_UI_BUNDLE;
    fs.mkdirSync(path.join(dir, 'dist', 'mcp-ui'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dist', 'mcp-ui', 'views.html'), 'walked');
    expect(resolveBundlePath(dir)).toBe(path.join(dir, 'dist', 'mcp-ui', 'views.html'));
  });

  it('reports a missing bundle instead of serving an empty document', () => {
    process.env.ENCODEX_MCP_UI_BUNDLE = path.join(dir, 'missing.html');
    clearBundleCache();
    expect(() => loadBundle()).toThrow(/bundle was not found/i);
  });

  it('reports a missing bundle when the search root has none', () => {
    delete process.env.ENCODEX_MCP_UI_BUNDLE;
    clearBundleCache();
    expect(() => resolveBundlePath(path.join(dir, 'empty'))).toThrow(/bundle was not found/i);
  });
});
