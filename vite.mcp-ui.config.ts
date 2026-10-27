/**
 * @fileoverview Vite config for the standalone MCP App bundle.
 *
 * The MCP Apps views are served to third-party hosts as a single, fully
 * self-contained HTML document: no external script, style, font or fetch, so
 * the document renders under a host's restrictive default CSP. `vite-plugin-
 * singlefile` inlines the JavaScript and the CSS into the HTML.
 *
 * The bundle contains every view; the server injects a bootstrap that names
 * the view to render, so one document serves all `ui://` resources.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'src/renderer/mcp-views/standalone',
  base: './',
  plugins: [react(), viteSingleFile()],
  define: {
    // The `ext-apps` App class reads this to detect a browser-like runtime.
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: '../../../../dist/mcp-ui',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
