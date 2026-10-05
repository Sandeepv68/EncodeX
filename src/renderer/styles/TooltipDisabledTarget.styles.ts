import { styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

/**
 * Non-interactive inline box used to give a MUI {@link Tooltip} something to
 * attach its hover/focus handlers to when the real trigger is disabled.
 *
 * A `disabled` MUI button stops emitting pointer events, so a Tooltip wrapped
 * directly around one can never open - the user hovers a visibly inert control
 * and is told nothing. Wrapping it in a focusable `span` restores the tooltip
 * and is also what keeps the affordance reachable by keyboard, which is the
 * real accessibility defect: an `aria-label` on a control that cannot be
 * focused or hovered is not announced at all.
 *
 * `display: inline-flex` preserves the button's layout box; `width: fit-content`
 * stops the wrapper from stretching inside a flex row.
 */
export const DisabledTooltipTarget = styled('span')(({ theme }: { theme: Theme }) => ({
  display: 'inline-flex',
  width: 'fit-content',
  // The wrapper itself is the focus target, so it needs a visible ring; the
  // button underneath keeps its own outline suppressed while disabled.
  '&:focus-visible': {
    outline: `${theme.typography.pxToRem(2)} solid currentColor`,
    outlineOffset: theme.typography.pxToRem(2),
  },
}));
