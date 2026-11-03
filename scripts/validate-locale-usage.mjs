/**
 * @fileoverview Locale parity and usage validator.
 *
 * Two checks run over the renderer translations:
 *
 *   1. Key parity - every locale file in `src/renderer/i18n/locales` must expose
 *      exactly the same flattened key set as `en-US.json` (no missing keys, no
 *      extras, so the key count matches too).
 *   2. Key usage - every key in `en-US.json` must be referenced from the
 *      TypeScript sources under `src/`. A key counts as used when its full
 *      dotted string appears as a string literal, when it is produced by a
 *      `t(\`ns.${value}\`)` template (each interpolation matches one segment),
 *      or when it is the value of a `*Key` property (e.g. `labelKey`). Keys
 *      that survived a copy/paste refactor but are no longer rendered are
 *      reported as unused.
 *
 * The inverse is checked too: literal keys passed to `t(...)` (and `*Key`
 * properties) that do not exist in `en-US.json` are reported as unknown, which
 * catches typos that would render the raw key at runtime.
 *
 * The scan is static by design: it never boots the renderer, so it is fast and
 * safe to run in CI. It is also conservative - it would rather call a key used
 * (via a template pattern) than emit a false "unused", so keys referenced only
 * through opaque helper indirection may be missed. In exchange, a key reported
 * unused is a strong signal.
 *
 * Usage:
 *   npm run validate:locale-usage            # strict, exits 1 on any finding
 *   npm run validate:locale-usage:fix        # prune the unused keys, then re-check
 *   node scripts/validate-locale-usage.mjs --warn-unused   # report unused, still exit 0
 *   node scripts/validate-locale-usage.mjs --include-tests # also scan test files
 *   node scripts/validate-locale-usage.mjs --verbose      # list dynamic-only matches
 *
 * Note: npm swallows a bare `--fix` (`npm run x --fix` is parsed as an npm
 * config), so use the dedicated `validate:locale-usage:fix` script or
 * `npm run validate:locale-usage -- --fix`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'renderer', 'i18n', 'locales');
const TABLE_DIR = path.join(ROOT, 'scripts', 'locale-data');
const SOURCE_DIR = path.join(ROOT, 'src');
const BASE_LOCALE = 'en-US';
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

/**
 * Property names whose string value is an i18n key even when it is not passed
 * straight to `t()` (the render site uses `t(spec.labelKey)` instead).
 * @const {ReadonlySet<string>}
 */
const KEY_PROPERTIES = new Set(['i18nKey', 'labelKey', 'hintKey', 'titleKey', 'descriptionKey', 'nameKey', 'messageKey']);

/**
 * Flattens a parsed locale object into dotted leaf keys.
 * @param {unknown} value - Parsed JSON value.
 * @param {string} [prefix] - Dotted path accumulated so far.
 * @param {Set<string>} [out] - Collector, returned for convenience.
 * @returns {Set<string>} The dotted leaf keys.
 */
export function flattenKeys(value, prefix = '', out = new Set()) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) out.add(prefix);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    flattenKeys(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

/**
 * Reads a locale JSON file and flattens its keys.
 * @param {string} filePath - Absolute path to the locale file.
 * @returns {{ file: string, json: object, keys: Set<string> }} Parsed locale.
 */
export function loadLocale(filePath) {
  const file = path.basename(filePath);
  let json;
  try {
    json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${file}: failed to read/parse JSON (${error.message})`);
  }
  return { file, json, keys: flattenKeys(json) };
}

/**
 * Lists the TypeScript sources worth scanning for translation keys.
 * @param {string} dir - Directory to walk.
 * @param {{ includeTests?: boolean }} [options] - Whether to include test files.
 * @param {string[]} [out] - Collector, returned for convenience.
 * @returns {string[]} Absolute file paths.
 */
export function collectSourceFiles(dir, { includeTests = false } = {}, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'locales', '__mocks__'].includes(entry.name)) continue;
      if (!includeTests && (entry.name === '__tests__' || entry.name === 'test-utils')) continue;
      collectSourceFiles(entryPath, { includeTests }, out);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    // `src/test-setup.ts` mirrors a handful of keys for the i18n mock; counting
    // that dictionary would hide keys the app itself never asks for.
    if (!includeTests && (entry.name === 'test-setup.ts' || /\.(test|spec)\./.test(entry.name))) continue;
    out.push(entryPath);
  }
  return out;
}

/**
 * Escapes a literal fragment for embedding in a regular expression.
 * @param {string} value - Raw fragment.
 * @returns {string} Escaped fragment.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a conservative key matcher from a template literal. Every
 * interpolation stands in for exactly one dotted segment (`[^.]+`), which is
 * how this codebase composes keys (`nav.${id}`, `mediaInfo.tagKeys.${key}`).
 * Templates without a namespaced static head are ignored: a bare
 * `${namespace}.${id}` would otherwise match every key in the corpus.
 * @param {import('typescript').TemplateExpression} node - Template node.
 * @returns {string|null} Anchored regular-expression source, or null.
 */
export function templatePattern(node) {
  const head = node.head.text;
  if (head === '' || !head.includes('.')) return null;
  let pattern = escapeRegExp(head);
  for (const span of node.templateSpans) {
    pattern += '[^.]+';
    pattern += escapeRegExp(span.literal.text);
  }
  if (/\s/.test(pattern)) return null;
  return pattern;
}

/**
 * Returns true when a call expression looks like a translation lookup.
 * @param {import('typescript').CallExpression} node - Call node.
 * @returns {boolean} Whether the callee is `t` or `<something>.t`.
 */
function isTranslationCall(node) {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text === 't';
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text === 't';
  return false;
}

/**
 * Extracts usage evidence from one parsed source file.
 * @param {import('typescript').SourceFile} sourceFile - Parsed file.
 * @param {{ literals: Set<string>, patterns: Set<string>, referenced: Set<string> }} usage - Collectors.
 * @returns {void}
 */
function collectFromSourceFile(sourceFile, usage) {
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      usage.literals.add(node.text);
    } else if (ts.isTemplateExpression(node)) {
      const pattern = templatePattern(node);
      if (pattern) usage.patterns.add(pattern);
    }

    if (ts.isCallExpression(node) && isTranslationCall(node)) {
      const [first] = node.arguments;
      if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
        usage.referenced.add(first.text);
      }
    }

    if (ts.isPropertyAssignment(node) && KEY_PROPERTIES.has(node.name.getText(sourceFile))) {
      const initializer = node.initializer;
      // Some `*Key` props hold a single namespace segment that a template
      // completes later (`i18nKey: 'copilot'` -> `gettingStarted.goals.copilot`),
      // so only fully-dotted values are treated as standalone keys.
      if ((ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) && initializer.text.includes('.')) {
        usage.referenced.add(initializer.text);
      }
    }

    if (ts.isJsxAttribute(node) && KEY_PROPERTIES.has(node.name.getText(sourceFile))) {
      const initializer = node.initializer;
      if (initializer && ts.isStringLiteral(initializer) && initializer.text.includes('.')) {
        usage.referenced.add(initializer.text);
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

/**
 * Parses source text and collects translation usage evidence.
 * @param {string} text - File contents.
 * @param {string} fileName - File name, used to pick the TS/TSX script kind.
 * @param {{ literals: Set<string>, patterns: Set<string>, referenced: Set<string> }} [usage] - Collector.
 * @returns {{ literals: Set<string>, patterns: Set<string>, referenced: Set<string> }} Usage evidence.
 */
export function extractUsage(text, fileName, usage = newUsage()) {
  const scriptKind = path.extname(fileName) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKind);
  collectFromSourceFile(sourceFile, usage);
  return usage;
}

/**
 * Creates an empty usage collector.
 * @returns {{ literals: Set<string>, patterns: Set<string>, referenced: Set<string> }} Empty collector.
 */
export function newUsage() {
  return { literals: new Set(), patterns: new Set(), referenced: new Set() };
}

/**
 * Collects usage evidence from every source file under `dir`.
 * @param {string[]} files - Absolute source paths.
 * @returns {{ literals: Set<string>, patterns: Set<string>, referenced: Set<string> }} Usage evidence.
 */
export function collectUsage(files) {
  const usage = newUsage();
  for (const file of files) {
    extractUsage(fs.readFileSync(file, 'utf8'), file, usage);
  }
  return usage;
}

/**
 * Matches keys against the collected usage evidence.
 * @param {Iterable<string>} keys - Keys to classify.
 * @param {{ literals: Set<string>, patterns: Set<string> }} usage - Usage evidence.
 * @returns {Map<string, 'literal'|'dynamic'>} Where each key was found.
 */
export function matchKeys(keys, usage) {
  const matchers = [...usage.patterns].map((pattern) => new RegExp(`^${pattern}$`));
  const matched = new Map();
  for (const key of keys) {
    if (usage.literals.has(key)) {
      matched.set(key, 'literal');
      continue;
    }
    if (matchers.some((matcher) => matcher.test(key))) matched.set(key, 'dynamic');
  }
  return matched;
}

/**
 * Returns the keys that no source file references.
 * @param {Iterable<string>} keys - Keys to test.
 * @param {{ literals: Set<string>, patterns: Set<string> }} usage - Usage evidence.
 * @returns {string[]} Sorted unused keys.
 */
export function findUnusedKeys(keys, usage) {
  const matched = matchKeys(keys, usage);
  return [...keys].filter((key) => !matched.has(key)).sort();
}

/**
 * Returns literal keys referenced from `t(...)`/`*Key` properties that do not
 * exist in the base locale.
 * @param {Iterable<string>} referenced - Literal keys found at translation sites.
 * @param {Set<string>} keys - Base locale keys.
 * @returns {string[]} Sorted unknown keys.
 */
export function findUnknownKeys(referenced, keys) {
  return [...referenced].filter((key) => !keys.has(key)).sort();
}

/**
 * Compares one locale's key set with the base locale's.
 * @param {Set<string>} baseKeys - Base locale keys.
 * @param {Set<string>} localeKeys - Locale keys.
 * @returns {{ missing: string[], extra: string[] }} Sorted differences.
 */
export function compareKeys(baseKeys, localeKeys) {
  return {
    missing: [...baseKeys].filter((key) => !localeKeys.has(key)).sort(),
    extra: [...localeKeys].filter((key) => !baseKeys.has(key)).sort(),
  };
}

/**
 * Deletes a dotted path from a locale object, ignoring paths that do not exist.
 * @param {object} json - Parsed locale, mutated in place.
 * @param {string} dottedKey - Key path to delete.
 * @returns {boolean} Whether anything was removed.
 */
export function deleteKeyPath(json, dottedKey) {
  const parts = dottedKey.split('.');
  let cursor = json;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor = cursor?.[parts[index]];
    if (cursor === null || typeof cursor !== 'object') return false;
  }
  const leaf = parts[parts.length - 1];
  if (!Object.prototype.hasOwnProperty.call(cursor, leaf)) return false;
  delete cursor[leaf];
  return true;
}

/**
 * Removes newly-empty namespaces left behind after pruning.
 * @param {object} json - Parsed locale, mutated in place.
 * @returns {void}
 */
function pruneEmptyObjects(json) {
  for (const [key, value] of Object.entries(json)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      pruneEmptyObjects(value);
      if (Object.keys(value).length === 0) delete json[key];
    }
  }
}

/**
 * Removes every unused key from every locale file.
 * @param {Array<{ file: string, json: object }>} locales - Loaded locales.
 * @param {string[]} unusedKeys - Keys to drop.
 * @param {string} [localesDir] - Directory to write into (overridable for tests).
 * @returns {number} Number of files rewritten.
 */
export function pruneUnusedKeys(locales, unusedKeys, localesDir = LOCALES_DIR) {
  let rewritten = 0;
  for (const locale of locales) {
    let removed = 0;
    for (const key of unusedKeys) {
      if (deleteKeyPath(locale.json, key)) removed += 1;
    }
    if (removed === 0) continue;
    pruneEmptyObjects(locale.json);
    fs.writeFileSync(path.join(localesDir, locale.file), `${JSON.stringify(locale.json, null, 2)}\n`, 'utf8');
    console.log(`[${locale.file}] removed ${removed} unused key(s)`);
    rewritten += 1;
  }
  return rewritten;
}

/**
 * Removes unused keys from the hand-written backfill tables in
 * `scripts/locale-data`. Those tables are flat dotted-key maps consumed by
 * `scripts/locale-backfill.mjs`, which rejects keys that no longer exist in
 * `en-US.json` - so pruning the locales has to prune the tables too.
 * @param {string[]} unusedKeys - Keys to drop.
 * @param {string} [tableDir] - Table directory (overridable for tests).
 * @returns {number} Number of tables rewritten.
 */
export function pruneTableKeys(unusedKeys, tableDir = TABLE_DIR) {
  if (!fs.existsSync(tableDir)) return 0;
  let rewritten = 0;
  for (const name of fs.readdirSync(tableDir).sort()) {
    if (!name.endsWith('.json') || name === 'manifest.json') continue;
    const filePath = path.join(tableDir, name);
    let table;
    try {
      table = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`locale-data/${name}: failed to parse JSON (${error.message})`);
    }
    let removed = 0;
    for (const key of unusedKeys) {
      if (Object.prototype.hasOwnProperty.call(table, key)) {
        delete table[key];
        removed += 1;
      }
    }
    if (removed === 0) continue;
    fs.writeFileSync(filePath, `${JSON.stringify(table, null, 2)}\n`, 'utf8');
    console.log(`[locale-data/${name}] removed ${removed} unused key(s)`);
    rewritten += 1;
  }
  return rewritten;
}

/**
 * Groups keys by their first dotted segment for a compact report.
 * @param {string[]} keys - Sorted keys.
 * @returns {Array<[string, string[]]>} Namespace groups.
 */
function groupByNamespace(keys) {
  const groups = new Map();
  for (const key of keys) {
    const namespace = key.split('.')[0];
    if (!groups.has(namespace)) groups.set(namespace, []);
    groups.get(namespace).push(key);
  }
  return [...groups.entries()];
}

/**
 * Runs the validation, prints the report and exits non-zero on findings.
 * @returns {void}
 */
function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    console.log('Usage: node scripts/validate-locale-usage.mjs [--warn-unused] [--include-tests] [--verbose] [--fix]');
    return;
  }
  const includeTests = args.has('--include-tests');
  const warnUnused = args.has('--warn-unused');
  const verbose = args.has('--verbose');
  const fix = args.has('--fix');

  const localeFiles = fs
    .readdirSync(LOCALES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();
  if (!localeFiles.includes(`${BASE_LOCALE}.json`)) {
    console.error(`[ERROR] Base locale file missing: ${BASE_LOCALE}.json`);
    process.exit(1);
  }

  const locales = localeFiles.map((name) => loadLocale(path.join(LOCALES_DIR, name)));
  const base = locales.find((locale) => locale.file === `${BASE_LOCALE}.json`);
  const sourceFiles = collectSourceFiles(SOURCE_DIR, { includeTests });
  const usage = collectUsage(sourceFiles);
  let baseKeys = base.keys;
  let matched = matchKeys(baseKeys, usage);
  let unused = findUnusedKeys(baseKeys, usage);
  let unknown = findUnknownKeys(usage.referenced, baseKeys);

  if (fix) {
    if (unused.length === 0) {
      console.log('No unused keys to prune.');
    } else {
      console.log(`Pruning ${unused.length} unused key(s) from ${locales.length} locale file(s)...`);
      pruneUnusedKeys(locales, unused);
      pruneTableKeys(unused);
      for (const locale of locales) locale.keys = flattenKeys(locale.json);
      baseKeys = flattenKeys(base.json);
      matched = matchKeys(baseKeys, usage);
      unused = findUnusedKeys(baseKeys, usage);
      unknown = findUnknownKeys(usage.referenced, baseKeys);
    }
  }

  const parityFailures = [];
  for (const locale of locales) {
    if (locale.file === `${BASE_LOCALE}.json`) continue;
    const { missing, extra } = compareKeys(baseKeys, locale.keys);
    if (missing.length > 0 || extra.length > 0) {
      parityFailures.push({ file: locale.file, count: locale.keys.size, missing, extra });
    }
  }

  console.log('Locale usage validation');
  console.log(`  locales:            ${locales.length} (${locales.length - 1} compared with ${BASE_LOCALE})`);
  console.log(`  base keys:          ${baseKeys.size}`);
  console.log(`  source files:       ${sourceFiles.length}${includeTests ? '' : ' (tests excluded)'}`);
  console.log(`  keys with a match:  ${matched.size}`);
  console.log(`  unused keys:        ${unused.length}`);
  console.log(`  unknown keys:       ${unknown.length}`);

  if (verbose) {
    const dynamicOnly = [...matched.entries()].filter(([, kind]) => kind === 'dynamic').map(([key]) => key);
    console.log(`  dynamic-only:       ${dynamicOnly.length}`);
    for (const key of dynamicOnly.sort()) console.log(`    ${key}`);
  }

  if (parityFailures.length > 0) {
    console.log(`\nKey parity FAILED (${parityFailures.length} locale file(s))`);
    for (const failure of parityFailures) {
      const parts = [`${failure.count} keys`];
      if (failure.missing.length > 0) parts.push(`missing: ${failure.missing.join(', ')}`);
      if (failure.extra.length > 0) parts.push(`extra: ${failure.extra.join(', ')}`);
      console.log(`  ${failure.file}: ${parts.join('; ')}`);
    }
  } else {
    console.log(`\nKey parity OK: all ${locales.length} locale files expose the same ${baseKeys.size} keys as ${BASE_LOCALE}.`);
  }

  if (unused.length > 0) {
    console.log(`\nUnused ${BASE_LOCALE} keys (${unused.length}) - run with --fix to prune them:`);
    for (const [namespace, keys] of groupByNamespace(unused)) {
      console.log(`  ${namespace} (${keys.length})`);
      for (const key of keys) console.log(`    ${key}`);
    }
  }

  if (unknown.length > 0) {
    console.log(`\nKeys referenced in source but missing from ${BASE_LOCALE} (${unknown.length}):`);
    for (const key of unknown) console.log(`  ${key}`);
  }

  const failed = parityFailures.length > 0 || unknown.length > 0 || (unused.length > 0 && !warnUnused);
  if (failed) {
    console.log('\nLocale usage validation FAILED.');
    process.exit(1);
  }
  console.log('\nLocale usage validation passed.');
}

const isMain =
  import.meta.main ??
  (process.argv[1] !== undefined && new URL(process.argv[1], 'file://').pathname === fileURLToPath(import.meta.url).replace(/\\/g, '/'));

if (isMain) {
  main();
}
