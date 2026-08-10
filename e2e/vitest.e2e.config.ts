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
    include: ['e2e/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    env: { E2E: 'true' },
    testTimeout: 60000,
    hookTimeout: 60000,
    setupFiles: [],
  },
});
