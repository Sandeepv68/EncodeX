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
    include: [
      'e2e/specs/real-convert.spec.ts',
      'e2e/specs/terms-gate.spec.ts',
      'e2e/specs/ipc-abuse.spec.ts',
      'e2e/specs/ipc-events.spec.ts',
      'e2e/specs/hostile-bridge.spec.ts',
      'e2e/mcp/embedded-gui.spec.ts',
      'e2e/mcp/vscode-ui.spec.ts',
    ],
    exclude: ['node_modules', 'dist'],
    env: { E2E: 'true', E2E_REAL: '1', ENCODEX_TEST_MODE: '' },
    testTimeout: 120000,
    hookTimeout: 120000,
    setupFiles: ['e2e/fixtures/tripwire-setup.ts'],
    fileParallelism: false,
  },
});
