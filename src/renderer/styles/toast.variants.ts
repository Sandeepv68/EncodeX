/**
 * @fileoverview Visual tokens for each toast variant.
 *
 * Keeps severity presentation in one place: the icon, screen-reader politeness,
 * and test hook for every toast variant are defined here and consumed by the
 * unified toast viewport. MUI still supplies the filled severity colors.
 */

import { faCircleCheck, faCircleExclamation, faCircleInfo, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { ToastType } from '../stores/types';
import type { ToastVariantToken } from './toast.variants.types';

export type { ToastVariantToken } from './toast.variants.types';

/** Canonical presentation map for the four toast variants. */
export const TOAST_VARIANTS: Record<ToastType, ToastVariantToken> = {
  success: { icon: faCircleCheck, ariaLive: 'polite' },
  info: { icon: faCircleInfo, ariaLive: 'polite' },
  warning: { icon: faTriangleExclamation, ariaLive: 'polite' },
  error: { icon: faCircleExclamation, ariaLive: 'assertive' },
};
