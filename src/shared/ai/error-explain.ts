/**
 * @fileoverview Deterministic error explainer (roadmap R2 / F4).
 *
 * Turns an `ErrorCode` (or a raw failure message) into plain language: what went
 * wrong, the common causes, and one-click fixes the UI can replay. Fixes that
 * patch conversion arguments are always computed with code — never a model call
 * (roadmap §7.3) — so "retry" and "switch" suggestions are reproducible.
 */

import { ErrorCode, ERROR_MESSAGES, formatError } from '../errors';
import type { ErrorCodeType } from '../types';

/**
 * How a suggested fix behaves when clicked.
 * - `retry`  — re-runs the same operation unchanged;
 * - `switch` — re-runs the operation with patched arguments;
 * - `info`   — guidance only, no tool call.
 * @typedef {('retry' | 'switch' | 'info')} ErrorFixKind
 */
export type ErrorFixKind = 'retry' | 'switch' | 'info';

/**
 * One suggested remedy for a failure.
 * @interface ErrorFix
 * @property {ErrorFixKind} kind - How the fix behaves.
 * @property {string} label - Short button/label text.
 * @property {string} description - One-sentence explanation.
 * @property {string} [tool] - Tool to call for `retry`/`switch` fixes.
 * @property {Record<string, unknown>} [args] - Arguments for the tool call.
 */
export interface ErrorFix {
  kind: ErrorFixKind;
  label: string;
  description: string;
  tool?: string;
  args?: Record<string, unknown>;
}

/**
 * The plain-language explanation of a failure.
 * @interface ErrorExplanation
 * @property {ErrorCodeType} code - The resolved application error code.
 * @property {string} title - Short human title.
 * @property {string} explanation - Canonical human message.
 * @property {string} [detail] - Technical detail preserved from the failure.
 * @property {string[]} causes - Common causes, most likely first.
 * @property {ErrorFix[]} fixes - Suggested remedies.
 * @property {{ tool: string; args: Record<string, unknown> }} [retry] - The
 *   default retry action when a plain retry is possible.
 */
export interface ErrorExplanation {
  code: ErrorCodeType;
  title: string;
  explanation: string;
  detail?: string;
  causes: string[];
  fixes: ErrorFix[];
  retry?: { tool: string; args: Record<string, unknown> };
}

/**
 * Input accepted by {@link explainError}. At least one of `code`, `message` or
 * `detail` should be provided; `tool`/`args` enable argument-patching fixes.
 * @interface ExplainErrorInput
 * @property {string} [code] - A known error code.
 * @property {string} [message] - Raw failure message (code inferred when needed).
 * @property {string} [detail] - Extra technical detail.
 * @property {string} [input] - The input file the operation ran on, when known.
 * @property {string} [tool] - The tool that failed (for `switch` fixes).
 * @property {Record<string, unknown>} [args] - The arguments that failed.
 */
export interface ExplainErrorInput {
  code?: string;
  message?: string;
  detail?: string;
  input?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

/**
 * True when `value` is a known {@link ErrorCode}.
 * @param {unknown} value - Candidate value.
 * @returns {value is ErrorCodeType} Whether the value names an error code.
 */
export function isErrorCode(value: unknown): value is ErrorCodeType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ErrorCode, value);
}

/**
 * Short titles and likely causes per error code.
 * @const {Record<ErrorCodeType, { title: string; causes: string[] }>}
 */
const ERROR_HELP: Record<ErrorCodeType, { title: string; causes: string[] }> = {
  FILE_NOT_FOUND: {
    title: 'File not found',
    causes: ['The path was mistyped or is relative to a different folder.', 'The file was moved, renamed, or deleted.'],
  },
  FFMPEG_NOT_FOUND: {
    title: 'FFmpeg is missing',
    causes: ['FFmpeg is not installed or not on the PATH.', 'The bundled binary was removed.'],
  },
  FFPROBE_NOT_FOUND: {
    title: 'FFprobe is missing',
    causes: ['FFprobe is not installed or not on the PATH.', 'A partial FFmpeg install is present.'],
  },
  CONVERSION_FAILED: {
    title: 'Conversion failed',
    causes: ['An option is incompatible with the source streams.', 'The output format cannot carry the selected codec.', 'Hardware encoding is unavailable or unstable.'],
  },
  INVALID_FORMAT: {
    title: 'Unsupported format',
    causes: ['The output extension does not match the selected codec.', 'The input container is not supported.'],
  },
  PROBE_FAILED: {
    title: 'Could not read the file',
    causes: ['The file is corrupt or truncated.', 'The format is unsupported by FFprobe.'],
  },
  QUEUE_ERROR: {
    title: 'Queue job failed',
    causes: ['One job in the batch rejected its options.', 'A shared option is incompatible with some inputs.'],
  },
  PLAYER_ERROR: {
    title: 'Playback error',
    causes: ['The file is corrupted or uses an unsupported codec.', 'The decoder is unavailable.'],
  },
  CANCELLED: {
    title: 'Cancelled',
    causes: ['The operation was cancelled by the user or by closing the app.'],
  },
  BMF_NOT_AVAILABLE: {
    title: 'BMF is not installed',
    causes: ['The BMF CLI tools are not installed.', 'The BMF backend was selected without a BMF install.'],
  },
  OUTPUT_NOT_SPECIFIED: {
    title: 'No output path',
    causes: ['The output file was not provided and could not be derived.'],
  },
  INPUT_NOT_SPECIFIED: {
    title: 'No input path',
    causes: ['The input file was not provided.'],
  },
  OUTPUT_EXISTS: {
    title: 'Output already exists',
    causes: ['A file is already present at the output path and overwrite is disabled.'],
  },
  INVALID_QUEUE_FILE: {
    title: 'Invalid queue file',
    causes: ['The exported queue file is corrupt or from an incompatible version.'],
  },
  FILTERS_REQUIRE_RE_ENCODE: {
    title: 'Filters need re-encoding',
    causes: ['Video filters were combined with lossless stream copy (copy: true).'],
  },
  INVALID_VIDEO_FILTERS: {
    title: 'Invalid video filters',
    causes: ['A filter expression is malformed.', 'A preset id is unknown.'],
  },
  STREAM_NOT_FOUND: {
    title: 'Stream not found',
    causes: ['A stream selection matched no stream in the source.'],
  },
  INCOMPATIBLE_CONTAINER: {
    title: 'Incompatible container',
    causes: ['A stream codec cannot be stored in the chosen container in copy mode.'],
  },
  AUXILIARY_INPUT_NOT_FOUND: {
    title: 'Added file not found',
    causes: ['A subtitle, audio, chapter, or cover file was moved or deleted.'],
  },
  PERMISSION_DENIED: {
    title: 'Permission denied',
    causes: ['The app cannot read the input or write the output.', 'The destination is read-only or protected.'],
  },
  OPERATION_TIMED_OUT: {
    title: 'Operation timed out',
    causes: ['The file is very large or corrupt.', 'The system is under heavy load.'],
  },
  UNSAFE_ARGUMENTS: {
    title: 'Unsafe arguments',
    causes: ['The request contained shell metacharacters or a second command.'],
  },
  UNKNOWN: {
    title: 'Unexpected error',
    causes: ['An unrecognized failure occurred.'],
  },
};

/**
 * Resolves the error code and the raw detail from the input, inferring the code
 * from the message/detail when it is not given explicitly.
 * @param {ExplainErrorInput} input - Explanation input.
 * @returns {{ code: ErrorCodeType; detail?: string }} Resolved code + detail.
 */
function resolveCode(input: ExplainErrorInput): { code: ErrorCodeType; detail?: string } {
  if (isErrorCode(input.code)) return { code: input.code, detail: input.detail };
  const raw = input.message ?? input.detail;
  if (raw) {
    const normalized = formatError({ message: raw, code: input.code, detail: input.detail });
    return { code: normalized.code, detail: normalized.detail ?? raw };
  }
  if (isErrorCode(input.detail)) return { code: input.detail };
  return { code: ErrorCode.UNKNOWN };
}

/**
 * Copies the args without the video-filter fields, so a filter failure can be
 * retried cleanly.
 * @param {Record<string, unknown>} args - Original arguments.
 * @returns {Record<string, unknown>} Arguments with filters removed.
 */
function withoutFilters(args: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...args };
  delete next.videoFilters;
  delete next.filters;
  delete next.presets;
  return next;
}

/**
 * Builds the argument-patching and retry fixes for a code, given the tool and
 * arguments that failed.
 * @param {ErrorCodeType} code - The resolved error code.
 * @param {string | undefined} tool - The failing tool, when known.
 * @param {Record<string, unknown> | undefined} args - The failing arguments.
 * @returns {{ fixes: ErrorFix[]; retry?: { tool: string; args: Record<string, unknown> } }} Fixes.
 */
function buildFixes(
  code: ErrorCodeType,
  tool?: string,
  args?: Record<string, unknown>,
): { fixes: ErrorFix[]; retry?: { tool: string; args: Record<string, unknown> } } {
  const fixes: ErrorFix[] = [];
  let retry: { tool: string; args: Record<string, unknown> } | undefined;
  const hasCall = Boolean(tool && args !== undefined);
  const sameArgs = (): Record<string, unknown> => ({ ...(args ?? {}) });

  if (code === ErrorCode.FILTERS_REQUIRE_RE_ENCODE && hasCall) {
    fixes.push({
      kind: 'switch',
      label: 'Re-encode instead of copy',
      description: 'Runs the same conversion with lossless copy disabled so the filters can apply.',
      tool,
      args: { ...sameArgs(), copy: false },
    });
  } else if (code === ErrorCode.INVALID_VIDEO_FILTERS && hasCall) {
    fixes.push({
      kind: 'switch',
      label: 'Drop the video filters',
      description: 'Runs the conversion again without the filter chain that was rejected.',
      tool,
      args: withoutFilters(sameArgs()),
    });
  } else if (code === ErrorCode.INCOMPATIBLE_CONTAINER && hasCall) {
    fixes.push({
      kind: 'switch',
      label: 'Re-encode into the container',
      description: 'Runs the conversion again with re-encoding so the stream fits the container.',
      tool,
      args: { ...sameArgs(), copy: false },
    });
  } else if (code === ErrorCode.CONVERSION_FAILED && hasCall) {
    if (args && args.hardwareAcceleration === true) {
      fixes.push({
        kind: 'switch',
        label: 'Retry on the software encoder',
        description: 'Runs the conversion again with hardware acceleration disabled.',
        tool,
        args: { ...sameArgs(), hardwareAcceleration: false },
      });
    }
  }

  if (hasCall && (code === ErrorCode.CONVERSION_FAILED || code === ErrorCode.OPERATION_TIMED_OUT || code === ErrorCode.CANCELLED || code === ErrorCode.PROBE_FAILED)) {
    retry = { tool: tool as string, args: sameArgs() };
    fixes.push({
      kind: 'retry',
      label: 'Retry the operation',
      description: 'Runs the exact same operation again.',
      tool,
      args: sameArgs(),
    });
  }

  return retry ? { fixes, retry } : { fixes };
}

/**
 * Explains a failure in plain language with suggested fixes.
 * @param {ExplainErrorInput} input - The failure to explain.
 * @returns {ErrorExplanation} The explanation, causes, and fixes.
 */
export function explainError(input: ExplainErrorInput): ErrorExplanation {
  const { code, detail } = resolveCode(input);
  const help = ERROR_HELP[code];
  const { fixes, retry } = buildFixes(code, input.tool, input.args);
  const explanation: ErrorExplanation = {
    code,
    title: help.title,
    explanation: ERROR_MESSAGES[code],
    causes: help.causes,
    fixes,
  };
  if (detail) explanation.detail = detail;
  if (retry) explanation.retry = retry;
  return explanation;
}
