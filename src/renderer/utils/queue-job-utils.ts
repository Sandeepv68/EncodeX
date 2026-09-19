import { QUEUE_STATUS } from '../../shared/media-options';
import { MEDIA_INPUT_EXTENSIONS, isImageFile } from '../../shared/file-extensions';
import type { QueueJob, ConversionOptions, HwAccelMode } from '../../shared/types';
import { basename, normalizePath } from './path-utils';
import { buildBatchOptions, buildOutputPath, type BatchEncodingValues } from './batch-options';

/**
 * MUI Chip color props used for the queue-status chip.
 * @typedef {string} StatusChipColor
 */
export type StatusChipColor = 'default' | 'primary' | 'success' | 'error' | 'warning';

/**
 * Returns true while a queue job still represents outstanding work (waiting or
 * running). Completed (DONE) and failed (ERROR) jobs are excluded.
 * @param {QueueJob} job - The queue job to classify.
 * @returns {boolean} True for QUEUED or RUNNING jobs.
 */
export function isJobActive(job: QueueJob): boolean {
  return job.status === QUEUE_STATUS.QUEUED || job.status === QUEUE_STATUS.RUNNING;
}

/**
 * Maps QUEUE_STATUS values to MUI Chip color props used for the status chip.
 * @param {string} status - The queue-job status value.
 * @returns {StatusChipColor} The MUI Chip color.
 */
export function statusChipColor(status: string): StatusChipColor {
  switch (status) {
    case QUEUE_STATUS.QUEUED:
      return 'warning';
    case QUEUE_STATUS.RUNNING:
      return 'primary';
    case QUEUE_STATUS.DONE:
      return 'success';
    case QUEUE_STATUS.ERROR:
      return 'error';
    default:
      return 'default';
  }
}

/**
 * A single validated enqueue request, ready for the IPC call.
 * @interface EnqueueDraft
 * @property {string} file - The source file path.
 * @property {string} output - The derived output path.
 * @property {ConversionOptions} options - The built conversion options.
 * @property {string} transcoder - The transcoder value.
 * @property {boolean} overwrite - Whether overwrite is enabled.
 */
export interface EnqueueDraft {
  file: string;
  output: string;
  options: ConversionOptions;
  transcoder: string;
  overwrite: boolean;
}

/**
 * Result of planning a set of batch enqueues.
 * @interface EnqueuePlan
 * @property {EnqueueDraft[]} enqueues - Validated drafts, one per accepted file.
 * @property {string[]} skippedNames - Basenames of rejected files (in order).
 */
export interface EnqueuePlan {
  enqueues: EnqueueDraft[];
  skippedNames: string[];
}

/**
 * Inputs shared by every selection while planning enqueues.
 * @interface PlanEnqueuesContext
 */
export interface PlanEnqueuesContext {
  selections: Array<{ file: string; operation: string }>;
  currentJobs: QueueJob[];
  outputDir: string;
  enc: BatchEncodingValues;
  hw: { hardwareAcceleration: boolean; hwaccelMode: HwAccelMode };
  suffix: string;
  transcoder: string;
  overwrite: boolean;
}

/**
 * Extracts the lowercase file extension from a path. Dotfiles (`.env`) have no
 * extension because a leading dot is not an extension separator.
 * @param {string} file - The file path to process.
 * @returns {string} The extension without a leading dot, or '' when there is none.
 */
function getSourceExtension(file: string): string {
  const base = basename(file);
  const dotIdx = base.lastIndexOf('.');
  return dotIdx > 0 ? base.slice(dotIdx + 1).toLowerCase() : '';
}

/**
 * Validates and de-duplicates a batch of file selections and builds the ready
 * enqueue drafts. Files whose extension does not fit their operation (images
 * for compress-image, non-images otherwise), files outside the supported
 * media-extension set, files whose input+output pair is already queued, and
 * files whose computed output path is already claimed by another queued job or
 * an earlier selection in this batch are skipped and reported by name. The
 * caller keeps all side effects (IPC calls, toasts, notifications).
 * @param {PlanEnqueuesContext} ctx - Selection and encoding-context inputs.
 * @returns {EnqueuePlan} The validated drafts and skipped basenames.
 */
export function planEnqueues(ctx: PlanEnqueuesContext): EnqueuePlan {
  const existingKeys = new Set(ctx.currentJobs.map((job: QueueJob) => `${normalizePath(job.input)}|${normalizePath(job.output)}`));
  const existingOutputs = new Set(ctx.currentJobs.map((job: QueueJob) => normalizePath(job.output)));
  const skippedNames: string[] = [];
  const enqueues: EnqueueDraft[] = [];
  for (const { file, operation } of ctx.selections) {
    const normalized = normalizePath(file);
    const expectsImage = operation === 'compress_image';
    const sourceExt = getSourceExtension(file);
    const isMedia = MEDIA_INPUT_EXTENSIONS.includes(sourceExt as (typeof MEDIA_INPUT_EXTENSIONS)[number]);
    if (expectsImage !== isImageFile(file) || !isMedia) {
      skippedNames.push(basename(file));
      continue;
    }
    const outFile = buildOutputPath({
      file,
      operation,
      sourceExt,
      container: ctx.enc.container,
      audioCodec: ctx.enc.audioCodec,
      videoCodec: ctx.enc.videoCodec,
      outputDir: ctx.outputDir,
      suffix: ctx.suffix,
    });
    const key = `${normalized}|${normalizePath(outFile)}`;
    if (existingKeys.has(key) || existingOutputs.has(normalizePath(outFile))) {
      skippedNames.push(basename(file));
      continue;
    }
    existingKeys.add(key);
    existingOutputs.add(normalizePath(outFile));
    enqueues.push({
      file,
      output: outFile,
      options: buildBatchOptions(operation, ctx.enc, ctx.hw),
      transcoder: ctx.transcoder,
      overwrite: ctx.overwrite,
    });
  }
  return { enqueues, skippedNames };
}
