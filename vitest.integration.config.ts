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
    env: {
      LOG_LEVEL: 'WARN',
      ENCODEX_STRICT_TESTS: process.env.ENCODEX_STRICT_TESTS ?? '1',
    },
    environment: 'node',
    include: ['src/**/*.integration.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./src/test-setup.crash.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      // Phase 0.4: the integration tier writes its own raw report so
      // `test:coverage:diff` can merge it with the unit tier's. Without it the
      // CLI and MCP sources this tier exists to exercise read as ~0%, and a
      // per-file floor built on that would demand tests that already pass.
      reporter: ['text', 'json', 'json-summary'],
      reportsDirectory: 'coverage-integration',
      // Same scope as the unit tier on purpose; see vitest.coverage-scope.ts.
      include: COVERAGE_INCLUDE,
      exclude: COVERAGE_EXCLUDE,
    },
  },
});
