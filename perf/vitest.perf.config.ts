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
    include: ['perf/**/*.perf.test.ts', 'perf/**/*.perf.test.tsx'],
    exclude: ['node_modules', 'dist', 'perf/results', 'perf/fixtures'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    pool: 'forks',
    maxWorkers: 1,
    reporters: ['verbose'],
    // Vitest 4 removed the `test.forks` sub-object and flattened its options
    // onto `test`. The old `forks: { execArgv: [...] }` was silently ignored -
    // an unknown key, not an error - so `--expose-gc` never reached the workers.
    // The memory tests guard with `if (global.gc)`, so nothing crashed; they just
    // measured uncollected garbage while reporting a pass. Typechecking this file
    // (Phase 0.6) is what surfaced it.
    execArgv: ['--expose-gc'],
    env: {
      LOG_LEVEL: 'ERROR',
      PERF_TEST: '1',
    },
  },
});
