/**
 * @fileoverview Shared axe-core helper for renderer tests.
 *
 * Runs axe against a rendered container and fails the test when any rule
 * violation is found. Document-level rules (`bypass`, `document-title`,
 * `html-has-lang`, landmark/heading-one, `region`) are disabled because the
 * test DOM is a component subtree without a real page scaffold, and jsdom
 * cannot compute painted styles, so `color-contrast` and
 * `scrollable-region-focusable` (which rely on paint/scroll metrics) are
 * disabled as well. Contrast and hit-area concerns are covered by dedicated
 * token-level tests (see src/renderer/__tests__/colors.test.ts).
 */

import axe from 'axe-core';
import { expect } from 'vitest';

const DISABLED_RULES = [
  'bypass',
  'document-title',
  'html-has-lang',
  'landmark-one-main',
  'page-has-heading-one',
  'region',
  'color-contrast',
  'scrollable-region-focusable',
];

/**
 * Runs axe on `container` and asserts there are no accessibility violations.
 * @param {HTMLElement} container - The rendered element to analyze.
 * @returns {Promise<void>} Resolves when the assertion passes.
 */
export async function assertNoAxeViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    rules: Object.fromEntries(DISABLED_RULES.map((id) => [id, { enabled: false }])),
  });
  const messages = results.violations.map(
    (v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => `${n.target.join(' ')} (${n.html})`).join(', ')}`,
  );
  expect(messages, `axe violations:\n${messages.join('\n')}`).toEqual([]);
}
