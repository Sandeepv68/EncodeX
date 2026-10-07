import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Dedicated config for the phase 8 rapid-route-change stress suite
 * (`route-change-stress.test.tsx`), gated in CI by the blocking
 * `test-route-changes` job.
 *
 * The suite mounts the real App shell once and drives 1,000 react-router
 * navigations across all twelve lazy routes while a conversion is RUNNING,
 * asserting that window/document listeners, the error store, and the running
 * job survive the walk. It is slow (-120 s locally) and depends on a strict
 * clean-jsdom invariant, so it gets its own worker pool (serialized to
 * `maxWorkers: 1`) rather than a fork inside the shared unit tier.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    globals: true,
    testTimeout: 240000,
    env: {
      LOG_LEVEL: 'WARN',
      ENCODEX_STRICT_TESTS: process.env.ENCODEX_STRICT_TESTS ?? '1',
    },
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/renderer/__tests__/route-change-stress.test.tsx'],
    css: true,
    pool: 'forks',
    maxWorkers: 1,
  },
});
