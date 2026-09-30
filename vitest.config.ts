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
    },
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '**/*.integration.{test,spec}.ts'],
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
