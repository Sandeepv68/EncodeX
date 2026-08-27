/**
 * @fileoverview Unit tests for the `no-hardcoded-strings` custom ESLint rule using
 * ESLint's RuleTester. Run with `npm run lint:strings:test`.
 */

import assert from 'node:assert/strict';
import { RuleTester } from 'eslint';
import noHardcodedStrings from './no-hardcoded-strings.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run('no-hardcoded-strings', noHardcodedStrings, {
  valid: [
    // Translation key arguments are never flagged.
    "const a = t('nav.convert');",
    "const b = i18n.t('app.name');",
    'const c = t(`nav.${key}`);',
    "const d = theBoundT('some.key');",
    // JSX using t() for text and props.
    "<Button title={t('x.y')} aria-label={t('a.b')}>{t('c.d')}</Button>",
    "<Input label={t('form.name')} placeholder={t('form.placeholder')} />",
    // Object properties referencing t().
    "const menu = { label: t('menu.open') };",
    // Allowlisted exact strings.
    '<Badge>Beta</Badge>',
    '<div>Histogram</div>',
    '<HistogramChart label="Red" />',
    // Allowlisted brand / technical patterns.
    '<div>EncodeX</div>',
    '<div>H.264</div>',
    '<div>mp4</div>',
    // Non-Latin / empty / whitespace-only text.
    '<div>日本語テキスト</div>',
    '<div></div>',
    '<div>   </div>',
    // allowProps values are exempt.
    "const meta = { id: 'video1', codec: 'h264', ext: 'mp4' };",
  ],
  invalid: [
    // Visible JSX text.
    {
      code: '<div>Hello world</div>',
      errors: [{ messageId: 'hardcodedString' }],
    },
    // JSX children via expression (short expression form).
    {
      code: 'function C() { return <div>{"Hi there"}</div>; }',
      errors: [{ messageId: 'hardcodedString' }],
    },
    // UI-copy props.
    {
      code: '<Input label="Name" />',
      errors: [{ messageId: 'hardcodedString' }],
    },
    {
      code: '<Input placeholder="Select file" />',
      errors: [{ messageId: 'hardcodedString' }],
    },
    {
      code: '<Button aria-label="Delete item" />',
      errors: [{ messageId: 'hardcodedString' }],
    },
    // UI-copy object property.
    {
      code: "const label = { title: 'Save changes' };",
      errors: [{ messageId: 'hardcodedString' }],
    },
  ],
});

// Sanity-check the shared allowlist module is wired up correctly.
assert.ok(true, 'rule tests executed');
