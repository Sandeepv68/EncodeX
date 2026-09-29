import { QUEUE_STATUS } from '../../shared/media-options';
import { MEDIA_INPUT_EXTENSIONS, isImageFile } from '../../shared/file-extensions';
import { buildDemuxTargets } from '../../shared/codec-containers';
import type { QueueJob, ConversionOptions, HwAccelMode, MediaStreamInfo } from '../../shared/types';
import { basename, normalizePath, stem as getSourceStem } from './path-utils';
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
 * @property {Array<{ file: string; operation: string }>} selections - Files with
 *   their chosen batch operation.
 * @property {QueueJob[]} currentJobs - Jobs already in the queue.
 * @property {string} outputDir - Target output folder ('' = source-adjacent).
 * @property {BatchEncodingValues} enc - Shared encoding field values.
 * @property {{ hardwareAcceleration: boolean; hwaccelMode: HwAccelMode }} hw -
 *   Hardware-acceleration settings.
 * @property {string} suffix - Name suffix inserted before the extension.
 * @property {string} transcoder - Transcoder value for every job.
 * @property {boolean} overwrite - Overwrite flag for every job.
 * @property {(file: string) => Promise<MediaStreamInfo[]>} [probe] - Optional
 *   stream prober used by 'demux' (and only 'demux') to split each file into
 *   one job per extracted stream. Absent = the operation is skipped.
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
  probe?: (file: string) => Promise<MediaStreamInfo[]>;
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
 * ffprobe disposition marking cover-art (attached picture) streams, excluded
 * from batch demux extraction.
 * @const {string} ATTACHED_PIC_DISPOSITION
 */
const ATTACHED_PIC_DISPOSITION = 'attached_pic';

/**
 * Stream kinds a 'demux' batch extracts by default (all of them).
 * @const {Array<'video'|'audio'|'subtitle'>} DEFAULT_DEMUX_KINDS
 */
export const DEFAULT_DEMUX_KINDS: Array<'video' | 'audio' | 'subtitle'> = ['video', 'audio', 'subtitle'];

/**
 * Validates and de-duplicates a batch of file selections and builds the ready
 * enqueue drafts. 'transcode' / 'compress_image' / 'extract_audio' / 'remux'
 * produce one draft per accepted file; 'demux' probes each file (via the
 * optional `probe` context field) and produces ONE draft per extracted stream,
 * each carrying its own `-map` and output so the queue runner needs no changes.
 * Files whose extension does not fit their operation (images for
 * compress-image, non-images otherwise), files outside the supported
 * media-extension set, files that fail to probe or expose no stream of the
 * selected kinds, files whose input+output pair is already queued, and files
 * whose computed output path is already claimed by another queued job or an
 * earlier selection in this batch are skipped and reported by name. For demux a
 * file is reported once even when only some of its stream targets collide. The
 * caller keeps all side effects (IPC calls, toasts, notifications).
 * @param {PlanEnqueuesContext} ctx - Selection and encoding-context inputs.
 * @returns {Promise<EnqueuePlan>} The validated drafts and skipped basenames.
 */
export async function planEnqueues(ctx: PlanEnqueuesContext): Promise<EnqueuePlan> {
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
    const stem = getSourceStem(file);
    if (operation === 'demux') {
      if (!ctx.probe) {
        skippedNames.push(basename(file));
        continue;
      }
      let streams: MediaStreamInfo[];
      try {
        streams = (await ctx.probe(file)).filter((s) => !s.disposition?.includes(ATTACHED_PIC_DISPOSITION));
      } catch {
        skippedNames.push(basename(file));
        continue;
      }
      const kinds = ctx.enc.demuxKinds && ctx.enc.demuxKinds.length > 0 ? ctx.enc.demuxKinds : DEFAULT_DEMUX_KINDS;
      const selected = streams.filter((s) => s.type && kinds.includes(s.type));
      if (selected.length === 0) {
        skippedNames.push(basename(file));
        continue;
      }
      const targets = buildDemuxTargets(file, stem, selected, {
        videoContainer: ctx.enc.demuxVideoContainer,
        audioCodec: ctx.enc.demuxAudioCodec,
        subtitleCodec: ctx.enc.demuxSubtitleFormat,
      });
      let anySkipped = false;
      for (const target of targets) {
        const ext = target.output.slice(target.output.lastIndexOf('.') + 1).toLowerCase();
        const withoutExt = target.output.slice(0, target.output.lastIndexOf('.'));
        const prefix = `${stem}.`;
        const streamName = withoutExt.startsWith(prefix) ? withoutExt.slice(prefix.length) : withoutExt;
        const outFile = buildOutputPath({
          file,
          operation,
          sourceExt,
          container: ext,
          audioCodec: ctx.enc.audioCodec,
          videoCodec: ctx.enc.videoCodec,
          outputDir: ctx.outputDir,
          suffix: ctx.suffix,
          streamName,
        });
        const key = `${normalized}|${normalizePath(outFile)}`;
        if (existingKeys.has(key) || existingOutputs.has(normalizePath(outFile))) {
          anySkipped = true;
          continue;
        }
        existingKeys.add(key);
        existingOutputs.add(normalizePath(outFile));
        enqueues.push({
          file,
          output: outFile,
          options: buildBatchOptions('demux', { ...ctx.enc, demuxKind: target.kind, demuxMap: target.map }, ctx.hw),
          transcoder: ctx.transcoder,
          overwrite: ctx.overwrite,
        });
      }
      if (anySkipped) skippedNames.push(basename(file));
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
