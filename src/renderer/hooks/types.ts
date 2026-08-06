/**
 * @fileoverview Type definitions for renderer hooks.
 * Defines the shape of the selectable codec options used by the conversion
 * pickers and the lightweight subset of conversion progress surfaced to
 * media-task hooks (audio extraction, GIF creation, etc.).
 */

import type { ConversionProgress } from '../../shared/types';

/**
 * A selectable codec option grouped for display in the codec dropdowns.
 * Each entry pairs an FFmpeg encoder name (the `value` sent to the main process)
 * with a human-readable label and a group heading that clusters related encoders
 * (e.g. 'Software', 'NVIDIA NVENC', 'Intel QSV', 'AAC / MPEG').
 * @interface CodecOption
 * @property {string} value - FFmpeg encoder/format name (e.g. 'libx264' or 'aac').
 * @property {string} label - Human-readable label shown in the UI.
 * @property {string} group - Display group the codec belongs to.
 */
export interface CodecOption {
  value: string;
  label: string;
  group: string;
}

/**
 * Subset of conversion progress surfaced to media tasks.
 * Extracts the four progress fields most relevant for display (percent, current
 * time, speed, and estimated remaining time) from the full ConversionProgress
 * payload emitted by the main process during a conversion.
 * @typedef {Pick<ConversionProgress, 'percent'|'time'|'speed'|'eta'>} TaskProgress
 * @property {number} percent - Progress percentage (0-100).
 * @property {string} time - Current output timestamp (HH:MM:SS).
 * @property {string} speed - Speed relative to realtime (e.g. '3.5x').
 * @property {string} eta - Estimated remaining time.
 */
export type TaskProgress = Pick<ConversionProgress, 'percent' | 'time' | 'speed' | 'eta'>;
