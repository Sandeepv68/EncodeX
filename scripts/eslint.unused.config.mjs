/**
 * @fileoverview Minimal ESLint flat config that enables ONLY the local
 * `encodex/no-unused` rule, used by `npm run lint:unused`. Keeps the CI
 * "no unused code" stage focused on that single validation.
 */

import tsParser from '@typescript-eslint/parser';
import noUnused from '../eslint-rules/no-unused.mjs';
import noHardcodedPx from '../eslint-rules/no-hardcoded-px.mjs';
import noHardcodedRem from '../eslint-rules/no-hardcoded-rem.mjs';
import noHardcodedColors from '../eslint-rules/no-hardcoded-colors.mjs';
import noInlineStyles from '../eslint-rules/no-inline-styles.mjs';
import noHardcodedStrings from '../eslint-rules/no-hardcoded-strings.mjs';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      encodex: {
        rules: {
          'no-unused': noUnused,
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
      'encodex/no-unused': 'error',
    },
  },
];
