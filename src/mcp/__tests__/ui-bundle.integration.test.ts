/**
 * @fileoverview Integration coverage for MCP UI bundle utilities.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildViewDocument, clearBundleCache, loadBundle, resolveBundlePath } from '../ui/bundle';

const FAKE_BUNDLE = '<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>';

describe('mcp/ui/bundle (integration)', () => {
  let dir = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mcp-bundle-int-'));
    fs.writeFileSync(path.join(dir, 'views.html'), FAKE_BUNDLE);
    process.env.ENCODEX_MCP_UI_BUNDLE = path.join(dir, 'views.html');
    clearBundleCache();
  });

  afterEach(() => {
    delete process.env.ENCODEX_MCP_UI_BUNDLE;
    clearBundleCache();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loads and injects bootstrap', () => {
    expect(loadBundle()).toBe(FAKE_BUNDLE);
    const html = buildViewDocument('queue');
    expect(html).toContain('window.__ENCODEX_VIEW__="queue"');
  });

  it('honours the bundle path the environment points at', () => {
    expect(resolveBundlePath()).toBe(path.join(dir, 'views.html'));
  });

  it('reports a bundle the environment points at but that is gone', () => {
    process.env.ENCODEX_MCP_UI_BUNDLE = path.join(dir, 'missing.html');
    expect(() => resolveBundlePath()).toThrow(/bundle was not found/i);
  });

  it('finds the built bundle by walking up from the search root', () => {
    delete process.env.ENCODEX_MCP_UI_BUNDLE;
    const root = path.join(dir, 'app');
    fs.mkdirSync(path.join(root, 'dist', 'mcp-ui'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'mcp-ui', 'views.html'), FAKE_BUNDLE);
    expect(resolveBundlePath(root)).toBe(path.join(root, 'dist', 'mcp-ui', 'views.html'));
  });

  it('reports a missing bundle instead of serving an empty document', () => {
    delete process.env.ENCODEX_MCP_UI_BUNDLE;
    const empty = path.join(dir, 'empty');
    fs.mkdirSync(empty, { recursive: true });
    expect(() => resolveBundlePath(empty)).toThrow(/bundle was not found/i);
  });
});
