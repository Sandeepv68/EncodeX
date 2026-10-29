import type { ConversionProgress, TaskProgress } from './types';

export type { TaskProgress } from './types';

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
