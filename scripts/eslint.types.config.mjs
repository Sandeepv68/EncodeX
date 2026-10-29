/**
 * @fileoverview Minimal ESLint flat config that enables ONLY the local
 * `encodex/no-local-types` rule, used by `npm run lint:types`.
 * Keeps the CI "no local types" stage focused on that single validation.
 */

import tsParser from '@typescript-eslint/parser';
import noLocalTypes from '../eslint-rules/no-local-types.mjs';
import noHardcodedStrings from '../eslint-rules/no-hardcoded-strings.mjs';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      encodex: {
        rules: {
          'no-local-types': noLocalTypes,
          // Registered (but off) so that the `eslint-disable-next-line`
          // directives in the source resolve instead of erroring with
          // "Definition for rule ... was not found".
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
    linterOptions: {
      // The rules below are off here, so the `eslint-disable-next-line`
      // directives that suppress them would look unused.
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'encodex/no-local-types': 'error',
      'encodex/no-hardcoded-strings': 'off',
    },
  },
  {
    // Test files and test utilities legitimately declare their own shapes.
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**/*.{ts,tsx}', 'src/test-utils/**/*.{ts,tsx}', 'src/test-setup.ts'],
    rules: {
      'encodex/no-local-types': 'off',
    },
  },
];
