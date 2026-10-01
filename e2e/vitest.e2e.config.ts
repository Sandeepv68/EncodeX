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
    // `e2e/quarantine/` holds specs parked in `e2e/quarantine.json`. They must
    // not run by default: a parked spec is unproven, and running it anyway would
    // either fail the build or, worse, appear to pass.
    exclude: ['node_modules', 'dist', 'e2e/quarantine/**'],
    env: { E2E: 'true', ENCODEX_TEST_MODE: '1' },
    testTimeout: 60000,
    hookTimeout: 60000,
    setupFiles: ['e2e/fixtures/tripwire-setup.ts'],
    fileParallelism: false,
    ...(process.env.CI ? { retry: 2 } : {}),
  },
});
