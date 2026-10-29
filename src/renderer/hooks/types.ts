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

/**
 * One shortcut binding registered by a component.
 * @interface HotkeyBinding
 * @property {string} id - Id of the shortcut spec in the registry; the spec
 *   supplies the chord and label.
 * @property {(event: KeyboardEvent) => void} handler - Invoked when the chord
 *   is pressed (and `enabled` is true). Receives the raw keyboard event.
 * @property {boolean} [enabled] - When false the binding is ignored for that
 *   keypress (but stays registered); defaults to true.
 * @property {boolean} [allowRepeat] - When true the binding also fires on
 *   auto-repeating keydown events (hold to repeat); defaults to false.
 */
export interface HotkeyBinding {
  id: string;
  handler: (event: KeyboardEvent) => void;
  enabled?: boolean;
  allowRepeat?: boolean;
}

/**
 * Structural subset of a store-owned media task that `useTaskRunControls` binds
 * to. Both RemuxState and DemuxState satisfy it (Demux adds `current`, which is
 * optional here so Remux single-invocation tasks simply report null).
 * @typedef {Object} TaskRunStoreState
 * @property {TaskProgress | null} progress - Live task progress, or null when idle.
 * @property {boolean} isConverting - Whether a task is currently running.
 * @property {boolean} isPaused - Whether the running task is paused.
 * @property {string | null} [current] - Label of the current sub-task (Demux),
 *   or null when the task is a single invocation.
 * @property {() => Promise<void>} pause - Pauses the running task.
 * @property {() => Promise<void>} resume - Resumes the paused task.
 * @property {() => Promise<void>} cancel - Cancels the task.
 */
export type TaskRunStoreState = {
  progress: TaskProgress | null;
  isConverting: boolean;
  isPaused: boolean;
  current?: string | null;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
};
