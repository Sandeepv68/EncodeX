/**
 * Shared coverage scope for both test tiers.
 *
 * The unit and integration tiers write separate reports, which
 * `scripts/coverage-summary.mjs` then unions. A union is only meaningful if
 * both tiers measured the same file set: if one tier includes test helpers or
 * a directory the other excludes, the merged "uncovered" list names files no
 * gate ever asked about, and files measured by one tier look untested to the
 * other. Keeping the lists here makes that drift impossible to introduce.
 */

/** Source globs that are eligible for coverage in either tier. */
export const COVERAGE_INCLUDE = ['src/**/*.ts', 'src/**/*.tsx'];

/**
 * Paths excluded from coverage in either tier.
 * Tests, test helpers, and build artifacts are not product code and are never
 * meaningfully covered.
 */
export const COVERAGE_EXCLUDE = [
  'src/**/*.d.ts',
  'src/**/__tests__/**',
  'src/**/*.{test,spec}.{ts,tsx}',
  'src/test-utils/**',
  'src/test-setup.ts',
  'src/test-setup.crash.ts',
  'src/**/*.styles.ts',
  'src/renderer/i18n/**',
  'src/renderer/index.html',
  'src/renderer/global.css',
  'src/renderer/main.tsx',
];
