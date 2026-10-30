/**
 * @fileoverview Guard for the Copilot page's decorative glow layer.
 *
 * The glow is built out of the three most expensive CSS properties there are:
 * a `filter: blur()` over a full-viewport layer, an animated `filter`
 * (hue-rotate) on each orb, and an animated `border-radius`. On the software
 * rendering a CI runner uses, that dropped the page to roughly 8 frames per
 * second and made the Windows e2e job exceed its 40-minute timeout.
 *
 * The full look is deliberately kept, so the guard below is not a performance
 * budget - a measured FPS budget would be a flaky gate, since it depends on
 * the runner, on what else is running, and on whether the machine has a GPU.
 * What is not machine-dependent is the *shape* of the effect: the layer is
 * blurred, the orbs morph their silhouette and cycle their hue, and the whole
 * thing is dropped for users who have asked for reduced motion. Those are the
 * properties asserted here.
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

/**
 * The property names a keyframe body animates.
 * @param {string} body - The keyframes body.
 * @returns {string[]} The distinct property names.
 */
function animatedProperties(body: string): string[] {
  const properties = body
    .split('}')
    .flatMap((block) => block.split(';'))
    .map((declaration) => declaration.split(':')[0]?.trim() ?? '')
    // A keyframe step's selector ("0%", "50%") is glued to its first
    // declaration once the braces are split off.
    .map((property) => property.replace(/^[^a-zA-Z-]*/, ''))
    // Vendor-prefixed duplicates of a property the browser already handles.
    .map((property) => property.replace(/^-(?:webkit|moz|ms)-/, ''))
    .filter((property) => property !== '' && !property.startsWith('from') && !property.startsWith('to'));

  return [...new Set(properties)].sort();
}

describe('Copilot glow layer', () => {
  it('blurs the glow layer', () => {
    const { container } = renderPage('Copilot');
    const layer = container.querySelector('.copilot-page-glow');
    const declarations = ruleFor(injectedCss(), emotionClass(layer));

    expect(declarations).not.toBe('');
    // The heavy blur over the full-bleed layer is what gives the orbs their
    // soft, out-of-focus look.
    expect(declarations).toMatch(/filter:\s*blur\(/);
  });

  it('animates the orbs with transform, hue and a morphing silhouette', () => {
    const { container } = renderPage('Copilot');
    const orb = container.querySelector('.copilot-page-glow > *');
    const declarations = ruleFor(injectedCss(), emotionClass(orb));

    expect(declarations).not.toBe('');

    const name = animationName(declarations);
    expect(name).not.toBe('');

    const body = keyframesBody(name);
    expect(body).not.toBe('');

    expect(animatedProperties(body)).toEqual(['border-radius', 'filter', 'transform']);
    // The hue cycles through the palette rather than sitting on one colour.
    expect(body).toMatch(/hue-rotate\(/);
  });

  it('fills the orbs with a radial gradient', () => {
    const { container } = renderPage('Copilot');
    const orbs = Array.from(container.querySelectorAll('.copilot-page-glow > *'));

    expect(orbs.length).toBeGreaterThan(0);
    for (const orb of orbs) {
      const declarations = ruleFor(injectedCss(), emotionClass(orb));
      expect(declarations).toMatch(/background:\s*radial-gradient\(/);
    }
  });

  it('drifts slowly and linearly', () => {
    const { container } = renderPage('Copilot');
    const orbs = Array.from(container.querySelectorAll('.copilot-page-glow > *'));

    expect(orbs.length).toBeGreaterThan(0);
    for (const orb of orbs) {
      const declarations = ruleFor(injectedCss(), emotionClass(orb));

      // A full cycle takes tens of seconds. Below roughly 30s the drift reads
      // as a sweep across the page rather than a slow ambient glow.
      const duration = Number(/(?:^|;)\s*animation:\s*[\w-]+\s+([\d.]+)s/.exec(declarations)?.[1]);
      expect(duration).toBeGreaterThanOrEqual(30);

      // The timeline is linear on purpose. Thirteen keyframes with an eased
      // timing function make every segment accelerate and settle, so the orbs
      // pulse instead of drifting.
      expect(declarations).toMatch(/animation:\s*[\w-]+\s+[\d.]+s\s+infinite\s+linear/);
    }
  });

  it('keeps the travel per keyframe small', () => {
    const { container } = renderPage('Copilot');
    const orb = container.querySelector('.copilot-page-glow > *');
    const name = animationName(ruleFor(injectedCss(), emotionClass(orb)));
    const body = keyframesBody(name);

    expect(body).not.toBe('');

    // The widest single step is 12vw of horizontal travel. Anything beyond
    // that, on a timeline this long, is a visible jerk between keyframes.
    const travels = [...body.matchAll(/translate\(\s*(-?\d+(?:\.\d+)?)vw/g)].map((match) => Math.abs(Number(match[1])));

    expect(travels.length).toBeGreaterThan(0);
    expect(Math.max(...travels)).toBeLessThanOrEqual(12);
  });

  it('stops the drift when the user asked for reduced motion', () => {
    const { container } = renderPage('Copilot');
    const orb = container.querySelector('.copilot-page-glow > *');
    const className = emotionClass(orb);

    const reduced = mediaRuleFor(injectedCss(), className, 'prefers-reduced-motion: reduce');
    expect(reduced).not.toBe('');
    expect(reduced).toMatch(/animation:\s*none/);
  });
});
