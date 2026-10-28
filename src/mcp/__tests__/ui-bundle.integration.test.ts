/**
 * @fileoverview Integration coverage for MCP UI bundle utilities.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildViewDocument, clearBundleCache, loadBundle } from '../ui/bundle';

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
    expect(html).toContain('window.__ENCODEX_VIEW__=\"queue\"');
  });
});
