/**
 * @fileoverview ESLint flat config (ESLint 9).
 *
 * Accessibility linting for the renderer only. The repository has no
 * pre-existing ESLint setup, so this config intentionally stays out of the way:
 * `main`/`preload`, `e2e`, and build output are not linted. Every `jsx-a11y`
 * rule in the plugin's recommended set is enforced as an **error**, so an
 * accessibility regression fails the build rather than scrolling past in a
 * warning list. Run it with `npm run lint`.
 *
 * A local `no-hardcoded-px` rule (see eslint-rules/no-hardcoded-px.mjs) is
 * enforced as an error on renderer sources: hardcoded `px` units must use
 * `theme.typography.pxToRem()` instead. A `no-hardcoded-colors` rule (see
 * eslint-rules/no-hardcoded-colors.mjs) likewise forbids inline color codes,
 * which must reference the constants in `src/shared/theme/colors.ts`. Test files
 * are exempt because they legitimately assert computed pixel values.
 */

import jsxA11y from 'eslint-plugin-jsx-a11y';
import tsParser from '@typescript-eslint/parser';
import noHardcodedPx from './eslint-rules/no-hardcoded-px.mjs';
import noHardcodedRem from './eslint-rules/no-hardcoded-rem.mjs';
import noHardcodedColors from './eslint-rules/no-hardcoded-colors.mjs';
import noInlineStyles from './eslint-rules/no-inline-styles.mjs';
import noHardcodedStrings from './eslint-rules/no-hardcoded-strings.mjs';
import noUnused from './eslint-rules/no-unused.mjs';

/**
 * The `jsx-a11y` recommended rule set, enforced as an error.
 *
 * The plugin's recommended rules carry their own severities (some are `off` by
 * default); every rule it enables is promoted to `error` so the accessibility
 * bar is the same everywhere.
 */
const jsxA11yErrors = Object.fromEntries(
  Object.entries(jsxA11y.configs.recommended.rules).map(([rule, value]) => [
    rule,
    Array.isArray(value) ? ['error', ...value.slice(1)] : 'error',
  ]),
);

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}', 'src/shared/theme/**/*.{ts,tsx}'],
    plugins: {
      'jsx-a11y': jsxA11y,
      encodex: {
        rules: {
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
      ...jsxA11yErrors,
      'encodex/no-hardcoded-px': 'error',
      'encodex/no-hardcoded-rem': 'error',
      'encodex/no-hardcoded-colors': 'error',
      'encodex/no-inline-styles': 'error',
      'encodex/no-hardcoded-strings': [
        'error',
        {
          ignoreFiles: ['src/renderer/i18n/localeMeta.ts', 'src/renderer/mcp-views/standalone/generated-strings.ts'],
        },
      ],
      'encodex/no-unused': 'error',
    },
  },
  {
    files: ['src/shared/theme/colors.ts'],
    rules: {
      'encodex/no-hardcoded-colors': 'off',
    },
  },
  {
    files: [
      'src/renderer/**/*.{test,spec}.{ts,tsx}',
      'src/renderer/**/__tests__/**/*.{ts,tsx}',
      'src/shared/theme/**/*.{test,spec}.{ts,tsx}',
    ],
    rules: {
      'encodex/no-hardcoded-px': 'off',
      'encodex/no-hardcoded-rem': 'off',
      'encodex/no-hardcoded-colors': 'off',
      'encodex/no-inline-styles': 'off',
      'encodex/no-hardcoded-strings': 'off',
    },
  },
];
