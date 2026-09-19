import type { ConversionProgress } from './types';

/**
 * Subset of conversion progress surfaced to task-oriented UI (audio
 * extraction, media-task hooks). Shares a name with the structurally-identical
 * `TaskProgress` type in the stores/state layer; keep both in sync.
 * @typedef {Pick<ConversionProgress, 'percent'|'time'|'speed'|'eta'>} TaskProgress
 */
export type TaskProgress = Pick<ConversionProgress, 'percent' | 'time' | 'speed' | 'eta'>;

/**
 * Projects a raw ConversionProgress payload into the TaskProgress subset.
 * Consolidates the identical object literals previously built in
 * audioExtractStore and useMediaTask (refactor.md §5).
 * @param {ConversionProgress} progress - The raw conversion progress payload.
 * @returns {TaskProgress} The projected subset.
 */
export function toTaskProgress(progress: ConversionProgress): TaskProgress {
  return { percent: progress.percent, time: progress.time, speed: progress.speed, eta: progress.eta };
}
