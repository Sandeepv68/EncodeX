/**
 * @fileoverview Unit tests for the `no-unused` custom ESLint rule using
 * ESLint's RuleTester. Run with `npm run lint:unused:test`.
 */

import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import noUnused from './no-unused.mjs';

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

ruleTester.run('no-unused', noUnused, {
  valid: [
    // Read usage keeps a variable, function, or class alive.
    'const a = 1; console.log(a);',
    'let count = 0; count += 1; return count;',
    'function f() { return 1; } const y = f(); console.log(y);',
    'class A {} const a = new A(); console.log(a);',
    // Imports used in value and type positions.
    "import x from 'mod'; use(x);",
    "import { y } from 'mod'; console.log(y);",
    "import type { T } from 'mod'; const v: T = 1; console.log(v);",
    // Exported bindings are consumed by the export.
    'export function f() { return 1; }',
    'export class C {}',
    'export const v = 1;',
    'export default function f() { return 1; }',
    'export default class C {}',
// Recursive functions / self-references count as usage.
    'function f() { return f(); }',
    // Destructured bindings that are all used.
    'const { a, b } = obj; console.log(a, b);',
    // Named export specifiers consume the binding.
    'const v = 1; export { v };',
    // Function parameters are out of scope for this rule.
    'function g(a, b) { return a; } console.log(g(1, 2));',
    // JSX component used as a tag.
    'function C() { return <div />; } const App = () => <C />; console.log(App);',
  ],
  invalid: [
    {
      code: 'const a = 1;',
      errors: [{ messageId: 'unused', data: { kind: 'variable', name: 'a' } }],
    },
    {
      code: 'let b;',
      errors: [{ messageId: 'unused', data: { kind: 'variable', name: 'b' } }],
    },
    {
      code: 'const f = () => 1;',
      errors: [{ messageId: 'unused', data: { kind: 'variable', name: 'f' } }],
    },
    {
      code: 'function f() { return 1; }',
      errors: [{ messageId: 'unused', data: { kind: 'function', name: 'f' } }],
    },
    {
      code: 'class C {}',
      errors: [{ messageId: 'unused', data: { kind: 'class', name: 'C' } }],
    },
    {
      code: "import x from 'mod';",
      errors: [{ messageId: 'unused', data: { kind: 'import', name: 'x' } }],
    },
    {
      code: "import { x } from 'mod';",
      errors: [{ messageId: 'unused', data: { kind: 'import', name: 'x' } }],
    },
    {
      code: "import type { T } from 'mod';",
      errors: [{ messageId: 'unused', data: { kind: 'import', name: 'T' } }],
    },
    {
      code: 'const { a, b } = obj; console.log(a);',
      errors: [{ messageId: 'unused', data: { kind: 'variable', name: 'b' } }],
    },
    // Write-only bindings mirror ESLint core no-unused-vars: dead code.
    {
      code: 'let n = 1; n = 2;',
      errors: [{ messageId: 'unused', data: { kind: 'variable', name: 'n' } }],
    },
  ],
});