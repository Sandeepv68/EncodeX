/**
 * @fileoverview Wall-clock watchdog for bounded subprocess work.
 *
 * Every ffmpeg/ffprobe call site in the main process used to build its own
 * promise with no upper bound, so a corrupt file (or a wedged binary) left the
 * promise pending forever. The pending promise is only half the damage: the
 * child process keeps running and burning CPU long after the user has given up
 * on the operation. A watchdog is therefore only useful if it *kills* the
 * process it is watching, which is what {@link withTimeout} does.
 *
 * Exports:
 *  - withTimeout()      - run bounded work under a wall-clock budget
 *  - isValidTimeout()   - the budget validity rule, exported for its own tests
 *  - TIMEOUT_* constants - budgets for the bounded call sites
 *
 * **This is only for bounded work.** A conversion legitimately runs for hours
 * and the player's decoder is a continuous stream, so `convert()` and
 * `frame-decoder.ts` must never be wrapped in {@link withTimeout}; they are
 * bounded by `CLI_CONVERSION_TIMEOUT_MS` (user-tunable via `--timeout`), by
 * explicit user cancellation, and by `PLAYER_FRAME_TIMEOUT_MS` in
 * `src/main/ipc/player.ts` respectively.
 */

import { Logger } from '../shared/logger';
import { createError, ErrorCode, ERROR_MESSAGES } from '../shared/errors';
import { KILL_SIGNAL } from '../shared/transcoder-constants';
import { LOG_SUBPROCESS_TIMEOUT_INVALID, LOG_SUBPROCESS_TIMEOUT_KILL_FAILED, LOG_SUBPROCESS_TIMED_OUT } from '../shared/log-constants';
import type { AppError } from '../shared/types';

/** Budget for decoding a single downscaled image frame for a histogram. */
export const IMAGE_HISTOGRAM_TIMEOUT_MS = 15000;

/** Budget for decoding a single preview frame from a video. */
export const VIDEO_PREVIEW_TIMEOUT_MS = 15000;

/**
 * Budget for a single bounded timeline extract subprocess (waveform peaks,
 * thumbnail strips, container probes).
 *
 * Generous because these run under a concurrency semaphore: only
 * `MAX_CONCURRENT_FFMPEG` children spawn at a time, so a hostile file is drained
 * in waves of this budget rather than in one. Total wall time for an extractor
 * is therefore roughly `ceil(spawns / MAX_CONCURRENT_FFMPEG) *
 * TIMELINE_EXTRACT_TIMEOUT_MS` — bounded and predictable, but not this constant.
 */
export const TIMELINE_EXTRACT_TIMEOUT_MS = 30000;

/**
 * Logger for the spawn watchdog.
 * @const {Logger} log
 */
const log = new Logger('main/spawn-timeout');

/**
 * The minimum a watchdog needs in order to stop runaway work.
 *
 * Declared with method syntax on purpose: that makes `kill`'s parameter
 * bivariant under `strictFunctionTypes`, so both a Node `ChildProcess`
 * (`kill(signal?: NodeJS.Signals | number)`) and a fluent-ffmpeg `FfmpegCommand`
 * (`kill(signal: string)`) satisfy it without an adapter at each call site.
 */
export interface Killable {
  kill(signal?: string | number | NodeJS.Signals): unknown;
}

/**
 * Starts bounded work and hands the watchdog whatever needs killing.
 *
 * `onSpawn` is called synchronously, immediately after the process is created.
 * It may be called more than once (last registration wins) or not at all, which
 * is why the watchdog treats a missing target as "nothing to kill" rather than
 * as a programming error.
 */
export type SpawnStarter<T> = (onSpawn: (target: Killable) => void) => Promise<T>;

/**
 * Reports whether a timeout budget is usable.
 *
 * A budget must be a positive finite number. `0`, negatives, `NaN`, and
 * `Infinity` are all rejected: each of them turns the watchdog into either an
 * instant kill or no watchdog at all, and both outcomes are silent. Callers get
 * an explicit rejection instead.
 *
 * @param {unknown} ms - The candidate budget in milliseconds.
 * @returns {boolean} True when `ms` is a positive, finite number.
 */
export function isValidTimeout(ms: unknown): ms is number {
  return typeof ms === 'number' && Number.isFinite(ms) && ms > 0;
}

/**
 * Renders an arbitrary rejected budget without throwing.
 *
 * `String(symbol)` and a throwing `toString` both raise, and this runs on the
 * error path where a second failure would replace the real diagnostic.
 *
 * @param {unknown} ms - The unusable budget value.
 * @returns {string} A printable description of the value and its type.
 */
function describeBudget(ms: unknown): string {
  return `${typeof ms} ${String(ms)}`;
}

/**
 * Builds the error used when a bounded subprocess outlives its budget.
 *
 * The detail says "timed out" deliberately: it keeps the string readable in a
 * log and, if the error is ever rethrown raw rather than as this AppError,
 * `inferErrorCode` still classifies it as a timeout rather than as whatever the
 * label happens to mention.
 *
 * @param {string} label - Human-readable name of the operation, e.g. `'ffprobe'`.
 * @param {number} timeoutMs - The budget that was exceeded.
 * @returns {AppError} An `OPERATION_TIMED_OUT` AppError naming the label and budget.
 */
function timedOutError(label: string, timeoutMs: number): AppError {
  return createError(
    ErrorCode.OPERATION_TIMED_OUT,
    ERROR_MESSAGES[ErrorCode.OPERATION_TIMED_OUT],
    `${label} timed out after ${timeoutMs}ms`,
  );
}

/**
 * Builds the error used when a call site passes a budget that cannot work.
 *
 * @param {string} label - Human-readable name of the operation.
 * @param {unknown} timeoutMs - The unusable budget value.
 * @returns {AppError} An `OPERATION_TIMED_OUT` AppError explaining the refusal.
 */
function invalidBudgetError(label: string, timeoutMs: unknown): AppError {
  return createError(
    ErrorCode.OPERATION_TIMED_OUT,
    ERROR_MESSAGES[ErrorCode.OPERATION_TIMED_OUT],
    `refusing to run "${label}" with an unusable timeout budget (${describeBudget(timeoutMs)})`,
  );
}

/**
 * Kills an overrunning target, swallowing any failure.
 *
 * A kill can legitimately fail — the child may have exited in the microseconds
 * between the timer firing and this call, and `child.kill()` returns `false` for
 * an already-dead process. None of that may replace the timeout we are already
 * reporting, so failures are logged and dropped.
 *
 * @param {Killable | null} target - The registered process, or null if none was.
 * @param {string} label - Human-readable name of the operation, for logging.
 */
function killQuietly(target: Killable | null, label: string): void {
  if (!target) return;
  try {
    target.kill(KILL_SIGNAL);
  } catch (err) {
    log.warn(LOG_SUBPROCESS_TIMEOUT_KILL_FAILED, label, err);
  }
}

/**
 * Runs bounded work under a wall-clock budget, killing the process on overrun.
 *
 * `start` receives an `onSpawn` callback to register whatever must be killed if
 * the budget is exhausted. The returned promise settles with the work's own
 * result, or — when the budget is exhausted — with an `OPERATION_TIMED_OUT`
 * AppError after the registered target has been killed.
 *
 * The watchdog timer is always consumed or cleared: it fires on the timeout
 * path and is cleared on every other path, so a settled call never leaves a
 * pending handle behind. It is deliberately *not* `unref`'d: an unref'd timer
 * could let the event loop drain between a child's `close` and the settlement
 * of the promise built from it, losing the result.
 *
 * @template T - The resolved type of the bounded work.
 * @param {SpawnStarter<T>} start - Starts the work and registers the kill target.
 * @param {number} timeoutMs - The budget in milliseconds; must be positive and finite.
 * @param {string} label - Human-readable name of the operation, used in logs and errors.
 * @returns {Promise<T>} The work's result, or a rejection if the budget is exhausted
 *   or the budget itself was unusable.
 * @throws {never} Never throws synchronously; every failure is a rejection.
 */
export function withTimeout<T>(start: SpawnStarter<T>, timeoutMs: number, label: string): Promise<T> {
  if (!isValidTimeout(timeoutMs)) {
    const err = invalidBudgetError(label, timeoutMs);
    log.error(LOG_SUBPROCESS_TIMEOUT_INVALID, label, err.detail);
    return Promise.reject(err);
  }

  let target: Killable | null = null;
  let work: Promise<T>;
  try {
    work = start((spawned) => {
      target = spawned;
    });
  } catch (err) {
    return Promise.reject(err);
  }

  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timer = null;
      killQuietly(target, label);
      log.error(LOG_SUBPROCESS_TIMED_OUT, label, timeoutMs);
      reject(timedOutError(label, timeoutMs));
    }, timeoutMs);

    const clearWatchdog = (): void => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    work.then(
      (value) => {
        clearWatchdog();
        resolve(value);
      },
      (err) => {
        clearWatchdog();
        reject(err);
      },
    );
  });
}
