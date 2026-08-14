import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.resolve(process.cwd(), 'src/renderer/i18n/locales');
const BASE_LOCALE = 'en-US';

function flattenKeys(value, prefix, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    keys.add(prefix);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    flattenKeys(child, prefix ? `${prefix}.${key}` : key, keys);
  }
}

function loadLocale(fileName) {
  const filePath = path.join(LOCALES_DIR, fileName);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`[ERROR] ${fileName}: failed to read/parse JSON (${error.message})`);
  }
  const keys = new Set();
  flattenKeys(parsed, '', keys);
  return { fileName, keys };
}

if (!fs.existsSync(LOCALES_DIR)) {
  console.error(`[ERROR] Locales directory not found: ${LOCALES_DIR}`);
  process.exit(1);
}

const files = fs
  .readdirSync(LOCALES_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();

if (files.length === 0) {
  console.error(`[ERROR] No locale files found in ${LOCALES_DIR}`);
  process.exit(1);
}

const baseFile = `${BASE_LOCALE}.json`;
if (!files.includes(baseFile)) {
  console.error(`[ERROR] Base locale file missing: ${baseFile}`);
  process.exit(1);
}

let base;
try {
  base = loadLocale(baseFile);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const failures = [];

for (const fileName of files) {
  if (fileName === baseFile) continue;

  let locale;
  try {
    locale = loadLocale(fileName);
  } catch (error) {
    failures.push({ fileName, message: error.message });
    continue;
  }

  const missing = [...base.keys].filter((key) => !locale.keys.has(key));
  const extra = [...locale.keys].filter((key) => !base.keys.has(key));

  if (missing.length === 0 && extra.length === 0) continue;

  const messages = [];
  if (missing.length > 0) {
    messages.push(`${missing.length} missing key(s): ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    messages.push(`${extra.length} extra key(s): ${extra.join(', ')}`);
  }
  failures.push({ fileName, message: `[FAIL] ${fileName}: ${messages.join('; ')}` });
}

if (failures.length > 0) {
  console.error(`Locale validation failed for ${failures.length} locale(s):`);
  for (const failure of failures) {
    console.error(failure.message);
  }
  process.exit(1);
}

console.log(`Locale validation passed: ${files.length - 1} locale(s) match ${BASE_LOCALE} key parity`);
