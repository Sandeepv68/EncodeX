import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Dedicated config for the phase 5.2 large-list render budgets
 * (`big-list-budget.test.tsx`), gated in CI by the blocking `test-big-lists`
 * job.
 *
 * The suite renders 50,000 log rows and 3,000 MUI job cards in jsdom; either
 * alone would exhaust the heap budget of a shared unit-tier fork, so it gets
 * its own worker pool (serialized to `maxWorkers: 1` so two big renders never
 * run in parallel forks on the same machine).
 *
 * No heap flag is set: the batch render is sized to stay inside Node's default
 * ~4 GB heap so the suite fits GitHub's ubuntu runners (7 GB total).
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
    include: ['src/renderer/__tests__/big-list-budget.test.tsx'],
    css: true,
    pool: 'forks',
    maxWorkers: 1,
  },
});
