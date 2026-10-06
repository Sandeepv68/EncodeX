import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Dedicated config for the Phase 5.3 axe matrix (`axe-all-pages.test.tsx`),
 * gated in CI by the blocking `test-a11y` job.
 *
 * 72 axe runs (12 routes x light/dark x 320/768/1440) is a few seconds of axe
 * per page; the shared unit tier has no per-file budget for that, so the suite
 * runs in its own worker pool and reports only its own results. Unlike the
 * i18n suites it keeps the global `react-i18next` mock (axe does not care
 * about translation content) and renders through the default provider stack.
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
    include: ['src/renderer/__tests__/axe-all-pages.test.tsx'],
    css: true,
    pool: 'forks',
    maxWorkers: 6,
  },
});
