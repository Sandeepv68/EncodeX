/**
 * @fileoverview Minimal ESLint flat config that enables ONLY the local
 * `encodex/no-hardcoded-px` rule, used by `npm run lint:px`. Keeps the CI
 * "no hardcoded px" stage focused on that single validation.
 */

import tsParser from '@typescript-eslint/parser';
import noHardcodedPx from '../eslint-rules/no-hardcoded-px.mjs';

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
      'encodex/no-hardcoded-px': 'error',
    },
  },
  {
    files: ['src/renderer/**/*.{test,spec}.{ts,tsx}', 'src/renderer/**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'encodex/no-hardcoded-px': 'off',
    },
  },
];
