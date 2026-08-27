/**
 * @fileoverview ESLint flat config (ESLint 9).
 *
 * Optional, non-blocking accessibility linting for the renderer only. The
 * repository has no pre-existing ESLint setup, so this config intentionally
 * stays out of the way: `main`/`preload`, `e2e`, and build output are not
 * linted, and every `jsx-a11y` rule is set to `warn` so it never blocks a
 * build. Run it with `npm run lint`.
 *
 * A local `no-hardcoded-px` rule (see eslint-rules/no-hardcoded-px.mjs) is
 * enforced as an error on renderer sources: hardcoded `px` units must use
 * `theme.typography.pxToRem()` instead. A `no-hardcoded-colors` rule (see
 * eslint-rules/no-hardcoded-colors.mjs) likewise forbids inline color codes,
 * which must reference the constants in `src/renderer/colors.ts`. Test files
 * are exempt because they legitimately assert computed pixel values.
 */

import jsxA11y from 'eslint-plugin-jsx-a11y';
import tsParser from '@typescript-eslint/parser';
import noHardcodedPx from './eslint-rules/no-hardcoded-px.mjs';
import noHardcodedRem from './eslint-rules/no-hardcoded-rem.mjs';
import noHardcodedColors from './eslint-rules/no-hardcoded-colors.mjs';
import noInlineStyles from './eslint-rules/no-inline-styles.mjs';
import noHardcodedStrings from './eslint-rules/no-hardcoded-strings.mjs';

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
      encodex: {
        rules: {
          'no-hardcoded-px': noHardcodedPx,
          'no-hardcoded-rem': noHardcodedRem,
          'no-hardcoded-colors': noHardcodedColors,
          'no-inline-styles': noInlineStyles,
          'no-hardcoded-strings': noHardcodedStrings,
        },
      },
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...jsxA11yWarn,
      'encodex/no-hardcoded-px': 'error',
      'encodex/no-hardcoded-rem': 'error',
      'encodex/no-hardcoded-colors': 'error',
      'encodex/no-inline-styles': 'error',
      'encodex/no-hardcoded-strings': [
        'error',
        {
          ignoreFiles: ['src/renderer/i18n/localeMeta.ts'],
        },
      ],
    },
  },
  {
    files: ['src/renderer/colors.ts'],
    rules: {
      'encodex/no-hardcoded-colors': 'off',
    },
  },
  {
    files: ['src/renderer/**/*.{test,spec}.{ts,tsx}', 'src/renderer/**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'encodex/no-hardcoded-px': 'off',
      'encodex/no-hardcoded-rem': 'off',
      'encodex/no-hardcoded-colors': 'off',
      'encodex/no-inline-styles': 'off',
      'encodex/no-hardcoded-strings': 'off',
    },
  },
];
