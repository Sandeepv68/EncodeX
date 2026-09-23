/**
 * @fileoverview Wiring-completeness test for the analytics event catalog.
 *
 * Every `AnalyticsEventName` declared in the taxonomy must be emitted from at
 * least one non-test source file (a wiring call site that passes it to
 * `createAnalyticsEvent(...)`). This greps the `src/` tree, so the catalog can
 * never silently drift: adding a name to `events.ts` without wiring it (or
 * deleting the last call site of a wired event) fails this test.
 *
 * Deliberately-unwired events are listed in `UNWIRED_BY_DESIGN` with a reason,
 * so the intent is explicit rather than accidental.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ANALYTICS_EVENT_GROUP } from '../events';

/**
 * Events that exist in the taxonomy but are intentionally not wired yet.
 * Each entry documents WHY there is no call site.
 */
const UNWIRED_BY_DESIGN: Record<string, string> = {
  profile_reset: 'no reset-to-defaults profiles UI/action exists yet (see APTABASE_ANALYTICS_PLAN.md §4 J12)',
};

/** Recursively collects every `.ts`/`.tsx` file under a directory (tests excluded). */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('analytics event wiring completeness', () => {
  const srcRoot = path.resolve(__dirname, '../../../..');
  const sourceFiles = collectSourceFiles(srcRoot).filter(
    (file) => !file.endsWith('shared\\analytics\\events.ts') && !file.endsWith('shared/analytics/events.ts'),
  );

  it('discovers the source tree for grepping', () => {
    expect(sourceFiles.length).toBeGreaterThan(250);
  });

  it('every AnalyticsEventName has at least one non-test wiring call site', () => {
    const cache = new Map<string, string>();
    for (const file of sourceFiles) cache.set(file, fs.readFileSync(file, 'utf-8'));

    const missing: string[] = [];
    for (const name of Object.keys(ANALYTICS_EVENT_GROUP)) {
      if (UNWIRED_BY_DESIGN[name]) continue;
      const pattern = `'${name}'`;
      const wired = [...cache.entries()].some(([file, content]) => content.includes(pattern));
      if (!wired) missing.push(name);
    }

    expect(missing).toEqual([]);
  });

  it('the unwired-by-design allowlist only contains known names', () => {
    for (const name of Object.keys(UNWIRED_BY_DESIGN)) {
      expect(ANALYTICS_EVENT_GROUP).toHaveProperty(name);
    }
  });
});
