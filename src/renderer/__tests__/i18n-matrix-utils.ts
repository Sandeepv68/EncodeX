/**
 * @fileoverview Shared helpers for the Phase 5.1 i18n suites (locale matrix +
 * RTL mirror). Kept OUT of any `*.test.*` file so the helpers are never
 * collected as tests themselves; both suites import them from here.
 *
 * These helpers are deliberately pure/self-contained: they read locale JSON
 * from disk, flatten it to dotted leaf keys, and scan rendered DOM for the two
 * i18n failure signatures (unsatisfied interpolation tokens and leaked
 * translation keys).
 */

import { readFileSync } from 'fs';
import path from 'path';

/** Directory holding the 56 locale JSON resources. */
export const LOCALES_DIR = path.resolve(process.cwd(), 'src/renderer/i18n/locales');

/** The reference locale; every other file must match its keys. */
export const BASE_LOCALE = 'en-US';

export interface FlatEntry {
  key: string;
  value: string;
}

/** Flattens a parsed locale JSON into its leaf entries (dot-delimited keys). */
export function flattenEntries(json: Record<string, unknown>, prefix = '', out: FlatEntry[] = []): FlatEntry[] {
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

export function loadLocale(fileName: string): { entries: FlatEntry[]; keys: Set<string>; raw: Record<string, unknown> } {
  const raw = JSON.parse(readFileSync(path.join(LOCALES_DIR, fileName), 'utf8')) as Record<string, unknown>;
  const entries = flattenEntries(raw);
  return { entries, keys: new Set(entries.map((e) => e.key)), raw };
}

export const baseLocale = loadLocale(`${BASE_LOCALE}.json`);

/**
 * Every translation key the app can render, derived from the reference
 * locale. Key parity is asserted separately by the integrity test, so this set
 * is authoritative for the whole corpus once that test has run.
 */
export const TRANSLATION_KEYS = baseLocale.keys;

/** Matches any `{{token}}` surrogate that survived interpolation. */
export const RAW_TOKEN_PATTERN = /\{\{[^}]*\}\}/;

/** Every dotted leaf key, escaped and joined into one matcher. */
export const LEAKED_KEY_PATTERN = new RegExp(
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
export function rawKeysInBody(root: HTMLElement): string[] {
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

/** A single passable integrity rule, per value. */
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
 * no value that is just its own key, and well-formed interpolation tokens.
 * Returns a list of problems (empty = healthy).
 */
export function assertLocaleIntegrity(fileName: string, entries: FlatEntry[], keys: Set<string>): string[] {
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
