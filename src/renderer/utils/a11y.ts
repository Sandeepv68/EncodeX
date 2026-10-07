/**
 * @fileoverview Accessibility helpers shared across the renderer.
 *
 * `visuallyHidden` is the standard screen-reader-only style: the element keeps
 * its content in the accessibility tree while being visually removed from the
 * page. It is used to give empty structural cells (e.g. table header cells
 * holding only a checkbox column) discernible text without altering layout.
 */

import type { CSSProperties } from 'react';

/**
 * Inline style that hides content visually while keeping it in the
 * accessibility tree (screen-reader-only text).
 *
 * Used where a cell must carry real text for axe / AT but must not paint
 * anything: the classic case is a table header that holds only row-selection
 * checkboxes, whose `th` would otherwise violate axe's `empty-table-header`
 * (that check reads subtree content, so an `aria-label` on the `th` itself
 * does not count).
 * @const {CSSProperties}
 */
export const visuallyHidden: CSSProperties = {
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
};
