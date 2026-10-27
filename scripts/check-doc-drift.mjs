#!/usr/bin/env node
/**
 * @fileoverview Documentation drift checker CLI.
 *
 * Recomputes numeric facts from the application source tree and verifies that
 * every `<!-- drift:<key>=<value> -->` marker found in the documentation trees
 * still matches the computed value.
 *
 * Usage:
 *   node scripts/check-doc-drift.mjs                 # verify marked claims
 *   node scripts/check-doc-drift.mjs --report-missing # list unmarked files
 *   node scripts/check-doc-drift.mjs --strict         # also fail on unmarked files
 *   node scripts/check-doc-drift.mjs --facts          # print computed facts
 */
import fs from 'fs';
import path from 'path';
import { checkFile, collectDocFiles, computeFacts } from './lib/doc-drift.mjs';

const ROOT = process.cwd();

function main() {
  const args = new Set(process.argv.slice(2));
  const facts = computeFacts(ROOT);

  if (args.has('--facts')) {
    for (const [key, value] of Object.entries(facts)) {
      console.log(`${key}=${value}`);
    }
    return 0;
  }

  const docFiles = collectDocFiles(ROOT);
  const failures = [];
  const unmarked = [];
  let markerCount = 0;

  for (const { file, label } of docFiles) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const result = checkFile(file, source, facts);
    markerCount += result.markerCount;
    for (const failure of result.failures) {
      failures.push({ file, label, ...failure });
    }
    if (result.markerCount === 0) unmarked.push({ file, label });
  }

  console.log(`[doc-drift] facts: ${Object.keys(facts).length}, doc files: ${docFiles.length}, markers: ${markerCount}`);

  if (failures.length) {
    console.error(`\n[doc-drift] ${failures.length} drift failure(s):`);
    for (const failure of failures) {
      const expected = failure.expected !== undefined ? `expected ${failure.expected}` : failure.reason;
      console.error(`  ${failure.file}  <!-- drift:${failure.key}=${failure.value} -->  (${expected})`);
    }
  }

  if (args.has('--report-missing')) {
    console.log(`\n[doc-drift] ${unmarked.length} file(s) without drift markers:`);
    for (const entry of unmarked) console.log(`  ${entry.file}`);
  }

  if (args.has('--strict') && unmarked.length) {
    console.error(`\n[doc-drift] strict mode: ${unmarked.length} file(s) missing markers.`);
    return 1;
  }

  return failures.length ? 1 : 0;
}

process.exit(main());
