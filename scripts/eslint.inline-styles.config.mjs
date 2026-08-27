/**
 * @fileoverview Minimal ESLint flat config that enables ONLY the local
 * `encodex/no-inline-styles` rule, used by `npm run lint:inline-styles`.
 * Keeps the CI "no inline styles" stage focused on that single validation.
 */

import tsParser from '@typescript-eslint/parser';
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
      'encodex/no-inline-styles': 'error',
    },
  },
  {
    files: ['src/renderer/**/*.{test,spec}.{ts,tsx}', 'src/renderer/**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'encodex/no-inline-styles': 'off',
    },
  },
];
