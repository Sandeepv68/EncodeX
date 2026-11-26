/** Types for toast variant presentation tokens. */

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/** Presentation settings for a single toast variant. */
export interface ToastVariantToken {
  icon: IconDefinition;
  ariaLive: 'polite' | 'assertive';
}
