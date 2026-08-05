/**
 * @fileoverview Type definitions for renderer hooks.
 * Defines codec option and task progress types used by conversion hooks.
 */

import type { ConversionProgress } from '../../shared/types';

/**
 * A selectable codec option grouped for display.
 * @interface CodecOption
 */
export interface CodecOption {
  value: string;
  label: string;
  group: string;
}

/**
 * Subset of conversion progress surfaced to media tasks.
 * @typedef {Pick<ConversionProgress, 'percent'|'time'|'speed'|'eta'>} TaskProgress
 */
export type TaskProgress = Pick<ConversionProgress, 'percent' | 'time' | 'speed' | 'eta'>;
