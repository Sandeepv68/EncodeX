#!/usr/bin/env node
/**
 * @fileoverview Fills missing translation keys in every locale from the base
 * locale (`en-US.json`).
 *
 * Feature work adds UI strings to `en-US.json` first; this script propagates the
 * new keys to the other locale files so `npm run validate:locales` (exact key
 * parity) stays green and i18next never falls back to en-US mid-UI.
 *
 * Behavior:
 *  - Missing leaves are added with the **English** value as a best-effort
 *    placeholder. Never overwrites an existing translation, so it is safe to
 *    re-run after translating some strings.
 *  - A missing key is inserted at the position it occupies in `en-US.json`
 *    relative to its existing siblings, so the new sections land where the base
 *    file has them instead of drifting to the end of the file.
 *  - Stray keys (present in a locale but not in `en-US`) are reported and exit
 *    non-zero; removing them is a manual decision, not a silent deletion.
 *  - `--dry-run` reports what would change without writing.
 *
 * Usage:
 *   node scripts/sync-locale-keys.mjs [--dry-run] [--locale <code>]
 */

import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.resolve(process.cwd(), 'src/renderer/i18n/locales');
const BASE_LOCALE = 'en-US';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const localeIndex = argv.indexOf('--locale');
const only = localeIndex >= 0 ? argv[localeIndex + 1] : null;

/**
 * Reads a locale file.
 * @param {string} file - File name inside the locales directory.
 * @returns {object} The parsed locale object.
 */
function readLocale(file) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8'));
}

/**
 * Whether a value is a nested namespace (object) rather than a leaf string.
 * @param {unknown} value - The value to test.
 * @returns {boolean} True for plain objects.
 */
function isNamespace(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Lists the leaf key paths of a locale object.
 * @param {object} source - The locale object.
 * @param {string} [prefix] - Current key path prefix.
 * @returns {string[]} Dot-separated leaf paths.
 */
function leafKeys(source, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(source)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (isNamespace(value)) keys.push(...leafKeys(value, full));
    else keys.push(full);
  }
  return keys;
}

/**
 * Merges the namespaces of `source` into `target`, adding only the keys that
 * `target` lacks. Sibling order follows `source` so new keys keep the base
 * file's ordering.
 * @param {object} target - The locale object (mutated).
 * @param {object} source - The base namespace.
 * @returns {number} How many leaves were added.
 */
function mergeNamespace(target, source) {
  let added = 0;
  const existing = new Set(Object.keys(target));
  for (const [key, value] of Object.entries(source)) {
    // Block prototype-polluting names (`__proto__`, `constructor.prototype`, ...).
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (isNamespace(value)) {
      if (!isNamespace(target[key])) {
        target[key] = {};
        existing.add(key);
      }
      added += mergeNamespace(target[key], value);
      continue;
    }
    if (existing.has(key)) continue;
    target[key] = value;
    existing.add(key);
    added += 1;
  }
  return added;
}

/**
 * Serializes a locale the way the files are stored: 2-space indent, LF, final
 * newline.
 * @param {object} value - The locale object.
 * @returns {string} The file contents.
 */
function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

if (!fs.existsSync(LOCALES_DIR)) {
  console.error(`[ERROR] Locales directory not found: ${LOCALES_DIR}`);
  process.exit(1);
}

const baseFile = `${BASE_LOCALE}.json`;
if (!fs.existsSync(path.join(LOCALES_DIR, baseFile))) {
  console.error(`[ERROR] Base locale file missing: ${baseFile}`);
  process.exit(1);
}

const base = readLocale(baseFile);
const baseKeys = new Set(leafKeys(base));

const files = fs
  .readdirSync(LOCALES_DIR)
  .filter((name) => name.endsWith('.json') && name !== baseFile)
  .filter((name) => (only ? name === `${only}.json` : true))
  .sort();

if (files.length === 0) {
  console.error(`[ERROR] No target locale files matched${only ? ` "${only}"` : ''}.`);
  process.exit(1);
}

let touched = 0;
const strays = [];

for (const file of files) {
  const locale = readLocale(file);
  const added = mergeNamespace(locale, base);
  const extra = leafKeys(locale).filter((key) => !baseKeys.has(key));
  if (extra.length > 0) strays.push({ file, extra });

  if (added === 0) continue;
  touched += 1;
  const label = dryRun ? 'would add' : 'added';
  console.log(`[${file}] ${label} ${added} key(s) from ${BASE_LOCALE}`);
  if (!dryRun) {
    fs.writeFileSync(path.join(LOCALES_DIR, file), serialize(locale), 'utf8');
  }
}

if (strays.length > 0) {
  console.error(`\n[ERROR] ${strays.length} locale(s) have keys missing from ${BASE_LOCALE}:`);
  for (const { file, extra } of strays) {
    console.error(`  ${file}: ${extra.join(', ')}`);
  }
  process.exit(1);
}

console.log(
  dryRun
    ? `[sync-locale-keys] dry run: ${touched} of ${files.length} locale(s) would change.`
    : `[sync-locale-keys] ${touched} of ${files.length} locale(s) updated; ${files.length - touched} already complete.`,
);
