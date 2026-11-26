/** Types for the unified toast authoring facade. */

import type { ToastValues } from '../stores/types';

/** Interpolation values accepted by a translated toast message. */
export type { ToastValues } from '../stores/types';

/** Options shared by every toast variant. */
export interface NotifyOptions {
  values?: ToastValues;
  detail?: string;
  detailKey?: string;
  detailValues?: ToastValues;
  duration?: number;
  action?: { labelKey: string; onClick: () => void };
}
