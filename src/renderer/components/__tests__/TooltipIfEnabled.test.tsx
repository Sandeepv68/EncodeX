/**
 * @fileoverview Regression tests for the disabled-safe tooltip wrapper.
 *
 * The defect this guards against is an accessibility one, not a cosmetic one: a
 * MUI `Tooltip` wrapped directly around a `disabled` button can never open,
 * because a disabled MUI button has `pointer-events: none` and so never emits
 * the `mouseenter` the Tooltip listens for. The control also cannot take focus,
 * so its `aria-label` is unreachable by keyboard too. The user hovers a visibly
 * inert button and is told nothing about what it would have done.
 *
 * MUI emits a `console.warn` for this on every render, which is what made it
 * visible: enabling the tripwire's `strict` level turned 229 warnings across
 * two suites into one root cause. These tests exist so the fix cannot be undone
 * quietly by someone "simplifying" the wrapper away, and so the *enabled* path
 * is proved not to have regressed - a wrapper that is always applied would also
 * silence the warning while adding a phantom tab stop to every button.
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { Button } from '@mui/material';
import TooltipIfEnabled from '../TooltipIfEnabled';

/**
 * Makes `:focus-visible` matchable.
 *
 * jsdom does not implement the `:focus-visible` pseudo class, so
 * `element.matches(':focus-visible')` always returns false. MUI's `isFocusVisible`
 * is built on exactly that call and silently returns false when it throws or
 * fails, which means a Tooltip refuses to open on keyboard focus in jsdom no
 * matter how the markup is written. MUI's own source acknowledges this: "Tests
 * that rely on `:focus-visible` will still have to be skipped in jsdom."
 *
 * Rather than skip the assertion - keyboard reachability is the whole point of
 * the wrapper - the pseudo class is faked for the duration of the keyboard tests.
 * Every other selector keeps its real behaviour, so nothing else is masked.
 */
function mockFocusVisible(): () => void {
  const original = Element.prototype.matches;
  Element.prototype.matches = function matches(selector: string): boolean {
    if (selector === ':focus-visible') return true;
    return original.call(this, selector);
  };
  return () => {
    Element.prototype.matches = original;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Returns the element the `Tooltip` itself attached its handlers to.
 *
 * The child is located by visible text rather than by role and name because
 * MUI's Tooltip overwrites the child's accessible name with the title: a button
 * reading "Add" inside `<Tooltip title="Add files">` is exposed to assistive
 * technology as "Add files", so `getByRole('button', { name: 'Add' })` misses it
 * entirely. MUI also gives every button a `tabindex`, so that attribute cannot
 * discriminate either. The wrapper is simply the child's parent when one exists
 * and the child itself when it does not - which is exactly the distinction under
 * test.
 * @param {string} childText - Visible text of the trigger button.
 * @returns {HTMLElement} The Tooltip's real target element.
 */
function triggerTarget(childText: string): HTMLElement {
  const button = screen.getByText(childText);
  const parent = button.parentElement;
  return parent && parent.getAttribute('tabindex') === '0' ? parent : (button as HTMLElement);
}

/**
 * Hovers an element and lets the popup settle.
 *
 * `fireEvent.mouseOver` is used rather than `userEvent.hover` because userEvent
 * emulates a full pointer-event sequence, which a disabled MUI button intercepts
 * via `pointer-events: none`. That emulation is exactly the behaviour under
 * test being bypassed, so it would report success without proving anything.
 * @param {Element} element - The element to hover.
 */
async function hover(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.mouseOver(element);
  });
}

describe('TooltipIfEnabled', () => {
  it('opens the tooltip when the trigger is disabled', async () => {
    render(
      <TooltipIfEnabled title="Clear completed jobs">
        <Button disabled>Clear</Button>
      </TooltipIfEnabled>,
    );

    // Hovering the *wrapper* is what a user actually does, because a disabled
    // MUI button cannot be hovered at all - that is the entire defect.
    await hover(triggerTarget('Clear'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Clear completed jobs');
  });

  it('gives a disabled trigger a focusable wrapper that carries the label', () => {
    render(
      <TooltipIfEnabled title="Clear completed jobs">
        <Button disabled>Clear</Button>
      </TooltipIfEnabled>,
    );

    const wrapper = triggerTarget('Clear');
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper).toHaveAttribute('tabindex', '0');
    // Without this the wrapper is an anonymous focus stop: reachable, but
    // announced as nothing, which is the same defect in a subtler form.
    expect(wrapper).toHaveAccessibleName('Clear completed jobs');
  });

  it('does not give the wrapper role="tooltip", which would duplicate the popup', () => {
    render(
      <TooltipIfEnabled title="Clear completed jobs">
        <Button disabled>Clear</Button>
      </TooltipIfEnabled>,
    );

    // MUI's popup already claims role="tooltip". Two elements with that role
    // for one tooltip means AT announces the trigger's own label as the
    // popup's contents.
    expect(triggerTarget('Clear')).not.toHaveAttribute('role', 'tooltip');
  });

  it('opens the tooltip from the keyboard when the trigger is disabled', async () => {
    const restore = mockFocusVisible();
    try {
      render(
        <TooltipIfEnabled title="Clear completed jobs">
          <Button disabled>Clear</Button>
        </TooltipIfEnabled>,
      );

      const wrapper = triggerTarget('Clear');
      await act(async () => {
        wrapper.focus();
      });

      await waitFor(() => expect(document.activeElement).toBe(wrapper));
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Clear completed jobs');
    } finally {
      restore();
    }
  });

  it('adds no wrapper when the trigger is enabled', () => {
    render(
      <TooltipIfEnabled title="Add files">
        <Button>Add</Button>
      </TooltipIfEnabled>,
    );

    // A wrapper here would put an extra tab stop in front of a control that
    // already works, so "no warning" is not sufficient - the Tooltip's target
    // must be the button itself.
    expect(triggerTarget('Add').tagName).toBe('BUTTON');
  });

  it('still opens the tooltip for an enabled trigger', async () => {
    render(
      <TooltipIfEnabled title="Add files">
        <Button>Add</Button>
      </TooltipIfEnabled>,
    );

    await hover(triggerTarget('Add'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Add files');
  });

  it('treats disabled={false} as enabled', () => {
    render(
      <TooltipIfEnabled title="Add files">
        <Button disabled={false}>Add</Button>
      </TooltipIfEnabled>,
    );

    expect(triggerTarget('Add').tagName).toBe('BUTTON');
  });

  it('drops the aria-label for a non-string title rather than stringifying it', () => {
    render(
      <TooltipIfEnabled title={<em>Rich title</em>}>
        <Button disabled>Clear</Button>
      </TooltipIfEnabled>,
    );

    const wrapper = triggerTarget('Clear');
    expect(wrapper).toHaveAttribute('tabindex', '0');
    // A ReactNode title cannot become an aria-label; the guard must omit it
    // rather than produce "[object Object]".
    expect(wrapper.getAttribute('aria-label')).toBeNull();
  });
});
