import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config used by the Stryker mutation runner (`npm run test:mutate`).
 *
 * Mutation testing re-runs the test suite once per mutant, so this config is
 * deliberately narrower than the shared unit tier: it includes only the unit
 * tests that directly cover the Phase 9 targets (the logic that decides what
 * ffmpeg runs and what is stored) rather than the whole renderer. Page suites
 * that also exercise those stores stay out so a single mutant run costs seconds,
 * not minutes.
 *
 * The environment mirrors the shared tier (jsdom + the preload-bridge test
 * setup), because the renderer stores register IPC subscriptions at module
 * load.
 */
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
      ENCODEX_STRICT_TESTS: process.env.ENCODEX_STRICT_TESTS ?? '1',
    },
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: [
      'src/shared/__tests__/codec-containers*.test.ts',
      'src/shared/__tests__/{errors,estimate,math,progress,remux-utils,validation,video-filters}*.test.ts',
      'src/main/transcoders/__tests__/{ffmpeg-utils,ffprobe-mapper}.test.ts',
      'src/main/queue/__tests__/{queue-transfer,job-queue-attacks,queue-import-budget}*.test.ts',
      'src/renderer/stores/__tests__/*.test.ts',
      'src/renderer/utils/__tests__/*.test.ts',
    ],
    css: false,
    pool: 'forks',
    maxWorkers: 4,
  },
});
