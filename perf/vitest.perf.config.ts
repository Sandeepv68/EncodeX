import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../src/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['perf/**/*.perf.test.ts'],
    exclude: ['node_modules', 'dist', 'perf/results', 'perf/fixtures'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    pool: 'forks',
    maxWorkers: 1,
    reporters: ['verbose'],
    forks: {
      execArgv: ['--expose-gc'],
    },
    env: {
      LOG_LEVEL: 'ERROR',
      PERF_TEST: '1',
    },
  },
});
