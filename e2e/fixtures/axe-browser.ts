/**
 * @fileoverview Real-browser axe helpers for Tier A e2e specs.
 *
 * The renderer unit tier cannot run `color-contrast` (jsdom resolves every
 * color to its initial value before any real paint) and has no real viewport,
 * so the browser tier is where the full rule set finally runs against the
 * shipped renderer: painted styles, a real document scaffold, and responsive
 * breakpoints resolved by Chromium's own `matchMedia`.
 *
 * axe-core ships a self-contained `source` string; it is injected into the
 * already-loaded page with `Runtime.evaluate` (bypassing any CSP that would
 * block a `<script>` element) rather than with `addInitScript`, which would
 * only apply on the *next* navigation. Injection surface is kept page-scoped:
 * axe never leaves the page under test.
 *
 * @see plans/ADVERSARIAL_TEST_HARDENING_PLAN.md, Phase 5 (browser tier)
 */

import type { Page } from 'playwright';
import axe from 'axe-core';

export interface AxeV1ImpactNode {
  target: string[];
  html: string;
  impact: string;
  failureSummary: string;
  /** The `any`/`all`/`none` checking results flattened to their messages. */
  checks: string[];
}

export interface AxeV1Violation {
  id: string;
  impact: string;
  help: string;
  nodes: AxeV1ImpactNode[];
}

export interface AxePageResult {
  violations: AxeV1Violation[];
  incomplete: string[];
}

/**
 * Injects `axe-core` into a live page unless it is already present.
 * @param {Page} page - The page to inject into.
 * @returns {Promise<void>} Resolves once `window.axe` is available.
 */
export async function injectAxe(page: Page): Promise<void> {
  const present = await page.evaluate(() => typeof (window as { axe?: unknown }).axe !== 'undefined');
  if (!present) {
    await page.evaluate(axe.source);
  }
}

/**
 * Runs the full axe-core rule set (including `color-contrast` and the
 * document-level rules) against the whole page.
 *
 * `rules`/`context` default to running everything on `document`, which is what
 * the browser tier is for -- paint and scaffold facts the unit tier cannot see.
 * @param {Page} page - The page under test.
 * @param {{ rules?: string[]; context?: string }} [options] - Optional rule ids
 * to restrict to, and an axe context selector.
 * @returns {Promise<AxePageResult>} Compact, serializable violation report.
 */
export async function runAxeOnPage(page: Page, options: { rules?: string[]; context?: string } = {}): Promise<AxePageResult> {
  await injectAxe(page);
  return page.evaluate(
    async ({ context, rules }) => {
      const config = rules ? { rules: Object.fromEntries(rules.map((id) => [id, { enabled: true }])) } : {};
      const frameAxe = (window as unknown as { axe: { run(context: unknown, config: object): Promise<AxeRun> } }).axe;
      const results = await frameAxe.run(context ?? document, config);
      return {
        violations: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact ?? '',
          help: v.help,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            html: n.html,
            impact: n.impact ?? '',
            failureSummary: n.failureSummary ?? '',
            checks: [...n.any, ...n.all, ...n.none].map((c) => `${c.id}: ${c.message}`),
          })),
        })),
        incomplete: results.incomplete.map((v) => v.id),
      } as AxePageResult;
    },
    { context: options.context, rules: options.rules },
  );
}

interface AxeRun {
  violations: Array<{
    id: string;
    impact?: string;
    help: string;
    nodes: Array<{
      target: string[];
      html: string;
      impact?: string;
      failureSummary?: string;
      any: Array<{ id: string; message: string }>;
      all: Array<{ id: string; message: string }>;
      none: Array<{ id: string; message: string }>;
    }>;
  }>;
  incomplete: Array<{ id: string }>;
}
