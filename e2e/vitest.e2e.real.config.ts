import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.e2e.config';

export default defineConfig(
  mergeConfig(base, {
    test: {
      include: ['e2e/specs/real-convert.spec.ts'],
      env: { E2E: 'true', E2E_REAL: 'true', ENCODEX_TEST_MODE: '1' },
    },
  }),
);
