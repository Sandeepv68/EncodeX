/**
 * @fileoverview Render-cost regression guard for the Copilot page's decorative
 * glow layer.
 *
 * The glow is pure decoration, but it was originally built out of the three
 * most expensive CSS properties there are: a `filter: blur()` over a
 * full-viewport layer, an animated `filter` (hue-rotate) on each orb, and an
 * animated `border-radius`. Every one of those forces a full re-rasterisation
 * of a very large surface on every animation frame. On the software rendering
 * a CI runner uses, the page dropped to roughly 8 frames per second, which made
 * the Windows e2e job exceed its 40-minute timeout and get cancelled.
 *
 * The guard below is deliberately a *static* check on the generated CSS rather
 * than a frame-rate measurement. A measured FPS budget would be a flaky gate:
 * it depends on the runner, on what else is running, and on whether the
 * machine has a GPU - the same trap the cold-boot budget documents in
 * `e2e/specs/boot-budget.spec.ts`. What is not machine-dependent is the
 * property that actually matters here: an animation that only ever moves
 * `transform` and `opacity` is composited rather than repainted, on any
 * machine. So the test asserts the contract on the CSS itself.
 *
 * The rules are read out of the Emotion stylesheet that MUI's `styled` writes
 * into `document.head`, so the assertion is on the shipped CSS and not on the
 * shape of the source that produced it.
 */

import { describe, it, expect } from 'vitest';
import { renderPage } from '../../test-utils/page-render';

/** Class-name prefix Emotion gives every generated rule. */
const EMOTION_CLASS_PREFIX = 'css-';

/**
 * All CSS text Emotion has injected into the document.
 * @returns {string} The concatenated stylesheet.
 */
function injectedCss(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((tag) => tag.textContent ?? '')
    .join('\n');
}

/**
 * The Emotion class of an element.
 * @param {Element | null} element - The element to read.
 * @returns {string} The generated class name, or an empty string.
 */
function emotionClass(element: Element | null): string {
  if (!element) return '';
  return Array.from(element.classList).find((name) => name.startsWith(EMOTION_CLASS_PREFIX)) ?? '';
}

/**
 * The CSS block that follows a marker, matched with braces.
 *
 * A plain `indexOf('}')` would stop at the first nested block - and a
 * `@keyframes` body is nested one level per step - so the braces are counted
 * instead.
 * @param {string} css - The stylesheet to search.
 * @param {string} marker - The text that opens the block.
 * @returns {string} The block's contents, without the outermost braces.
 */
function blockAfter(css: string, marker: string): string {
  const start = css.indexOf(marker);
  if (start === -1) return '';
  const open = css.indexOf('{', start);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return '';
}

/**
 * The declarations of the rule that a class name selects.
 *
 * The class name appears in the rule's *selector*, so the rule's body starts at
 * the first `{` after the name - not at the nearest `{` before it, which would
 * be the opening brace of whatever block happens to precede the rule.
 * @param {string} css - The stylesheet to search.
 * @param {string} className - The generated class name.
 * @returns {string} The declarations, without the surrounding braces.
 */
function ruleFor(css: string, className: string): string {
  const hit = css.indexOf(`.${className}`);
  if (hit === -1) return '';
  const open = css.indexOf('{', hit);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return '';
}

/**
 * The declarations a class gets inside a media query.
 *
 * A stylesheet can hold several blocks for the same media query - one per
 * component that reacts to it - so every block is checked and the one naming
 * the class is used.
 * @param {string} css - The stylesheet to search.
 * @param {string} className - The generated class name.
 * @param {string} media - The media query text, e.g. `prefers-reduced-motion: reduce`.
 * @returns {string} The declarations, without the surrounding braces.
 */
function mediaRuleFor(css: string, className: string, media: string): string {
  const marker = `@media (${media})`;
  let from = 0;
  for (;;) {
    const start = css.indexOf(marker, from);
    if (start === -1) return '';
    const open = css.indexOf('{', start);
    if (open === -1) return '';
    let depth = 0;
    let close = -1;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close === -1) return '';
    const body = css.slice(open + 1, close);
    from = close + 1;
    if (!body.includes(`.${className}`)) continue;
    return ruleFor(body, className);
  }
}

/**
 * The body of an `@keyframes` block.
 * @param {string} name - The animation name.
 * @returns {string} The declarations inside the block.
 */
function keyframesBody(name: string): string {
  return blockAfter(injectedCss(), `@keyframes ${name}`);
}

/**
 * The animation name an element's rule runs.
 * @param {string} declarations - The rule body.
 * @returns {string} The animation name, or an empty string.
 */
function animationName(declarations: string): string {
  const match = /(?:^|;)\s*animation:\s*([\w-]+)/.exec(declarations);
  return match ? match[1] : '';
}

describe('Copilot glow layer render cost', () => {
  it('does not blur the glow layer', () => {
    const { container } = renderPage('Copilot');
    const layer = container.querySelector('.copilot-page-glow');
    const declarations = ruleFor(injectedCss(), emotionClass(layer));

    expect(declarations).not.toBe('');
    // A blur over a full-viewport layer re-rasterises the whole surface on
    // every frame the layer's contents move.
    expect(declarations).not.toMatch(/filter\s*:/);
    expect(declarations).not.toMatch(/backdrop-filter\s*:/);
  });

  it('animates only compositor-friendly properties on the orbs', () => {
    const { container } = renderPage('Copilot');
    const orb = container.querySelector('.copilot-page-glow > *');
    const declarations = ruleFor(injectedCss(), emotionClass(orb));

    expect(declarations).not.toBe('');

    const name = animationName(declarations);
    expect(name).not.toBe('');

    const body = keyframesBody(name);
    expect(body).not.toBe('');

    // `transform` and `opacity` are the two properties a compositor can move
    // without repainting the layer. Anything else - a `filter`, a changing
    // `border-radius`, a changing `background` - repaints the orb.
    const animated = body
      .split('}')
      .flatMap((block) => block.split(';'))
      .map((declaration) => declaration.split(':')[0]?.trim() ?? '')
      // A keyframe step's selector ("0%", "50%") is glued to its first
      // declaration once the braces are split off.
      .map((property) => property.replace(/^[^a-zA-Z-]*/, ''))
      // Vendor-prefixed duplicates of a property the compositor already handles.
      .map((property) => property.replace(/^-(?:webkit|moz|ms)-/, ''))
      .filter((property) => property !== '' && !property.startsWith('from') && !property.startsWith('to'));

    expect(animated.length).toBeGreaterThan(0);
    expect([...new Set(animated)].sort()).toEqual(['transform']);
  });

  it('softens the orbs with their own gradient rather than a filter', () => {
    const { container } = renderPage('Copilot');
    const orbs = Array.from(container.querySelectorAll('.copilot-page-glow > *'));

    expect(orbs.length).toBeGreaterThan(0);
    for (const orb of orbs) {
      const declarations = ruleFor(injectedCss(), emotionClass(orb));
      expect(declarations).not.toMatch(/filter\s*:/);
      // A gradient that reaches full transparency at its edge needs no blur to
      // look soft, and it survives the `border-radius` clip without showing a
      // hard rim.
      expect(declarations).toMatch(/background:\s*radial-gradient\(/);
      expect(declarations).toMatch(/transparent 100%\)/);
    }
  });

  it('stops the drift when the user asked for reduced motion', () => {
    const { container } = renderPage('Copilot');
    const orb = container.querySelector('.copilot-page-glow > *');
    const className = emotionClass(orb);
    const declarations = ruleFor(injectedCss(), className);

    expect(declarations).toMatch(/will-change:\s*transform/);

    const reduced = mediaRuleFor(injectedCss(), className, 'prefers-reduced-motion: reduce');
    expect(reduced).not.toBe('');
    expect(reduced).toMatch(/animation:\s*none/);
  });
});
