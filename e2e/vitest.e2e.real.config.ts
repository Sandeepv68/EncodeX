import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '..', 'src/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['e2e/specs/real-convert.spec.ts'],
    exclude: ['node_modules', 'dist'],
    env: { E2E: 'true', E2E_REAL: '1', ENCODEX_TEST_MODE: '' },
    testTimeout: 120000,
    hookTimeout: 120000,
    setupFiles: [],
    fileParallelism: false,
  },
});
