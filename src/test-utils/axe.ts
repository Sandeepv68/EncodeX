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
 *
 * `assertNoAxeViolations(container, { strict: true })` re-enables the rules
 * that only need DOM, not paint -- `region`, `landmark-one-main`, and
 * `scrollable-region-focusable` -- for suites that wrap each page in a real
 * `<main>` landmark (see the Phase 5.3 axe-all-pages suite). `color-contrast`
 * stays disabled: jsdom resolves every color to its empty/initial value, so
 * axe can never observe a real pair here.
 */

import axe from 'axe-core';
import { expect } from 'vitest';

const DEFAULT_DISABLED_RULES = [
  'bypass',
  'document-title',
  'html-has-lang',
  'landmark-one-main',
  'page-has-heading-one',
  'region',
  'color-contrast',
  'scrollable-region-focusable',
];

/** Rules strict mode re-enables; all are DOM-structural, not paint-dependent. */
const STRICT_REENABLED_RULES = ['region', 'landmark-one-main', 'scrollable-region-focusable'];

/** Options for {@link assertNoAxeViolations}. */
export interface AxeAssertOptions {
  /** Re-enables `region`, `landmark-one-main`, `scrollable-region-focusable`. */
  strict?: boolean;
}

/**
 * Runs axe on `container` and asserts there are no accessibility violations.
 * @param {HTMLElement} container - The rendered element to analyze.
 * @param {AxeAssertOptions} [options] - See {@link AxeAssertOptions}.
 * @returns {Promise<void>} Resolves when the assertion passes.
 */
export async function assertNoAxeViolations(container: HTMLElement, options: AxeAssertOptions = {}): Promise<void> {
  const disabled = options.strict ? DEFAULT_DISABLED_RULES.filter((id) => !STRICT_REENABLED_RULES.includes(id)) : DEFAULT_DISABLED_RULES;
  const results = await axe.run(container, {
    rules: Object.fromEntries(disabled.map((id) => [id, { enabled: false }])),
  });
  const messages = results.violations.map(
    (v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => `${n.target.join(' ')} (${n.html})`).join(', ')}`,
  );
  expect(messages, `axe violations:\n${messages.join('\n')}`).toEqual([]);
}
