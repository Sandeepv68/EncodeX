/**
 * @fileoverview Runtime guards for the dedicated remux/demux queue.
 *
 * These guards protect both directions of the mux queue IPC boundary:
 * `MUX_QUEUE_ADD` payloads arriving from the renderer and mux queue events
 * pushed back to the renderer. They validate the fields the queue and UI
 * actually dereference, plus the shape of `ConversionOptions`, without
 * rejecting forward-compatible optional data.
 */

import { MAX_MUX_QUEUE_TARGETS, MUX_QUEUE_STATE_VERSION } from './constants';
import { QUEUE_STATUS } from './media-options';
import { TRANSCODER_TYPES } from './transcoder-constants';
import type { ConversionOptions, ConversionProgress, MuxQueueAddPayload, MuxQueueJob, MuxQueueSnapshot, MuxQueueTarget } from './types';
import { isBoolean, isConversionProgress, isFiniteNumber, isRecord, isString } from './ipc-guards';

/** True when `value` is a supported mux operation kind. */
export function isMuxQueueKind(value: unknown): value is MuxQueueAddPayload['kind'] {
  return value === 'remux' || value === 'demux';
}

/** True when `value` is a valid transcoder backend name. */
function isTranscoderType(value: unknown): boolean {
  return typeof value === 'string' && (TRANSCODER_TYPES as readonly string[]).includes(value);
}

/** True when `value` is a valid queue status. */
function isQueueStatus(value: unknown): boolean {
  return typeof value === 'string' && Object.values(QUEUE_STATUS).includes(value as (typeof QUEUE_STATUS)[keyof typeof QUEUE_STATUS]);
}

/** True when every entry of `value` is a string. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/** True when `value` is a valid `RemuxInput` entry. */
function isRemuxInput(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!isString(value.path) || !isStringArray(value.map)) return false;
  if (value.codec !== undefined && !isString(value.codec)) return false;
  if (value.disposition !== undefined && !isString(value.disposition)) return false;
  if (value.attachment !== undefined && !isBoolean(value.attachment)) return false;
  if (value.syncOffsetSeconds !== undefined && !isFiniteNumber(value.syncOffsetSeconds)) return false;
  return true;
}

/**
 * Validates the fields of `ConversionOptions` that can reach an FFmpeg
 * argument list. Unknown extra keys are ignored so additive changes remain
 * compatible across main/renderer version skew.
 */
export function isConversionOptionsLike(value: unknown): value is ConversionOptions {
  if (!isRecord(value)) return false;
  const stringFields = [
    'videoCodec',
    'audioCodec',
    'videoBitrate',
    'audioBitrate',
    'scale',
    'pixelFormat',
    'startTime',
    'endTime',
    'duration',
    'subtitleCodec',
    'chaptersFile',
    'hwaccelMode',
  ];
  for (const field of stringFields) {
    if (value[field] !== undefined && !isString(value[field])) return false;
  }
  if (value.rotate !== undefined && value.rotate !== '90' && value.rotate !== '180' && value.rotate !== '270') return false;
  for (const field of ['qscale', 'audioSyncSeconds']) {
    if (value[field] !== undefined && !isFiniteNumber(value[field])) return false;
  }
  for (const field of ['keepAspectRatio', 'flipH', 'flipV', 'copy', 'audio', 'video', 'hardwareAcceleration', 'copyChapters']) {
    if (value[field] !== undefined && !isBoolean(value[field])) return false;
  }
  for (const field of ['videoFilters', 'audioFilters', 'extraArgs', 'inputArgs', 'map']) {
    if (value[field] !== undefined && !isStringArray(value[field])) return false;
  }
  if (value.additionalInputs !== undefined) {
    if (!Array.isArray(value.additionalInputs) || !value.additionalInputs.every(isRemuxInput)) return false;
  }
  return true;
}

/** True when `value` is a valid mux queue target. */
export function isMuxQueueTarget(value: unknown): value is MuxQueueTarget {
  if (!isRecord(value)) return false;
  if (!isString(value.output) || value.output.length === 0) return false;
  if (!isConversionOptionsLike(value.options)) return false;
  if (value.label !== undefined && !isString(value.label)) return false;
  if (value.sourceIndex !== undefined && !isFiniteNumber(value.sourceIndex)) return false;
  return true;
}

/** True when the target list is non-empty, bounded, and has unique outputs. */
export function hasValidMuxTargets(value: unknown): value is MuxQueueTarget[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MUX_QUEUE_TARGETS) return false;
  if (!value.every(isMuxQueueTarget)) return false;
  const outputs = value.map((target) => target.output.toLowerCase());
  return new Set(outputs).size === outputs.length;
}

/** True when `value` is a valid `MuxQueueAddPayload`. */
export function isMuxQueueAddPayload(value: unknown): value is MuxQueueAddPayload {
  if (!isRecord(value)) return false;
  if (!isMuxQueueKind(value.kind)) return false;
  if (!isString(value.input) || value.input.length === 0) return false;
  if (!isString(value.output) || value.output.length === 0) return false;
  if (!hasValidMuxTargets(value.targets)) return false;
  if (value.transcoder !== undefined && !isTranscoderType(value.transcoder)) return false;
  if (value.overwrite !== undefined && !isBoolean(value.overwrite)) return false;
  return true;
}

/** True when `value` is a valid `MuxQueueJob`. */
export function isMuxQueueJob(value: unknown): value is MuxQueueJob {
  if (!isRecord(value)) return false;
  if (!isString(value.id) || value.id.length === 0) return false;
  if (!isMuxQueueKind(value.kind)) return false;
  if (!isString(value.input) || value.input.length === 0) return false;
  if (!isString(value.output) || value.output.length === 0) return false;
  if (!hasValidMuxTargets(value.targets)) return false;
  if (!isTranscoderType(value.transcoder)) return false;
  if (!isQueueStatus(value.status)) return false;
  if (!isFiniteNumber(value.progress)) return false;
  if (value.error !== undefined && !isString(value.error)) return false;
  if (value.priority !== undefined && !isFiniteNumber(value.priority)) return false;
  if (value.paused !== undefined && !isBoolean(value.paused)) return false;
  if (!isFiniteNumber(value.createdAt)) return false;
  return true;
}

/** True when `value` is a valid mux queue snapshot. */
export function isMuxQueueSnapshot(value: unknown): value is MuxQueueSnapshot {
  if (!isRecord(value)) return false;
  if (value.version !== MUX_QUEUE_STATE_VERSION) return false;
  if (!isFiniteNumber(value.concurrency)) return false;
  if (!Array.isArray(value.jobs) || !value.jobs.every(isMuxQueueJob)) return false;
  return true;
}

/** Guards the mux queue progress push payload: `{ job, progress }`. */
export function isMuxQueueProgressEvent(value: unknown): value is { job: MuxQueueJob; progress: ConversionProgress } {
  if (!isRecord(value)) return false;
  return isMuxQueueJob(value.job) && isConversionProgress(value.progress);
}

/** Guards the mux queue moved push payload: `{ id, toPosition }`. */
export function isMuxQueueMovedEvent(value: unknown): value is { id: string; toPosition: number } {
  if (!isRecord(value)) return false;
  return isString(value.id) && isFiniteNumber(value.toPosition);
}
