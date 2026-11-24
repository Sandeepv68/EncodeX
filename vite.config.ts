import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { codecovVitePlugin } from '@codecov/vite-plugin';

export default defineConfig(async ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  /**
   * Sentry sourcemap upload is enabled only when CI provides the auth token
   * (and org/project). Local builds stay plugin-free.
   */
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
  const shouldUploadSourcemaps = Boolean(sentryAuthToken && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

  /**
   * Codecov bundle analysis uploads a bundle stats report at build time. It is
   * enabled only when CI provides the token; local builds stay plugin-free.
   */
  const codecovUploadToken = process.env.CODECOV_TOKEN;
  const shouldUploadBundle = Boolean(codecovUploadToken);

  const posthogApiKey = process.env.POSTHOG_API_KEY;
  const shouldUploadPosthogSourcemaps = Boolean(posthogApiKey && process.env.POSTHOG_PROJECT_ID);
  const posthogPlugins: PluginOption[] = [];

  if (shouldUploadPosthogSourcemaps) {
    const { default: posthogRollupPlugin } = await import('@posthog/rollup-plugin');
    posthogPlugins.push(
      posthogRollupPlugin({
        personalApiKey: posthogApiKey ?? '',
        projectId: process.env.POSTHOG_PROJECT_ID,
        host: process.env.POSTHOG_HOST,
        sourcemaps: {
          enabled: true,
          deleteAfterUpload: true,
        },
      }),
    );
  }

  return {
    plugins: [
      react(),
      ...posthogPlugins,
      ...(shouldUploadSourcemaps
        ? [
            sentryVitePlugin({
              authToken: sentryAuthToken,
              org: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT,
              release: { name: `encodex@${process.env.VITE_APP_VERSION ?? 'dev'}` },
              sourcemaps: {
                assets: ['./dist/renderer/**'],
              },
            }),
          ]
        : []),
      ...(shouldUploadBundle
        ? [
            codecovVitePlugin({
              enableBundleAnalysis: true,
              bundleName: 'encodex-renderer',
              uploadToken: codecovUploadToken,
            }),
          ]
        : []),
    ],
    root: 'src/renderer',
    base: './',
    build: {
      outDir: '../../dist/renderer',
      emptyOutDir: true,
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
  };
});
