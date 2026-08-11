/**
 * @fileoverview Focus helper for failed form submissions.
 *
 * Moves keyboard/screen-reader focus to the first field that failed
 * validation so the user lands directly on the problem. Pages call this right
 * after `setErrors` in their validate path, passing the error map, the field
 * keys in visual order, and a testId lookup so the right input can be found.
 */

/**
 * Focuses the input of the first errored field.
 *
 * Iterates `fieldOrder` and, for the first key that has an error in `errors`,
 * looks up its testId and focuses the corresponding input (or the element
 * itself when it is an input). Does nothing when no errored field maps to a
 * focusable element, so pages without focus targets keep their current
 * behavior.
 *
 * @param {Record<string, string>} errors - Field key to error message map.
 * @param {readonly string[]} fieldOrder - Field keys in visual (top-to-bottom) order.
 * @param {Record<string, string>} testIdFor - Field key to data-testid map.
 * @returns {void}
 */
export function focusFirstError(errors: Record<string, string>, fieldOrder: readonly string[], testIdFor: Record<string, string>): void {
  for (const key of fieldOrder) {
    if (!errors[key]) continue;
    const testId = testIdFor[key];
    if (!testId) continue;
    const root = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (!root) continue;
    const input = root instanceof HTMLInputElement ? root : root.querySelector('input');
    if (input) {
      input.focus();
      return;
    }
  }
}
