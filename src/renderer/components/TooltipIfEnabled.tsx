/**
 * @fileoverview Tooltip that stays usable when its trigger is disabled.
 *
 * MUI warns when a `Tooltip`'s child is a `disabled` button, and the warning is
 * correct: a disabled MUI button has `pointer-events: none`, so the Tooltip
 * never receives `mouseenter` and can never open. The user hovers a visibly
 * inert control and gets nothing, and because the control cannot take focus
 * either, its `aria-label` is unreachable by keyboard. That is a real
 * accessibility defect rather than a cosmetic warning, which is why the fix
 * here is structural instead of an allowlist entry.
 *
 * The wrapper is only inserted when the child is actually disabled. An always-on
 * wrapper would add a focusable element to every enabled button in the app,
 * putting an extra tab stop in front of controls that already work.
 *
 * Props (see {@link TooltipIfEnabledProps}):
 *  - title: the tooltip text.
 *  - placement: passed through to MUI's `Tooltip`.
 *  - children: the trigger element, forwarded untouched.
 */

import { Children, isValidElement } from 'react';
import { Tooltip } from '@mui/material';
import type { ReactNode } from 'react';
import type { TooltipIfEnabledProps } from './types';
import { DisabledTooltipTarget } from '../styles/TooltipDisabledTarget.styles';

/**
 * Reads the `disabled` flag off an element's props without asserting its type.
 *
 * `children.props` is `unknown` to TypeScript, and the child here can be a
 * styled MUI button, a plain `button`, or something entirely unrelated, so the
 * narrowing is deliberately shallow: anything that is not an object is treated
 * as "not disabled", which is the safe direction (no wrapper, no behaviour
 * change).
 * @param {ReactNode} child - The prospective tooltip child.
 * @returns {boolean} True when the child declares `disabled`.
 */
function isDisabledChild(child: ReactNode): boolean {
  if (!isValidElement(child)) return false;
  const props = child.props as { disabled?: unknown } | null;
  return props !== null && typeof props === 'object' && props.disabled === true;
}

/**
 * Renders an MUI `Tooltip` whose trigger still works when disabled.
 * @param {TooltipIfEnabledProps} props - Component props.
 * @param {ReactNode} props.title - Tooltip text.
 * @param {ReactElement} props.children - The trigger element.
 * @param {'bottom' | 'left' | 'right' | 'top' | 'bottom-end' | 'bottom-start' | 'left-end' | 'left-start' | 'right-end' | 'right-start' | 'top-end' | 'top-start'} [props.placement]
 *   - MUI placement.
 * @returns {JSX.Element} The tooltip, with a focusable wrapper only when needed.
 */
export default function TooltipIfEnabled({ title, placement, children }: TooltipIfEnabledProps) {
  const child = Children.only(children);
  const placementProps = placement ? { placement } : {};

  if (!isDisabledChild(child)) {
    return (
      <Tooltip title={title} {...placementProps}>
        {child}
      </Tooltip>
    );
  }

  return (
    <Tooltip title={title} {...placementProps}>
      {/*
        No `role` here on purpose. MUI's popup already carries `role="tooltip"`,
        and giving the wrapper the same role would put two elements with that
        role in the tree for one tooltip; AT would then announce the trigger's
        own label as if it were the popup's contents. A focusable element with
        an `aria-label` is announced by its label, which is the whole point.
      */}
      <DisabledTooltipTarget tabIndex={0} aria-label={typeof title === 'string' ? title : undefined}>
        {child}
      </DisabledTooltipTarget>
    </Tooltip>
  );
}
