/**
 * @fileoverview Implementation of the `batch` CLI subcommand.
 * Expands input patterns, builds a conversion job per file (sharing the same
 * flags), and runs them through the in-memory {@link JobQueue} while rendering
 * one progress bar per active job. Enforces a per-job wall-clock timeout and
 * maps cancellation to the CLI cancellation exit code.
 */

import * as path from 'path';
import { JobQueue } from '../queue/job-queue';
import { QUEUE_STATUS } from '../../shared/media-options';
import { DEFAULT_SUFFIX } from '../../shared/media-options';
import { MAX_QUEUE_CONCURRENCY, CLI_EXIT_TIMEOUT, CLI_EXIT_CANCELLED, CLI_EXIT_NOT_FOUND } from '../../shared/constants';
import { suggestedExtensionForVideoCodec } from '../../shared/codec-containers';
import { createError, ErrorCode } from '../../shared/errors';
import { createMultiBar, status, success, warn, cliConfig } from './cli-ui';
import { expandInputs, deriveOutputPath, getInputExtension } from './cli-util';
import { buildConversionOptions, resolveOutputPath } from './cli-convert';
import type { ConvertCliFlags } from './cli-convert';
import { resolveTranscoderType, transcoderLabel, CliExitError } from './cli-options';
import type { ConversionOptions, ConversionProgress, QueueJob } from '../../shared/types';
import type { CliThemeId } from '../cli-logo';

/**
 * Parameters for a batch conversion run.
 * @interface RunBatchParams
 * @property {string[]} inputs - Input file paths or glob patterns.
 * @property {string} [outputDir] - Directory to write outputs into (`--output-dir`).
 * @property {string} [suffix] - Suffix appended to each output stem (default `_converted`).
 * @property {ConvertCliFlags} flags - Conversion flags shared by every job.
 * @property {string} transcoder - Raw `--transcoder` backend value.
 * @property {number} [concurrency] - Max parallel conversions (default {@link MAX_QUEUE_CONCURRENCY}).
 * @property {number} timeoutSeconds - Per-job timeout in seconds.
 * @property {CliThemeId} themeId - Theme used to color the progress bars.
 */
export interface RunBatchParams {
  inputs: string[];
  outputDir?: string;
  suffix?: string;
  flags: ConvertCliFlags;
  transcoder: string;
  concurrency?: number;
  timeoutSeconds: number;
  themeId: CliThemeId;
}

/**
 * Runs a batch of conversions through the in-memory job queue.
 * @param {RunBatchParams} params - Batch parameters.
 * @returns {Promise<void>} Resolves when every job finishes; rejects with a
 *   {@link CliExitError} on timeout/cancellation or when no inputs match.
 */
export async function runBatch(params: RunBatchParams): Promise<void> {
  const files = expandInputs(params.inputs);
  if (files.length === 0) {
    throw new CliExitError(`No input files matched: ${params.inputs.join(', ')}`, CLI_EXIT_NOT_FOUND);
  }

  const transcoderType = resolveTranscoderType(params.transcoder);
  const options = buildConversionOptions(params.flags);
  const suffix = params.suffix ?? DEFAULT_SUFFIX;

  const outputFor = (file: string): string => {
    if (params.outputDir) {
      const outputExt = batchOutputExtension(file, options);
      return deriveOutputPath(file, { outputDir: params.outputDir, suffix, outputExt });
    }
    return resolveOutputPath(file, params.flags, options);
  };

  if (!cliConfig.quiet) {
    status(`Batch: ${files.length} file${files.length === 1 ? '' : 's'} (${transcoderLabel(transcoderType)})`);
  }

  const queue = new JobQueue({ concurrency: clampConcurrency(params.concurrency) });
  const multibar = createMultiBar(params.themeId);
  const bars = new Map<string, { update: (percent: number, payload: Record<string, unknown>) => void; stop: () => void }>();

  let done = 0;
  let failed = 0;
  const total = files.length;
  const startedAt = new Map<string, number>();
  const finished = new Promise<void>((resolve, reject) => {
    let settled = false;
    let watchdog: ReturnType<typeof setInterval> | null = null;

    const finish = (err?: unknown): void => {
      if (settled) return;
      settled = true;
      if (watchdog) clearInterval(watchdog);
      if (err) reject(err);
      else resolve();
    };

    queue.on('statusChange', (job: QueueJob) => {
      if (job.status === QUEUE_STATUS.RUNNING) startedAt.set(job.id, Date.now());
      if (job.status === QUEUE_STATUS.DONE || job.status === QUEUE_STATUS.ERROR) {
        done += 1;
        if (job.status === QUEUE_STATUS.ERROR) {
          failed += 1;
          warn(`${path.basename(job.input)} failed: ${job.error ?? 'unknown error'}`);
        } else {
          success(`Converted ${job.input} → ${job.output}`);
        }
        bars.get(job.id)?.stop();
        bars.delete(job.id);
        if (done === total) finish();
      }
    });

    queue.on('progress', (data: { job: QueueJob; progress: ConversionProgress }) => {
      const bar = bars.get(data.job.id);
      if (bar) {
        bar.update(data.progress.percent, {
          time: data.progress.time,
          speed: data.progress.speed,
          fps: data.progress.fps,
          eta: data.progress.eta,
          bitrate: data.progress.bitrate,
        });
      }
    });

    queue.on('cancelled', () => {
      finish(new CliExitError('Batch cancelled', CLI_EXIT_CANCELLED));
    });

    watchdog = setInterval(() => {
      const now = Date.now();
      for (const [id, start] of startedAt) {
        if (now - start > params.timeoutSeconds * 1000) {
          queue.cancelAll();
          finish(new CliExitError('Batch timed out', CLI_EXIT_TIMEOUT));
          return;
        }
      }
    }, 1000);
  });

  for (const file of files) {
    const output = outputFor(file);
    const id = queue.addJob(file, output, options, transcoderType);
    bars.set(id, createBatchBar(multibar, path.basename(file)));
  }

  const onSigint = (): void => queue.cancelAll();
  process.once('SIGINT', onSigint);

  try {
    await finished;
  } finally {
    process.removeListener('SIGINT', onSigint);
    multibar?.stop();
  }

  if (failed > 0) {
    throw createError(ErrorCode.CONVERSION_FAILED, `Batch finished with ${failed} failure${failed === 1 ? '' : 's'}`);
  }
}

/**
 * Derives the output extension for a batch job, mirroring the single-conversion
 * naming in {@link resolveOutputPath}: copy mode and audio-only jobs keep the
 * source extension, otherwise the codec's suggested container extension is used
 * with the source extension as a fallback.
 * @param {string} file - Input file path.
 * @param {ConversionOptions} options - Built conversion options.
 * @returns {string} The output extension (without dot).
 */
function batchOutputExtension(file: string, options: ConversionOptions): string {
  const copyMode = options.copy === true;
  const videoOff = options.video === false;
  if (copyMode || videoOff) return getInputExtension(file);
  return suggestedExtensionForVideoCodec(options.videoCodec) || getInputExtension(file);
}

/**
 * Clamps a requested concurrency into the queue's supported range.
 * @param {number} [requested] - Requested concurrency.
 * @returns {number} A positive integer capped at {@link MAX_QUEUE_CONCURRENCY}.
 */
function clampConcurrency(requested?: number): number {
  const n = Number(requested);
  if (!Number.isFinite(n) || n < 1) return MAX_QUEUE_CONCURRENCY;
  return Math.min(Math.floor(n), MAX_QUEUE_CONCURRENCY);
}

/**
 * Creates (or reuses) a per-job progress bar in the batch MultiBar container.
 * Returns a no-op adapter when no container is active (non-TTY).
 * @param {ReturnType<typeof createMultiBar>} multibar - The active MultiBar.
 * @param {string} label - Job label shown before the bar.
 * @returns {{ update: (p: number, payload: Record<string, unknown>) => void; stop: () => void }} A bar adapter.
 */
function createBatchBar(
  multibar: ReturnType<typeof createMultiBar>,
  label: string,
): { update: (percent: number, payload: Record<string, unknown>) => void; stop: () => void } {
  if (!multibar) {
    return { update: () => {}, stop: () => {} };
  }
  const bar = multibar.create(100, 0, { label });
  return { update: (percent, payload) => bar.update(percent, payload), stop: () => bar.stop() };
}
