/**
 * @fileoverview Minimal ESLint flat config that enables ONLY the local
 * `encodex/no-hardcoded-strings` rule, used by `npm run lint:strings`. Keeps the
 * CI "no hardcoded UI strings" stage focused on that single validation.
 *
 * All other `encodex/*` rules are still registered (not enabled) so that existing
 * `eslint-disable` directives for them in source files resolve without error.
 * Test files are exempt because they legitimately assert with fake English strings,
 * and `i18n/localeMeta.ts` is ignored because it holds native language display names.
 */

import tsParser from '@typescript-eslint/parser';
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
      'encodex/no-hardcoded-strings': [
        'error',
        {
          ignoreFiles: ['src/renderer/i18n/localeMeta.ts'],
        },
      ],
    },
  },
  {
    files: ['src/renderer/**/*.{test,spec}.{ts,tsx}', 'src/renderer/**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'encodex/no-hardcoded-strings': 'off',
    },
  },
];
