/**
 * @fileoverview Regression guard for the renderer Content-Security-Policy.
 *
 * The shipped CSP was `default-src 'self'; ...; img-src 'self' data:; ...` with
 * no `font-src`. Vite inlines the `@fontsource/roboto` subsets that fall under
 * its 4 KB asset limit as `data:` URIs, so every one of them fell back to
 * `default-src 'self'` and was refused: the app ran with a fallback font for
 * every Roboto weight and the renderer console filled with CSP violations. The
 * e2e crash tripwire found it on its first run; nothing else in the repo could,
 * because the CSS is only bundled at build time and no other test reads
 * `index.html`.
 *
 * The invariant worth pinning is not the exact policy string - that churns -
 * but the relationship between it and the fonts the renderer imports.
 *
 * @see e2e/fixtures/tripwire.ts
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const RENDERER_DIR = join(__dirname, '..');
const INDEX_HTML = join(RENDERER_DIR, 'index.html');

/** @returns {string} The `content` of the CSP `<meta>` tag. */
function readCsp(): string {
  const html = readFileSync(INDEX_HTML, 'utf8');
  const match = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(html);
  expect(match, 'src/renderer/index.html must declare a Content-Security-Policy meta tag').not.toBeNull();
  return (match as RegExpExecArray)[1];
}

/**
 * Splits a CSP into a `directive -> source list` map, lower-cased.
 * @param {string} csp - The policy string.
 * @returns {Map<string, string[]>} The parsed directives.
 */
function parseCsp(csp: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    directives.set(
      tokens[0].toLowerCase(),
      tokens.slice(1).map((token) => token.toLowerCase()),
    );
  }
  return directives;
}

/**
 * True when any renderer source imports a bundled font stylesheet.
 *
 * Walks the tree rather than grepping one file, because the import can move. A
 * test that pins `main.tsx` would fail loudly and unhelpfully the day someone
 * moves the import to `theme.ts`, which is exactly the kind of churn that gets
 * a guard deleted instead of fixed.
 * @returns {boolean} True when at least one `@fontsource` import exists.
 */
function importsBundledFonts(): boolean {
  const stack = [RENDERER_DIR];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    for (const entry of readdirSync(dir)) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        stack.push(full);
      } else if (/\.tsx?$/.test(entry) && /@fontsource\//.test(readFileSync(full, 'utf8'))) {
        return true;
      }
    }
  }
  return false;
}

const directives = parseCsp(readCsp());

describe('renderer Content-Security-Policy', () => {
  it('declares script-src and style-src explicitly rather than leaning on default-src', () => {
    expect(directives.has('script-src')).toBe(true);
    expect(directives.has('style-src')).toBe(true);
  });

  it('keeps the font-src data: allowance exactly as long as a bundled font is imported', () => {
    // Stated as a biconditional rather than as two guarded assertions: a
    // conditional `if` inside a test is a silent skip, and a test that skips is
    // a test that cannot fail.
    const fontSrc = directives.get('font-src');
    expect(fontSrc, 'CSP must declare an explicit font-src').toBeDefined();
    expect((fontSrc ?? []).includes('data:')).toBe(importsBundledFonts());
  });

  it('never allows unsafe-eval in script-src', () => {
    // A regression here would be a remote-code-execution hole, not a font bug.
    expect(directives.get('script-src')).not.toContain("'unsafe-eval'");
  });
});
