#!/usr/bin/env node
/**
 * @fileoverview Rewrites the `<!-- drift:key=value -->` markers in the
 * documentation trees with the values recomputed from the source tree.
 */
import fs from 'fs';
import path from 'path';
import { collectDocFiles, computeFacts } from './lib/doc-drift.mjs';

const ROOT = process.cwd();
const facts = computeFacts(ROOT);
const files = collectDocFiles(ROOT);
let changed = 0;

for (const { file } of files) {
  const full = path.join(ROOT, file);
  const source = fs.readFileSync(full, 'utf8');
  let touched = false;
  const updated = source.replace(/<!--\s*drift:([^>]*?)-->/g, (marker, body) => {
    const tokens = body.trim().split(/\s+/).filter(Boolean);
    const next = tokens.map((token) => {
      const sep = token.indexOf('=');
      if (sep === -1) return token;
      const key = token.slice(0, sep);
      const value = token.slice(sep + 1);
      if (!(key in facts) || facts[key] === null) return token;
      if (String(facts[key]) === value) return token;
      touched = true;
      return `${key}=${facts[key]}`;
    });
    return `<!-- drift:${next.join(' ')} -->`;
  });
  if (touched) {
    fs.writeFileSync(full, updated, 'utf8');
    changed += 1;
    console.log(`updated ${file}`);
  }
}
console.log(`${changed} file(s) updated`);
