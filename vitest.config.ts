import { defineConfig } from 'vitest/config';
import path from 'path';
import { COVERAGE_INCLUDE, COVERAGE_EXCLUDE } from './vitest.coverage-scope';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    globals: true,
    testTimeout: 30000,
    env: {
      LOG_LEVEL: 'WARN',
      ENCODEX_STRICT_TESTS: process.env.ENCODEX_STRICT_TESTS ?? '1',
    },
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // `scripts/**` holds the coverage and flake tooling. Those scripts decide
    // whether a build passes, so they are tested like any other code rather than
    // trusted because they are "just tooling".
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'scripts/**/__tests__/*.{test,spec}.mjs',
      // Pure helpers imported by the e2e harness (e.g. boot-budget) are unit
      // tested here. The `.test` suffix keeps them out of `e2e/**/*.spec.ts`.
      'e2e/**/__tests__/*.{test,spec}.ts',
    ],
    // The `mediafuzz` tier spawns real ffmpeg against a generated corpus and
    // takes minutes; it has its own config and script (`test:media-fuzz`).
    // The Phase 5.1 locale matrix renders all 12 pages under the *real*
    // i18next for all 56 locales (~100s) and is too slow for the shared tier;
    // it has its own config and script (`test:locale-matrix`).
    exclude: [
      'node_modules',
      'dist',
      '**/*.integration.{test,spec}.ts',
      '**/*.mediafuzz.{test,spec}.ts',
      'src/renderer/__tests__/i18n-matrix.test.tsx',
      'src/renderer/__tests__/rtl-direction.test.tsx',
    ],
    css: true,
    pool: 'forks',
    maxWorkers: 6,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json', 'json-summary'],
      include: COVERAGE_INCLUDE,
      exclude: COVERAGE_EXCLUDE,
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 80,
        lines: 85,
      },
    },
  },
});
