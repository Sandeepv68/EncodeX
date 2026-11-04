#!/usr/bin/env node
/**
 * @fileoverview Analytics schema checker.
 *
 * Computes the canonical event schema from `src/shared/analytics/events.ts`
 * (event name, group, tier) and compares it against the committed snapshot at
 * `docs/analytics-dashboards/data-schema.json`. Exits non-zero when they differ,
 * so CI catches taxonomy drift. Regenerate the snapshot with `--write`.
 *
 * Usage:
 *   node scripts/check-analytics-schema.mjs          # verify
 *   node scripts/check-analytics-schema.mjs --write  # regenerate snapshot
 *   node scripts/check-analytics-schema.mjs --facts  # print computed facts
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const EVENTS_FILE = path.join(ROOT, 'src/shared/analytics/events.ts');
const SCHEMA_FILE = path.join(ROOT, 'docs/analytics-dashboards/data-schema.json');

function parseEvents(source) {
  const groupMap = {};
  const tierMap = {};
  // Group map: `event_name: 'group',`
  const groupRe = /^\s{2}([a-z_]+):\s*'([a-z_]+)',\s*$/gm;
  let m;
  // The events.ts file has two maps: ANALYTICS_EVENT_GROUP and ANALYTICS_TIER.
  // We locate each by its export const name.
  const groupSection = source.match(/export const ANALYTICS_EVENT_GROUP[\s\S]*?=\s*\{([\s\S]*?)\};/);
  const tierSection = source.match(/export const ANALYTICS_TIER[\s\S]*?=\s*\{([\s\S]*?)\};/);
  if (groupSection) {
    for (const line of groupSection[1].split('\n')) {
      const lm = line.match(/^\s{2}([a-z_]+):\s*'([a-z_]+)',?\s*$/);
      if (lm) groupMap[lm[1]] = lm[2];
    }
  }
  if (tierSection) {
    for (const line of tierSection[1].split('\n')) {
      const lm = line.match(/^\s{2}([a-z_]+):\s*'([a-z0-9_]+)',?\s*$/);
      if (lm) tierMap[lm[1]] = lm[2];
    }
  }
  const events = Object.keys(groupMap)
    .sort()
    .map((name) => ({
      name,
      group: groupMap[name],
      tier: tierMap[name] ?? null,
    }));
  return events;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const source = fs.readFileSync(EVENTS_FILE, 'utf8');
  const events = parseEvents(source);
  const schema = { schemaVersion: 1, eventCount: events.length, events };

  if (args.has('--facts')) {
    console.log(`events=${events.length}`);
    return 0;
  }

  if (args.has('--write')) {
    fs.mkdirSync(path.dirname(SCHEMA_FILE), { recursive: true });
    fs.writeFileSync(SCHEMA_FILE, JSON.stringify(schema, null, 2) + '\n', 'utf8');
    console.log(`[analytics-schema] wrote ${path.relative(ROOT, SCHEMA_FILE)} (${events.length} events)`);
    return 0;
  }

  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error(`[analytics-schema] missing snapshot: ${path.relative(ROOT, SCHEMA_FILE)}`);
    console.error('Run with --write to generate it.');
    return 1;
  }

  const committed = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  const currentJson = JSON.stringify(schema);
  const committedJson = JSON.stringify(committed);
  if (currentJson !== committedJson) {
    console.error('[analytics-schema] drift detected: events.ts no longer matches the committed schema snapshot.');
    console.error('Run `npm run analytics:schema-check -- --write` to regenerate, then review the diff.');
    return 1;
  }
  console.log(`[analytics-schema] ok: ${events.length} events match the committed snapshot.`);
  return 0;
}

process.exit(main());
