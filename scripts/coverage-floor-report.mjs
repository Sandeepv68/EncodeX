import { mergeCoverage, assertMergeIsSane, misses, table, DEFAULT_LINE_FLOOR, DEFAULT_BRANCH_FLOOR } from './coverage-summary.mjs';

/**
 * @fileoverview Non-blocking per-file coverage report.
 *
 * This is the Phase 0.4 deliverable: print the list of files that would fail a
 * per-file floor, so the floor can be chosen from real numbers instead of a
 * guess. It **never** fails the build - that is the point of the "non-blocking
 * first" step. Wire `perFile: true` into `vitest.config.ts` only once the
 * violator list here is short enough to act on.
 *
 * Both test tiers are merged before the floor is applied. The unit tier alone
 * reports `cli-batch.ts` and `cli-info.ts` at 0% even though
 * `cli-integration.integration.test.ts` drives both; a floor chosen from
 * single-tier numbers would demand tests that already exist.
 *
 * Usage: `npm run test:coverage:perfile`, which runs both tiers first.
 */

const lineFloor = Number(process.env.COVERAGE_LINE_FLOOR ?? DEFAULT_LINE_FLOOR);
const branchFloor = Number(process.env.COVERAGE_BRANCH_FLOOR ?? DEFAULT_BRANCH_FLOOR);
const limit = Number(process.env.COVERAGE_REPORT_LIMIT ?? 40);
const dirs = (process.env.COVERAGE_DIRS ?? 'coverage,coverage-integration').split(',').map((d) => d.trim());

let merged;
try {
  merged = mergeCoverage(dirs);
  assertMergeIsSane(merged.entries, dirs);
} catch (error) {
  // A bad merge reports *high* coverage, so it would quietly disable the gates.
  // Refuse to print a list that cannot be trusted.
  console.error(`Coverage report aborted: ${error.message}`);
  process.exit(1);
}

const { entries, tiers, skipped } = merged;
if (skipped.length > 0) {
  console.warn(`No raw report in: ${skipped.join(', ')} (run \`npm run test:integration\` to include that tier).`);
}
console.log(`Tiers merged: ${tiers.join(', ')}\n`);

const violators = entries.filter((entry) => {
  const verdict = misses(entry, lineFloor, branchFloor);
  return verdict.lines || verdict.branches;
});

console.log(`Candidate per-file floor: lines >= ${lineFloor}%, branches >= ${branchFloor}%`);
console.log(`${entries.length} files measured, ${violators.length} would fail that floor.\n`);

if (violators.length === 0) {
  console.log('No violators. Safe to enable `perFile: true` in vitest.config.ts.');
} else {
  console.log(table(violators, limit));
  if (violators.length > limit) {
    console.log(`\n... and ${violators.length - limit} more. Raise COVERAGE_REPORT_LIMIT to see them all.`);
  }

  // A histogram makes the floor choice obvious: it shows which threshold would
  // leave a workable number of violators, instead of making someone count rows.
  console.log('\nDistribution of line coverage:');
  for (const floor of [0, 25, 40, 50, 60, 70, 80, 90]) {
    const below = entries.filter((e) => Math.min(e.lines, e.statements) < floor).length;
    console.log(`  < ${String(floor).padStart(2)}% : ${String(below).padStart(3)} file(s)`);
  }
}

console.log('\nThis report is informational and always exits 0.');
process.exit(0);
