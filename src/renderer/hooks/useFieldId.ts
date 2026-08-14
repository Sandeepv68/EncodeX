/**
 * @fileoverview Shared hook for associating a field label with its control.
 *
 * Returns a stable id that can be handed to a control's `id` attribute and a
 * label's `htmlFor` attribute so the two are linked for screen readers and
 * click-to-focus. Mirrors the labeling behavior of {@link FormField} (which
 * uses `useId` internally) so hand-rolled `FieldBox`/`FieldLabel` rows get the
 * same accessible-name wiring.
 *
 * @param {string} [explicitId] - Optional explicit id; when provided it is
 *   returned unchanged, otherwise a fresh `useId` value is generated.
 * @returns {string} The id to use for both the label and the control.
 */

import { useId } from 'react';

export function useFieldId(explicitId?: string): string {
  return explicitId ?? useId();
}
