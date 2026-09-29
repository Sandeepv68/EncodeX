/**
 * @fileoverview Applies hand-written translations from the flat per-group tables in
 * `scripts/locale-data/<table>.json` (grouped by `manifest.json`) into the locale JSON
 * files, and reports remaining untranslated keys.
 *
 * The locale files are the source of truth for the renderer; this script is the
 * same pattern as `update-translations.mjs` (script-driven bulk edits) but is
 * incremental: it only writes keys that are currently identical to the en-US
 * value, so it can never clobber a translation that a human already made.
 *
 * Usage:
 *   node scripts/locale-backfill.mjs            # apply + report
 *   node scripts/locale-backfill.mjs --check    # report only, no writes
 *   node scripts/locale-backfill.mjs --locales de-DE,fr-FR
 *   node scripts/locale-backfill.mjs --audit    # validate every table, no writes
 *
 * @module scripts/locale-backfill
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'renderer', 'i18n', 'locales');
const DATA_DIR = join(__dirname, 'locale-data');
const MANIFEST_PATH = join(DATA_DIR, 'manifest.json');

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const auditOnly = argv.includes('--audit');
const localeArg = argv[argv.indexOf('--locales') + 1];
const onlyLocales = localeArg && !localeArg.startsWith('--') ? new Set(localeArg.split(',')) : null;

/**
 * Flattens a nested locale object into dotted keys.
 * @param {Record<string, unknown>} obj - Nested locale object.
 * @param {string} [prefix] - Dotted key prefix.
 * @returns {Record<string, string>} Flat map of dotted key to string value.
 */
function flat(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flat(v, key, out);
    else out[key] = v;
  }
  return out;
}

/**
 * Writes a value into a nested object by dotted key path.
 * @param {Record<string, unknown>} obj - Target object, mutated in place.
 * @param {string} dottedKey - Dotted key path.
 * @param {string} value - Value to assign.
 * @returns {void}
 */
function setNested(obj, dottedKey, value) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') return;
    if (!Object.prototype.hasOwnProperty.call(cur, part) || typeof cur[part] !== 'object') cur[part] = {};
    cur = cur[part];
  }
  const last = parts[parts.length - 1];
  if (last === '__proto__' || last === 'constructor' || last === 'prototype') return;
  cur[last] = value;
}

const { groups = {} } = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

/**
 * Loads every `<table>.json` flat translation file in the data directory.
 * @returns {Record<string, Record<string, string>>} Table name to key/value map.
 */
function loadTables() {
  const tables = {};
  for (const file of readdirSync(DATA_DIR)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue;
    tables[file.replace('.json', '')] = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
  }
  return tables;
}

const en = JSON.parse(readFileSync(join(LOCALES_DIR, 'en-US.json'), 'utf8'));
const enFlat = flat(en);

/**
 * Collects the `{{placeholder}}` names used in a string.
 * @param {string} value - Source or translated string.
 * @returns {string[]} Sorted list of placeholder names.
 */
function placeholdersOf(value) {
  return [...new Set([...String(value).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))].sort();
}

/**
 * Validates every hand-written table without writing anything: unknown keys,
 * placeholder drift, untranslated-looking leftovers, and mojibake.
 * @param {Record<string, Record<string, string>>} tables - Loaded tables.
 * @param {Record<string, string>} enFlat - Flattened en-US source strings.
 * @returns {number} Total number of problems found.
 */
function auditTables(tables, enFlat) {
  let problems = 0;
  /**
   * @param {string} table - Table name, for the report.
   * @param {string} key - Offending key.
   * @param {string} msg - Problem description.
   */
  const fail = (table, key, msg) => {
    console.log(`  FAIL ${table} :: ${key} :: ${msg}`);
    problems++;
  };

  // Keys that legitimately match the English source (product names, log levels).
  const allowIdentical = new Set([
    'app.name',
    'logs.levelAll',
    'logs.levelDebug',
    'logs.levelError',
    'logs.levelInfo',
    'logs.levelWarn',
    'mediaInfo.codec',
    'mediaInfo.file',
    'mediaInfo.stream',
    'nav.audio',
    'nav.demux',
    'nav.image',
    'nav.remux',
    'about.copyright',
    'batchQueue.operationDemux',
    'batchQueue.operationRemux',
    'shortcuts.sections.demux',
    'shortcuts.sections.logs',
    'shortcuts.sections.remux',
    'status.auto',
  ]);

  for (const [name, table] of Object.entries(tables).sort()) {
    const keys = Object.keys(table);
    const unknown = keys.filter((k) => !(k in enFlat));
    // Mojibake / replacement characters and stray latin words glued into CJK text.
    const badChars = keys.filter((k) => /[\uFFFD\u0000-\u0008]/.test(table[k]));
    const placeholderDrift = keys.filter((k) => {
      if (!(k in enFlat)) return false;
      const want = placeholdersOf(enFlat[k]).join(',');
      const got = placeholdersOf(table[k]).join(',');
      return want !== got;
    });
    const identical = keys.filter((k) => inTableIdentical(k, table, enFlat) && !allowIdentical.has(k));
    const notStrings = keys.filter((k) => typeof table[k] !== 'string');
    const empty = keys.filter((k) => !String(table[k]).trim());
    // Unintended leading/trailing whitespace renders as a visible gap in the UI.
    const padded = keys.filter((k) => typeof table[k] === 'string' && /^\s|\s$/.test(table[k]));

    for (const k of unknown) fail(name, k, 'key does not exist in en-US');
    for (const k of badChars) fail(name, k, `contains replacement/control character: ${JSON.stringify(table[k])}`);
    for (const k of notStrings) fail(name, k, `value is not a string (${typeof table[k]})`);
    for (const k of empty) fail(name, k, 'value is empty or whitespace');
    for (const k of padded) fail(name, k, `value has leading/trailing whitespace: ${JSON.stringify(table[k])}`);
    for (const k of placeholderDrift) {
      fail(name, k, `placeholder drift: expected [${placeholdersOf(enFlat[k])}] got [${placeholdersOf(table[k])}]`);
    }
    for (const k of identical) {
      console.log(`  WARN ${name} :: ${k} :: value is byte-identical to en-US (${JSON.stringify(table[k])})`);
    }
    const missing = Object.keys(enFlat).filter((k) => !(k in table)).length;
    console.log(
      `  ${name.padEnd(8)} keys=${String(keys.length).padStart(4)} missingFromTable=${String(missing).padStart(4)}` +
        ` locales=${(groups[name] ?? []).join(',')}`,
    );
  }
  return problems;
}

/**
 * Checks whether a table entry is character-for-character the English source.
 * @param {string} key - Dotted key.
 * @param {Record<string, string>} table - Flat table map.
 * @param {Record<string, string>} enFlat - Flattened en-US strings.
 * @returns {boolean} True when the value equals the English source.
 */
function inTableIdentical(key, table, enFlat) {
  return key in enFlat && table[key] === enFlat[key];
}

const tables = loadTables();
if (auditOnly) {
  const problems = auditTables(tables, enFlat);
  console.log(`\nAudit finished: ${problems} problem(s).`);
  process.exit(problems > 0 ? 1 : 0);
}

// locale file -> table name
const localeToTable = {};
for (const [table, locales] of Object.entries(groups)) {
  for (const loc of locales) localeToTable[loc] = table;
}

const files = readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'en-US.json' && !f.startsWith('en-'))
  .sort()
  .filter((f) => !onlyLocales || onlyLocales.has(f.replace('.json', '')));

const perLocale = [];
let writes = 0;

for (const file of files) {
  const locale = file.replace('.json', '');
  const table = tables[localeToTable[locale] ?? locale];
  const filePath = join(LOCALES_DIR, file);
  const data2 = JSON.parse(readFileSync(filePath, 'utf8'));
  const flatBefore = flat(data2);

  let applied = 0;
  if (table) {
    for (const [key, value] of Object.entries(table)) {
      // Only fill keys that are still the English source string.
      if (flatBefore[key] !== enFlat[key]) continue;
      if (!(key in enFlat)) {
        console.warn(`  !! ${locale}: key not present in en-US, skipped: ${key}`);
        continue;
      }
      setNested(data2, key, value);
      applied++;
    }
  }
  writes += applied;

  if (!checkOnly && applied > 0) writeFileSync(filePath, JSON.stringify(data2, null, 2) + '\n', 'utf8');

  // recount remaining English after applying. A table entry whose translation is
  // intentionally identical to the source (product names like "Remux", log level
  // names like "ERROR") counts as covered, not as untranslated work.
  const flatAfter = flat(JSON.parse(readFileSync(filePath, 'utf8')));
  const covered = new Set(table ? Object.keys(table) : []);
  const remaining = Object.keys(enFlat).filter((k) => flatAfter[k] === enFlat[k] && !covered.has(k)).length;
  perLocale.push({ locale, applied, remaining, hasTable: !!table });
}

if (!checkOnly) {
  console.log(`Applied ${writes} key(s).\n`);
}
console.log('locale     table            applied  remaining');
for (const r of perLocale) {
  const flag = r.hasTable ? '' : '  (no table)';
  console.log(
    `${r.locale.padEnd(11)}${(localeToTable[r.locale] ?? r.locale).padEnd(17)}${String(r.applied).padStart(7)}${String(r.remaining).padStart(10)}${flag}`,
  );
}
const totalRemaining = perLocale.reduce((a, r) => a + r.remaining, 0);
console.log(`\nTotal remaining English keys across ${perLocale.length} locales: ${totalRemaining}`);
