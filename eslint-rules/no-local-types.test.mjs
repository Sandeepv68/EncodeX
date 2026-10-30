/**
 * @fileoverview Unit tests for the `no-local-types` custom ESLint rule using
 * ESLint's RuleTester. Run with `npm run lint:types:test`.
 */

import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import noLocalTypes from './no-local-types.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run('no-local-types', noLocalTypes, {
  valid: [
    // A type file may declare types.
    {
      code: 'export interface Foo { a: string }',
      filename: 'src/shared/types.ts',
    },
    {
      code: 'export type Foo = { a: string }',
      filename: 'src/shared/ai/types.ts',
    },
    {
      code: 'export type Foo = { a: string }',
      filename: 'src/shared/ai/agent.types.ts',
    },
    // Ambient declaration files may declare types.
    {
      code: 'declare module "x" { export interface Foo { a: string } }',
      filename: 'src/renderer/mui.d.ts',
    },
    // Re-exporting a type from a type file is not a declaration.
    {
      code: "export type { Foo } from './types';",
      filename: 'src/shared/agent.ts',
    },
    // Implementation files without type declarations are fine.
    {
      code: 'export const x = 1;',
      filename: 'src/shared/agent.ts',
    },
  ],
  invalid: [
    {
      code: 'export interface Foo { a: string }',
      filename: 'src/shared/agent.ts',
      errors: [{ messageId: 'localType', data: { kind: 'Interface' } }],
    },
    {
      code: 'export type Foo = { a: string }',
      filename: 'src/shared/agent.ts',
      errors: [{ messageId: 'localType', data: { kind: 'Type' } }],
    },
    {
      code: 'interface Foo { a: string }',
      filename: 'src/renderer/components/Agent.tsx',
      errors: [{ messageId: 'localType', data: { kind: 'Interface' } }],
    },
    {
      code: 'type Foo = string;',
      filename: 'src/renderer/pages/Dashboard.tsx',
      errors: [{ messageId: 'localType', data: { kind: 'Type' } }],
    },
  ],
});
