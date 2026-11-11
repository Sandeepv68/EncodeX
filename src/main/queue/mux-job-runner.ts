/**
 * @fileoverview Sequential runner for a single remux/demux mux queue job.
 *
 * A mux job owns an ordered list of targets (one FFmpeg invocation each). The
 * runner executes them one after another - never in parallel - and aggregates
 * their progress into a single job-level percentage, so a demux of eight
 * streams reports one smooth 0..100 curve instead of eight jumps.
 *
 * The runner is deliberately independent of the queue engine: it knows how to
 * run one job's targets and reports progress, completion, and failure. The
 * queue owns status transitions, persistence, and scheduling.
 */

import { EventEmitter } from 'events';
import { ErrorCode, cancelledError } from '../../shared/errors';
import type { AppError, ConversionProgress, MuxQueueJob, MuxQueueTarget, TranscoderType } from '../../shared/types';
import { createTranscoder } from '../transcoders/factory';
import type { ITranscoder } from '../transcoders/types';
import { Logger } from '../../shared/logger';
import { COMPLETED_PROGRESS } from '../../shared/transcoder-constants';
import { LOG_MUX_RUNNER_TARGET_COMPLETED, LOG_MUX_RUNNER_TARGET_FAILED, LOG_MUX_RUNNER_TARGET_STARTED } from '../../shared/log-constants';

const log = new Logger('main/queue/mux-job-runner');

/**
 * Aggregates a target's own percentage into the job-level percentage.
 *
 * `((targetIndex + targetPercent / 100) / targetCount) * 100` means the first
 * of three targets spans 0..33%, the second 33..66%, and the third 66..100%.
 * @param {number} targetIndex - Zero-based index of the running target.
 * @param {number} targetCount - Total number of targets in the job.
 * @param {number} targetPercent - The running target's own percentage.
 * @returns {number} The job-level percentage, clamped to 0..100.
 */
export function aggregateProgress(targetIndex: number, targetCount: number, targetPercent: number): number {
  if (targetCount <= 0) return 0;
  const raw = Number.isFinite(targetPercent) ? targetPercent : 0;
  const clampedTarget = Math.min(Math.max(raw, 0), 100);
  const overall = ((targetIndex + clampedTarget / 100) / targetCount) * 100;
  return Math.min(Math.max(overall, 0), 100);
}

/**
 * Executes the targets of one mux queue job sequentially.
 * @class MuxJobRunner
 * @extends EventEmitter
 *
 * @emits {Object} 'progress' - `{ job, progress }` while a target runs
 * @emits {void} 'end' - Fired after the last target completed
 * @emits {Error} 'error' - Fired on the first failing target
 */
export class MuxJobRunner extends EventEmitter {
  /** The transcoder currently running a target, when any. */
  private current?: ITranscoder;
  /** True once the runner was cancelled; stops the target loop. */
  private cancelled = false;

  /**
   * Creates a runner for a job.
   * @param {MuxQueueJob} job - The job whose targets are executed.
   * @param {function(TranscoderType): ITranscoder} [transcoderFactory] -
   *   Factory used to create the transcoder for each target. Defaults to
   *   {@link createTranscoder}; overridable so tests can inject fakes.
   */
  constructor(
    private readonly job: MuxQueueJob,
    private readonly transcoderFactory: (type: TranscoderType) => ITranscoder = createTranscoder,
  ) {
    super();
  }

  /**
   * Runs every target of the job in order.
   *
   * Targets run strictly one after another: the next target starts only after
   * the previous one emitted `end`. The first failure stops the loop and is
   * reported through the `error` event; already completed targets keep their
   * files on disk.
   * @returns {void}
   */
  start(): void {
    void this.runTargets();
  }

  /**
   * Cancels the running target and stops the loop. The in-flight transcoder
   * reports the cancellation through its own error event, which the runner
   * maps onto the canonical CANCELLED error.
   * @returns {void}
   */
  cancel(): void {
    this.cancelled = true;
    this.current?.cancel();
  }

  /**
   * Suspends the running target's process.
   * @returns {void}
   */
  pause(): void {
    this.current?.pause();
  }

  /**
   * Resumes the running target's process.
   * @returns {void}
   */
  resume(): void {
    this.current?.resume();
  }

  /**
   * Runs the targets one by one, awaiting each completion.
   * @returns {Promise<void>} Resolves when every target completed.
   */
  private async runTargets(): Promise<void> {
    const targets = this.job.targets;
    try {
      for (let index = 0; index < targets.length; index += 1) {
        if (this.cancelled) throw cancelledError();
        const target = targets[index];
        await this.runTarget(target, index, targets.length);
        if (this.cancelled) throw cancelledError();
      }
      this.emit('end');
    } catch (err: unknown) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Runs a single target to completion.
   * @param {MuxQueueTarget} target - The target to run.
   * @param {number} index - Zero-based index of the target within the job.
   * @param {number} count - Total number of targets in the job.
   * @returns {Promise<void>} Resolves when the target completed.
   */
  private runTarget(target: MuxQueueTarget, index: number, count: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let transcoder: ITranscoder;
      try {
        transcoder = this.transcoderFactory(this.job.transcoder);
      } catch (err: unknown) {
        reject(this.describeTargetFailure(target, err));
        return;
      }
      this.current = transcoder;
      log.info(LOG_MUX_RUNNER_TARGET_STARTED, index + 1, count, target.output);
      let emitter: EventEmitter;
      try {
        emitter = transcoder.convert(this.job.input, target.output, target.options);
      } catch (err: unknown) {
        this.current = undefined;
        reject(this.describeTargetFailure(target, err));
        return;
      }
      emitter.on('progress', (progress: ConversionProgress) => {
        const percent = aggregateProgress(index, count, progress?.percent ?? 0);
        this.job.progress = percent;
        this.emit('progress', {
          job: this.job,
          progress: { ...progress, percent },
        });
      });
      emitter.on('error', (err: unknown) => {
        if (settled) return;
        settled = true;
        this.current = undefined;
        reject(this.describeTargetFailure(target, err));
      });
      emitter.on('end', () => {
        if (settled) return;
        settled = true;
        this.current = undefined;
        log.info(LOG_MUX_RUNNER_TARGET_COMPLETED, index + 1, count, target.output);
        resolve();
      });
    });
  }

  /**
   * Wraps a target failure with the target's label so the queue card shows
   * which of several outputs failed.
   * @param {MuxQueueTarget} target - The failing target.
   * @param {unknown} err - The original error.
   * @returns {Error | AppError} The error to report for the job.
   */
  private describeTargetFailure(target: MuxQueueTarget, err: unknown): Error | AppError {
    const original = err instanceof Error ? err : new Error(String(err));
    const code = (original as { code?: string }).code;
    if (code === ErrorCode.CANCELLED) {
      return cancelledError();
    }
    const label = target.label ?? target.output;
    log.error(LOG_MUX_RUNNER_TARGET_FAILED, label, original.message);
    const wrapped = new Error(`${label}: ${original.message}`);
    (wrapped as { code?: string }).code = (original as { code?: string }).code;
    return wrapped;
  }

  /**
   * The job-level percentage reported when every target completed.
   * @returns {number} The completed percentage.
   */
  static completedPercent(): number {
    return COMPLETED_PROGRESS.percent;
  }
}
