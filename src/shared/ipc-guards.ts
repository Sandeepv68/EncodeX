/**
 * @fileoverview Runtime shape guards for the push (`on*`) IPC channels.
 *
 * ## Why event channels need guards when request channels already have them
 *
 * A request channel answers. A handler that receives a hostile argument can reject it, and the
 * renderer's `.catch()` sees the failure. An **event** channel has no reply: the renderer cannot
 * reject what arrives and cannot await it, so whatever `main` sends is handed to store code and to
 * React unconditionally. There is no failure path at all - only "crash the renderer".
 *
 * That asymmetry is why `main`/`renderer` version skew is the real risk here rather than an
 * attacker. A request channel's consumer and producer are both updated by one deploy; an event
 * channel's payload shape is a *silent* contract. Change `QueueJob` in `main` and forget the
 * renderer, and the first `queue-added` event of the session takes the window down.
 *
 * ## Why the preload is the place this is enforced
 *
 * These guards live here, in shared code used by the preload, rather than in each consumer. Every
 * event payload passes through exactly one place - the preload's `ipcRenderer.on` listener - and
 * there are a dozen consumers behind it (`BatchQueue`, `useConversion`, `useMediaTask`, three
 * stores, `MediaPlayer`, `updateStore`, `TitleBar`, `App`). Guarding per consumer would mean
 * repeating the same check a dozen times and still missing the next subscriber.
 *
 * ## What "invalid" means, and why it is deliberately not "deeply validated"
 *
 * A guard checks the **discriminators the app actually dereferences or branches on**, not every
 * declared field. Two reasons:
 *
 * 1. A full structural validator must be updated whenever a type grows, and nothing enforces that.
 *    A guard that starts rejecting payloads the app is perfectly happy with is worse than no guard,
 *    because it silently drops legitimate events.
 * 2. The failure this exists to prevent is a `TypeError` from reading a property of `null`,
 *    `undefined`, or a wrong-typed value. That only needs the top level to be the right *kind* and
 *    the few fields that get dereferenced to be the right *type*.
 *
 * Optional fields and growth-tolerant fields are therefore not checked. `QueueJob.progress`,
 * `error` and `priority` are omitted deliberately: nothing dereferences them unguarded, and
 * rejecting a job for a missing optional field would turn a cosmetic mismatch into a lost event.
 */

import type { ConversionProgress, LogEntry, PlayerAudioChunk, PlayerFrame, QueueJob, UpdateInfo, UpdateProgress } from './types';
import type { AuditEntry } from './audit';

/** Narrow an unknown value to a plain (non-null, non-array) object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when `value` is a string. Used for path-like and id-like fields. */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** True when `value` is a finite number. Rejects `NaN` and both infinities. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** True when `value` is a boolean. */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/** True when `value` is an `ArrayBuffer` - how frame and audio bytes cross the boundary. */
export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

/**
 * True when `value` has the fields a `ConversionProgress` consumer dereferences.
 *
 * `percent` is the important one: the preload's own `onConversionProgress` log line calls
 * `.toFixed(1)` on it, so a missing or string-typed `percent` throws inside the boundary before any
 * consumer gets a chance to look at it. The other five fields are rendered as captions, so they are
 * checked for type rather than presence-of-meaning.
 */
export function isConversionProgress(value: unknown): value is ConversionProgress {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.percent) &&
    isString(value.time) &&
    isFiniteNumber(value.fps) &&
    isString(value.speed) &&
    isString(value.eta) &&
    isString(value.bitrate)
  );
}

/**
 * True when `value` has the fields a `QueueJob` consumer dereferences or branches on.
 *
 * `id` and `status` are load-bearing in both directions: `BatchQueue` keys its
 * running/finished maps by `id` and compares `status` against `QUEUE_STATUS`, and `onQueueMoved`
 * reorders by `id`. `input` and `output` are the logged paths. `options`, `transcoder`,
 * `createdAt` and the optional fields are not checked - see the file header.
 */
export function isQueueJob(value: unknown): value is QueueJob {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.input) && isString(value.output) && isString(value.status) && isFiniteNumber(value.progress);
}

/** True when `value` is a `PlayerFrame`: bytes plus the dimensions and generation the decoder pairs them by. */
export function isPlayerFrame(value: unknown): value is PlayerFrame {
  if (!isRecord(value)) return false;
  return (
    isArrayBuffer(value.data) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isFiniteNumber(value.pts) &&
    isFiniteNumber(value.generation)
  );
}

/** True when `value` is a `PlayerAudioChunk`. `sampleRate` and `channels` drive the WebAudio buffer, so both are required. */
export function isPlayerAudioChunk(value: unknown): value is PlayerAudioChunk {
  if (!isRecord(value)) return false;
  return (
    isArrayBuffer(value.data) && isFiniteNumber(value.sampleRate) && isFiniteNumber(value.channels) && isFiniteNumber(value.generation)
  );
}

/** True when `value` is a `LogEntry`. `level` is narrowed to the declared union because the Logs page filters on it. */
export function isLogEntry(value: unknown): value is LogEntry {
  if (!isRecord(value)) return false;
  return (
    isString(value.timestamp) &&
    (value.level === 'DEBUG' || value.level === 'INFO' || value.level === 'WARN' || value.level === 'ERROR') &&
    isString(value.text) &&
    (value.source === 'main' || value.source === 'renderer')
  );
}

/** True when `value` is an `AuditEntry`. `result` is narrowed to the declared union and the fields the Logs page renders are type-checked. */
export function isAuditEntry(value: unknown): value is AuditEntry {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.timestamp) &&
    isString(value.tool) &&
    isFiniteNumber(value.tier) &&
    isString(value.argsDigest) &&
    (value.result === 'ok' || value.result === 'error')
  );
}

/** True when `value` is an `UpdateInfo` with the nested `UpdateAsset` the dialog's download button needs. */
export function isUpdateInfo(value: unknown): value is UpdateInfo {
  if (!isRecord(value)) return false;
  if (!isString(value.version) || !isString(value.releaseNotes) || !isString(value.releaseUrl)) return false;
  return isRecord(value.asset) && isString(value.asset.fileName);
}

/** True when `value` is an `UpdateProgress` with a usable `percent`. */
export function isUpdateProgress(value: unknown): value is UpdateProgress {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.percent) && isFiniteNumber(value.transferred) && isFiniteNumber(value.total);
}

/**
 * Guards the `conversion-progress` payload: `{ input, output, progress }`.
 *
 * Checked as its own wrapper rather than reusing {@link isConversionProgress} because the outer
 * object is what the preload's log line dereferences first (`data.input`, then `data.progress`).
 */
export function isConversionProgressEvent(value: unknown): value is { input: string; output: string; progress: ConversionProgress } {
  if (!isRecord(value)) return false;
  return isString(value.input) && isString(value.output) && isConversionProgress(value.progress);
}

/** Guards the `queue-progress` payload: `{ job, progress }`. */
export function isQueueProgressEvent(value: unknown): value is { job: QueueJob; progress: ConversionProgress } {
  if (!isRecord(value)) return false;
  return isQueueJob(value.job) && isConversionProgress(value.progress);
}

/** Guards the `queue-moved` payload: `{ id, toPosition }`. */
export function isQueueMovedEvent(value: unknown): value is { id: string; toPosition: number } {
  if (!isRecord(value)) return false;
  return isString(value.id) && isFiniteNumber(value.toPosition);
}
