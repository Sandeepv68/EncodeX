/**
 * @fileoverview Minimal ESLint flat config that enables ONLY the local
 * `encodex/no-hardcoded-rem` rule, used by `npm run lint:rem`. Keeps the CI
 * "no hardcoded rem" stage focused on that single validation.
 */

import tsParser from '@typescript-eslint/parser';
import noHardcodedPx from '../eslint-rules/no-hardcoded-px.mjs';
import noHardcodedRem from '../eslint-rules/no-hardcoded-rem.mjs';
import noHardcodedColors from '../eslint-rules/no-hardcoded-colors.mjs';
import noInlineStyles from '../eslint-rules/no-inline-styles.mjs';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      encodex: {
        rules: {
          'no-hardcoded-px': noHardcodedPx,
          'no-hardcoded-rem': noHardcodedRem,
          'no-hardcoded-colors': noHardcodedColors,
          'no-inline-styles': noInlineStyles,
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
      'encodex/no-hardcoded-rem': 'error',
    },
  },
  {
    files: ['src/renderer/**/*.{test,spec}.{ts,tsx}', 'src/renderer/**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'encodex/no-hardcoded-rem': 'off',
    },
  },
];
