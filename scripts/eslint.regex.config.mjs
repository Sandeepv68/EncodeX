/**
 * @fileoverview Minimal ESLint flat config that enables ONLY the ReDoS guard
 * `regexp/no-super-linear-backtracking` (Phase 8 follow-up: the "regex-scan CI
 * step"). Uses eslint-plugin-regexp's static analysis to flag regexes whose
 * combination of quantifiers allows super-linear (catastrophic) backtracking
 * -- the shape the expensive in-process budget tests in
 * `src/shared/__tests__/resource-budget.test.ts` then prove bounded at 100 KB
 * of adversarial input. Keeps the CI "no catastrophic regex" stage focused on
 * that single validation, mirroring the other lint-* stages.
 */

import tsParser from '@typescript-eslint/parser';
import regexp from 'eslint-plugin-regexp';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/__snapshots__/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      regexp: regexp.configs['flat/recommended'].plugins.regexp,
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
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'regexp/no-super-linear-backtracking': 'error',
    },
  },
  {
    // renderer carries eslint-disable directives for the encodex rules (not
    // defined here); server.ts carries one for @typescript-eslint/no-require-imports.
    // The scan targets the parsing money-path (plan Phase 8): main/shared/mcp/
    // preload/test-utils. Those unrelated directives would otherwise error as
    // "definition for rule was not found", so skip the two noisy surfaces.
    ignores: ['src/renderer/**', 'src/mcp/server.ts'],
  },
];
