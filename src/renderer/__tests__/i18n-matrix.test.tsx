/**
 * @fileoverview Phase 5.1 locale matrix (finding F7): every routed page in
 * every shipped locale.
 *
 * The rest of the renderer suite runs against the mocked `react-i18next` in
 * `test-setup.ts`, which hardcodes a few dozen English strings. That mock
 * cannot tell you whether `de-DE` ships a value whose interpolation token is
 * never satisfied, or whether `ja-JP` renders a raw translation key because a
 * component calls `t('typo.ed.key')`. This suite unmocks `react-i18next` and
 * renders the real twelve pages against the real i18next instance loaded with
 * all 56 locale files, asserting the three things the plan demands:
 *
 *  (a) no page error -- the crash tripwire makes any `window.error`,
 *      unhandled rejection, or raw `console.error` during a render fatal in
 *      every strictness mode, so "did not throw / did not console-error" is
 *      enforced here rather than re-implemented;
 *  (b) no raw `{{token}}` monument survives into visible text (a value was
 *      found but its interpolation value was missing);
 *  (c) no raw translation key renders as visible text (the `t()` fallback
 *      returns the key itself when it is missing).
 *
 * The suite additionally re-runs the key-parity + value-integrity checks that
 * `scripts/validate-locales.mjs` performs, so a broken locale JSON fails the
 * test tier without a separate job (the plan's "test-time variant").
 *
 * The suite runs as its own CI gate (`test:locale-matrix`), because 56 x 12
 * mounts in real-i18next mode is too slow for the shared unit tier.
 *
 * @see e2e/specs/.. for the sibling RTL/keyboard suites
 * @see scripts/validate-locales.mjs (the CLI analogue of the integrity test)
 */

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { act } from '@testing-library/react';
import { PAGE_ROUTES, renderPage, stubScrollIntoView } from '../../test-utils/page-render';
import { expectAppLog } from '../../test-utils/crash-tripwire';
import { LOCALES, isRtlLocale } from '../i18n/localeMeta';
import { useLanguageDirection } from '../useLanguageDirection';

// The global suite mocks `react-i18next` for speed. This suite needs the real
// hooks so pages translate against the real 56-locale resource set. Vitest
// hoists `vi.unmock` above every static import in this file, so the pages and
// the i18n config below all link against the real module.
vi.unmock('react-i18next');

import i18n from '../i18n/config';

/** @const - Directory holding the 56 locale JSON resources. */
const LOCALES_DIR = path.resolve(process.cwd(), 'src/renderer/i18n/locales');

/** @const - The reference locale; every other file must match its keys. */
const BASE_LOCALE = 'en-US';

interface FlatEntry {
  key: string;
  value: string;
}

/** Flattens a parsed locale JSON into its leaf entries (dot-delimited keys). */
function flattenEntries(json: Record<string, unknown>, prefix = '', out: FlatEntry[] = []): FlatEntry[] {
  for (const [key, child] of Object.entries(json)) {
    const joined = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      flattenEntries(child as Record<string, unknown>, joined, out);
    } else {
      out.push({ key: joined, value: String(child) });
    }
  }
  return out;
}

function loadLocale(fileName: string): { entries: FlatEntry[]; keys: Set<string>; raw: Record<string, unknown> } {
  const raw = JSON.parse(readFileSync(path.join(LOCALES_DIR, fileName), 'utf8')) as Record<string, unknown>;
  const entries = flattenEntries(raw);
  return { entries, keys: new Set(entries.map((e) => e.key)), raw };
}

const baseLocale = loadLocale(`${BASE_LOCALE}.json`);

/**
 * Every translation key the app can render, derived from the reference
 * locale. Key parity is asserted separately in the integrity test, so this
 * set is authoritative for the whole corpus once that test has run.
 */
const TRANSLATION_KEYS = baseLocale.keys;

/**
 * A single passable integrity rule over every value, applied per locale in the
 * integrity test and reused to describe failures.
 */
function interpolationTokens(value: string): string[] {
  const tokens: string[] = [];
  const re = /\{\{([^}]*)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    if (match[1].trim() === '') return ['<empty token>'];
    tokens.push(match[1].trim());
  }
  return tokens;
}

/**
 * Verifies a locale file against the reference: key parity, no empty values,
 * no value that is just its own key (a mistranslation dead giveaway), and
 * well-formed interpolation tokens (no `{{` without `}}`, no stray `}}`).
 */
function assertLocaleIntegrity(fileName: string, entries: FlatEntry[], keys: Set<string>): string[] {
  const problems: string[] = [];
  for (const key of baseLocale.keys) {
    if (!keys.has(key)) problems.push(`missing key "${key}"`);
  }
  for (const key of keys) {
    if (!baseLocale.keys.has(key)) problems.push(`extra key "${key}"`);
  }
  for (const { key, value } of entries) {
    if (value === '') problems.push(`empty value for "${key}"`);
    if (value === key) problems.push(`value equals its own key "${key}"`);
    for (const token of interpolationTokens(value)) {
      if (token === '<empty token>') problems.push(`empty interpolation token in "${key}"`);
    }
    const opens = (value.match(/\{\{/g) ?? []).length;
    const closes = (value.match(/\}\}/g) ?? []).length;
    if (opens !== closes) problems.push(`unbalanced interpolation in "${key}": ${value.slice(0, 80)}`);
  }
  return problems;
}

/**
 * Mirrors the production direction wiring (AppLayout in the real app runs
 * `useLanguageDirection` once), so `document.dir` reflects the active locale
 * and RTL assertions have something to read.
 */
function DirectionApplier({ children }: { children: ReactNode }): ReactNode {
  useLanguageDirection();
  return children;
}

const wrapTranslation = (children: ReactNode): ReactNode => (
  <I18nextProvider i18n={i18n}>
    <DirectionApplier>{children}</DirectionApplier>
  </I18nextProvider>
);

const RAW_TOKEN_PATTERN = /\{\{[^}]*\}\}/;

/** Every dotted leaf key, escaped and joined into one matcher. */
const LEAKED_KEY_PATTERN = new RegExp(
  `(?:${[...TRANSLATION_KEYS]
    .filter((key) => key.includes('.'))
    .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})`,
);

/**
 * Walks the visible text nodes of a rendered page and returns every one that
 * is (or embeds) a raw translation key -- the signature of a `t()` fallback
 * leaking the key itself to the user.
 */
function rawKeysInBody(root: HTMLElement): string[] {
  const leaked: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const text = (node as Text).data;
    if (text.trim() === '') continue;
    if (TRANSLATION_KEYS.has(text.trim())) leaked.push(`exact key "${text.trim()}"`);
    const embedded = text.match(LEAKED_KEY_PATTERN);
    if (embedded) leaked.push(`key "${embedded[0]}" embedded in "${text.slice(0, 80)}"`);
  }
  return leaked;
}

describe('5.1 locale matrix', () => {
  let restoreScrollIntoView: (() => void) | undefined;

  beforeAll(() => {
    restoreScrollIntoView = stubScrollIntoView();
  });

  afterAll(() => {
    restoreScrollIntoView?.();
  });

  it('every locale file matches the reference key set with intact values', () => {
    const localeCodes = LOCALES.map((meta) => meta.code);
    const fileNames = readdirSync(LOCALES_DIR)
      .filter((name) => name.endsWith('.json'))
      .sort();
    expect(localeCodes.length).toBe(fileNames.length);
    expect(localeCodes.sort()).toEqual(fileNames.map((name) => name.replace(/\.json$/, '')));

    for (const fileName of fileNames) {
      if (fileName === `${BASE_LOCALE}.json`) continue;
      const locale = loadLocale(fileName);
      const problems = assertLocaleIntegrity(fileName, locale.entries, locale.keys);
      expect(problems, `${fileName}: locale file failed integrity checks:\n - ${problems.sort().slice(0, 40).join('\n - ')}`).toHaveLength(
        0,
      );
    }
  });

  it('knows every route by heart (harness guard so the loop cannot empty out)', () => {
    expect(PAGE_ROUTES).toHaveLength(12);
    expect(new Set(PAGE_ROUTES.map((r) => r.name)).size).toBe(12);
  });

  it('reads real, non-English resources for a sample of locales', async () => {
    // Anchor for the whole matrix: if the real resource set ever stops
    // loading, every `t()` silently falls back to returning its key and the
    // leaked-key checks in the loop below would catch it - but a direct
    // assertion makes the mechanism explicit and fails on the first drifted
    // locale rather than a wall of renders. For each sampled locale, find a
    // key whose value differs from the English one and assert `t` returns it.
    const samples = ['fr-FR', 'de-DE', 'ar-AE', 'ja-JP', 'ru-RU', 'hi-IN'];

    for (const code of samples) {
      const locale = loadLocale(`${code}.json`);
      await i18n.changeLanguage(code);
      expect(i18n.language).toBe(code);

      const enValues = new Map(baseLocale.entries.map((e) => [e.key, e.value]));
      const different = locale.entries.find(
        (e) => enValues.get(e.key) !== undefined && enValues.get(e.key) !== e.value && e.value !== e.key,
      );
      expect(different, `${code} shares every value with en-US; pick a locale that actually differs to anchor the matrix`).toBeDefined();
      expect(i18n.t(different!.key)).toBe(different!.value);
    }
  });

  for (const { code } of LOCALES) {
    it(`renders all 12 routes in ${code} without errors, raw tokens, or leaked keys`, async () => {
      // Rendering pages in a benign default state legitimately produces app
      // WARNs (empty queue, no selection, ...). The matrix's job is i18n
      // integrity, not warning hygiene, so the app's own warnings are
      // declared; any window error, unhandled rejection, or raw console.error
      // stays fatal and fails the test ("no pageerror").
      expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);

      await i18n.changeLanguage(code);
      expect(i18n.language).toBe(code);

      for (const route of PAGE_ROUTES) {
        let pageError: unknown = null;
        let result: { unmount: () => void } | null = null;
        try {
          result = renderPage(route.name, { wrap: wrapTranslation });
        } catch (err) {
          pageError = err;
        }
        expect(pageError, `${code} / ${route.name} threw while rendering`).toBeNull();

        // Let mount effects (async store loads, direction effect) settle before
        // reading the DOM.
        await act(async () => {
          await Promise.resolve();
        });

        const expectedDir = isRtlLocale(code) ? 'rtl' : 'ltr';
        expect(document.dir, `${code} / ${route.name} must set dir to the locale's direction`).toBe(expectedDir);

        const body = document.body;
        const bodyText = body.textContent ?? '';

        expect(RAW_TOKEN_PATTERN.test(bodyText), `${code} / ${route.name} rendered an unsatisfied interpolation token`).toBe(false);

        const leaked = rawKeysInBody(body);
        expect(leaked, `${code} / ${route.name} rendered raw translation keys`).toHaveLength(0);

        result?.unmount();
      }
    });
  }
});
