import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Dedicated config for the Phase 5.1 locale matrix (`i18n-matrix.test.tsx`),
 * gated in CI by the blocking `test-locale-matrix` job.
 *
 * The suite renders all 12 pages against the *real* `react-i18next` and the
 * real 56-locale resource set (it unmocks the global mock), so it is several
 * times slower than the average unit file. It therefore runs outside the
 * shared unit tier, in its own worker pool, and reports only its own results.
 */
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
    include: ['src/renderer/__tests__/i18n-matrix.test.tsx'],
    css: true,
    pool: 'forks',
    maxWorkers: 6,
  },
});
