import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * The `test:media-fuzz` tier: real ffmpeg/ffprobe against a generated corpus of
 * corrupt media. Kept out of `vitest.config.ts` because it spawns real binaries
 * and takes minutes rather than seconds, and out of the integration tier
 * because a corpus sweep is a one-off adversarial gate rather than a regression
 * check that should run on every save.
 *
 * The `*.mediafuzz.test.ts` suffix is what selects the suite; `vitest.config.ts`
 * excludes it so `npm run test:unit` never picks it up.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    globals: true,
    env: {
      LOG_LEVEL: 'ERROR',
    },
    environment: 'node',
    include: ['src/**/*.mediafuzz.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./src/test-setup.crash.ts'],
    // Corpus generation alone synthesises ten media files, and each corrupt
    // file is handed to several real processes.
    testTimeout: 900_000,
    hookTimeout: 300_000,
    pool: 'forks',
    maxWorkers: 2,
  },
});
