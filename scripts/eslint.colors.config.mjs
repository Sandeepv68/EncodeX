/**
 * @fileoverview Minimal ESLint flat config that enables ONLY the local
 * `encodex/no-hardcoded-colors` rule, used by `npm run lint:colors`. Keeps the
 * CI "no hardcoded colors" stage focused on that single validation. The
 * constants file `src/renderer/colors.ts` is exempt because it is the source
 * of truth for color values.
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
      'encodex/no-hardcoded-colors': 'error',
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
      'encodex/no-hardcoded-colors': 'off',
    },
  },
];
