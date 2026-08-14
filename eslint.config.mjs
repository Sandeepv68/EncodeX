/**
 * @fileoverview ESLint flat config (ESLint 9).
 *
 * Optional, non-blocking accessibility linting for the renderer only. The
 * repository has no pre-existing ESLint setup, so this config intentionally
 * stays out of the way: `main`/`preload`, `e2e`, and build output are not
 * linted, and every `jsx-a11y` rule is set to `warn` so it never blocks a
 * build. Run it with `npm run lint`.
 */

import jsxA11y from 'eslint-plugin-jsx-a11y';
import tsParser from '@typescript-eslint/parser';

/** Downscales a rule's severity to 'warn' while preserving its options. */
function asWarn(value) {
  return Array.isArray(value) ? ['warn', ...value.slice(1)] : 'warn';
}

const jsxA11yWarn = Object.fromEntries(Object.entries(jsxA11y.configs.recommended.rules).map(([rule, value]) => [rule, asWarn(value)]));

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: jsxA11yWarn,
  },
];
