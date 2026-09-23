/**
 * @fileoverview Minimal ESLint flat config that enables ONLY the local
 * `encodex/no-direct-aptabase-import` rule across the whole `src/` tree, used
 * by `npm run lint:aptabase`. Guarantees the Aptabase SDK stays contained
 * behind its two adapter modules (CI grep, plan item 9.8).
 */

import tsParser from '@typescript-eslint/parser';
import tsEslint from 'typescript-eslint';
import noDirectAptabaseImport from '../eslint-rules/no-direct-aptabase-import.mjs';
import noHardcodedPx from '../eslint-rules/no-hardcoded-px.mjs';
import noHardcodedRem from '../eslint-rules/no-hardcoded-rem.mjs';
import noHardcodedColors from '../eslint-rules/no-hardcoded-colors.mjs';
import noInlineStyles from '../eslint-rules/no-inline-styles.mjs';
import noHardcodedStrings from '../eslint-rules/no-hardcoded-strings.mjs';
import noUnused from '../eslint-rules/no-unused.mjs';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tsEslint.plugin,
      encodex: {
        rules: {
          'no-direct-aptabase-import': noDirectAptabaseImport,
          'no-hardcoded-px': noHardcodedPx,
          'no-hardcoded-rem': noHardcodedRem,
          'no-hardcoded-colors': noHardcodedColors,
          'no-inline-styles': noInlineStyles,
          'no-hardcoded-strings': noHardcodedStrings,
          'no-unused': noUnused,
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
      'encodex/no-direct-aptabase-import': 'error',
    },
  },
];
