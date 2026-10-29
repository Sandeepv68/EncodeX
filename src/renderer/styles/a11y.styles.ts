/**
 * @fileoverview Accessibility styling helpers shared across the renderer.
 *
 * `VisuallyHidden` is the standard screen-reader-only style: the element keeps
 * its content in the accessibility tree while being visually removed from the
 * page. It is used to give empty structural cells (e.g. table header cells
 * holding only a checkbox column) discernible text without altering layout.
 */

import { styled } from '@mui/material/styles';

/**
 * Hides content visually while keeping it in the accessibility tree
 * (screen-reader-only text).
 *
 * Used where a cell must carry real text for axe / AT but must not paint
 * anything: the classic case is a table header that holds only row-selection
 * checkboxes, whose `th` would otherwise violate axe's `empty-table-header`
 * (that check reads subtree content, so an `aria-label` on the `th` itself
 * does not count).
 *
 * Render a different tag with the `as` prop, e.g. `<VisuallyHidden as="h1">`.
 * @const VisuallyHidden
 */
export const VisuallyHidden = styled('span')({
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  border: 0,
  padding: 0,
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
});
