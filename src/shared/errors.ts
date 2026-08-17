/**
 * @fileoverview Custom error types and error handling for the application.
 * Defines error codes, error interfaces, and utility functions for error management.
 */

import type { ErrorCodeType, AppError } from './types';
import { analytics } from './analytics/analytics';

/**
 * Application error codes for different failure scenarios.
 * @const {Object} ErrorCode
 * @property {string} FILE_NOT_FOUND - The selected input file is missing.
 * @property {string} FFMPEG_NOT_FOUND - The FFmpeg binary could not be located.
 * @property {string} FFPROBE_NOT_FOUND - The FFprobe binary could not be located.
 * @property {string} CONVERSION_FAILED - The conversion process failed.
 * @property {string} INVALID_FORMAT - The file format is unsupported or mismatched.
 * @property {string} PROBE_FAILED - Media probing failed.
 * @property {string} QUEUE_ERROR - A batch queue job failed.
 * @property {string} PLAYER_ERROR - The video player encountered an error.
 * @property {string} CANCELLED - The operation was cancelled by the user.
 * @property {string} BMF_NOT_AVAILABLE - The BMF framework is not available.
 * @property {string} OUTPUT_NOT_SPECIFIED - No output file was provided.
 * @property {string} INPUT_NOT_SPECIFIED - No input file was provided.
 * @property {string} OUTPUT_EXISTS - The output file already exists and overwrite is disabled.
 * @property {string} INVALID_QUEUE_FILE - An imported queue file is missing, corrupt, or unsupported.
 * @property {string} PERMISSION_DENIED - Access to the file or directory was denied.
 * @property {string} UNKNOWN - An unrecognized error occurred.
 */
export const ErrorCode = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FFMPEG_NOT_FOUND: 'FFMPEG_NOT_FOUND',
  FFPROBE_NOT_FOUND: 'FFPROBE_NOT_FOUND',
  CONVERSION_FAILED: 'CONVERSION_FAILED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  PROBE_FAILED: 'PROBE_FAILED',
  QUEUE_ERROR: 'QUEUE_ERROR',
  PLAYER_ERROR: 'PLAYER_ERROR',
  CANCELLED: 'CANCELLED',
  BMF_NOT_AVAILABLE: 'BMF_NOT_AVAILABLE',
  OUTPUT_NOT_SPECIFIED: 'OUTPUT_NOT_SPECIFIED',
  INPUT_NOT_SPECIFIED: 'INPUT_NOT_SPECIFIED',
  OUTPUT_EXISTS: 'OUTPUT_EXISTS',
  INVALID_QUEUE_FILE: 'INVALID_QUEUE_FILE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * Concrete implementation of the AppError interface.
 * Extends the native Error class, adding a categorized error code, an optional
 * technical detail, and a creation timestamp. The error `name` is set to
 * 'AppError' so instances can be identified during error handling and logging.
 * @class AppErrorImpl
 * @extends {Error}
 * @property {ErrorCodeType} code - The categorized application error code.
 * @property {string} [detail] - Optional additional technical detail about the failure.
 * @property {number} timestamp - Epoch milliseconds at which the error was created.
 */
export class AppErrorImpl extends Error {
  code: ErrorCodeType;
  detail?: string;
  timestamp: number;

  /**
   * Creates a new AppErrorImpl instance.
   * @param {ErrorCodeType} code - The categorized application error code.
   * @param {string} message - A human-readable error message.
   * @param {string} [detail] - Optional extra detail about the failure.
   */
  constructor(code: ErrorCodeType, message: string, detail?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
    this.timestamp = Date.now();
  }
}

/**
 * Factory that builds an AppError-compatible error object.
 * The result is an AppErrorImpl instance carrying the given code, message, and
 * optional detail, with a timestamp set to the current time.
 * @param {ErrorCodeType} code - The categorized application error code.
 * @param {string} message - A human-readable error message.
 * @param {string} [detail] - Optional extra detail about the failure.
 * @returns {AppError} A new AppError instance.
 */
export function createError(code: ErrorCodeType, message: string, detail?: string): AppError {
  return new AppErrorImpl(code, message, detail);
}

/**
 * Creates an AppError representing a user-cancelled operation.
 * Uses the canonical 'CANCELLED' message from ERROR_MESSAGES.
 * @param {string} [detail] - Optional extra detail about what was cancelled.
 * @returns {AppError} A CANCELLED AppError instance.
 */
export function cancelledError(detail?: string): AppError {
  return createError(ErrorCode.CANCELLED, ERROR_MESSAGES[ErrorCode.CANCELLED], detail);
}

/**
 * Creates an AppError representing an output file that already exists while
 * overwrite is disabled. Uses the canonical 'OUTPUT_EXISTS' message from
 * ERROR_MESSAGES.
 * @param {string} [detail] - Optional detail identifying the existing output.
 * @returns {AppError} An OUTPUT_EXISTS AppError instance.
 */
export function outputExistsError(detail?: string): AppError {
  return createError(ErrorCode.OUTPUT_EXISTS, ERROR_MESSAGES[ErrorCode.OUTPUT_EXISTS], detail);
}

/**
 * Creates an AppError representing an unreadable or invalid queue export file.
 * Uses the canonical 'INVALID_QUEUE_FILE' message from ERROR_MESSAGES.
 * @param {string} [detail] - Optional detail about why the file was rejected.
 * @returns {AppError} An INVALID_QUEUE_FILE AppError instance.
 */
export function invalidQueueFileError(detail?: string): AppError {
  return createError(ErrorCode.INVALID_QUEUE_FILE, ERROR_MESSAGES[ErrorCode.INVALID_QUEUE_FILE], detail);
}

/**
 * Type guard that checks whether an unknown value is an AppError.
 * A value is considered an AppError when it is a non-null object with string
 * `code`, string `message`, and numeric `timestamp` properties.
 * @param {unknown} err - The value to test.
 * @returns {boolean} True if `err` structurally matches the AppError shape.
 */
export function isAppError(err: unknown): err is AppError {
  if (!err || typeof err !== 'object') return false;
  const obj = err as Record<string, unknown>;
  return typeof obj.code === 'string' && typeof obj.message === 'string' && typeof obj.timestamp === 'number';
}

/**
 * Default human-readable messages for every application error code.
 * Used to build user-facing errors via formatError and createError when a raw
 * failure carries no usable message of its own.
 * @const {Record<ErrorCodeType, string>} ERROR_MESSAGES
 */
export const ERROR_MESSAGES: Record<ErrorCodeType, string> = {
  FILE_NOT_FOUND: 'The selected file could not be found. It may have been moved or deleted.',
  FFMPEG_NOT_FOUND: 'FFmpeg binary not found. Please install FFmpeg or check the bundled executable.',
  FFPROBE_NOT_FOUND: 'FFprobe binary not found. Media information cannot be read.',
  CONVERSION_FAILED: 'The conversion process failed. Check the file format and parameters.',
  INVALID_FORMAT: 'The file format is not supported or the output extension does not match the selected codec.',
  PROBE_FAILED: 'Could not read media file information. The file may be corrupted or in an unsupported format.',
  QUEUE_ERROR: 'A batch queue job failed. Check individual job details for more information.',
  PLAYER_ERROR: 'The video player encountered an error. The file may be corrupted or in an unsupported format.',
  CANCELLED: 'The operation was cancelled by the user.',
  BMF_NOT_AVAILABLE: 'BMF framework is not installed. Please install BMF CLI tools or use a different transcoder.',
  OUTPUT_NOT_SPECIFIED: 'Please specify an output file before starting the conversion.',
  INPUT_NOT_SPECIFIED: 'Please select an input file before starting the conversion.',
  OUTPUT_EXISTS: 'The output file already exists. Enable overwrite to replace it.',
  INVALID_QUEUE_FILE: 'The queue file could not be read. It may be corrupted or in an unsupported format.',
  PERMISSION_DENIED: 'Permission denied. The application may not have access to the selected file or directory.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

/**
 * Normalizes any unknown thrown value into an AppError.
 * Already-valid AppError values are returned unchanged. Other objects have their
 * `message` property extracted (falling back to 'Unknown error'), the error code
 * is inferred from the message and the object's `code` property, and the message
 * is replaced with the canonical ERROR_MESSAGES text while the original message
 * is preserved as `detail`. Non-object values (e.g. thrown strings) are
 * stringified before code inference.
 * @param {unknown} err - The thrown value to normalize.
 * @returns {AppError} A normalized AppError instance.
 */
export function formatError(err: unknown): AppError {
  if (isAppError(err)) {
    return err;
  }
  if (err && typeof err === 'object') {
    const msg = 'message' in err ? (err as Record<string, unknown>).message : undefined;
    const message = typeof msg === 'string' ? msg : 'Unknown error';
    const code = inferErrorCode(message, err);
    if (code !== ErrorCode.CANCELLED) {
      analytics.errorOccurred(code, message.substring(0, 100));
    }
    return createError(code, ERROR_MESSAGES[code], message);
  }
  const strMessage = String(err);
  const code = inferErrorCode(strMessage);
  if (code !== ErrorCode.CANCELLED) {
    analytics.errorOccurred(code, strMessage.substring(0, 100));
  }
  return createError(code, ERROR_MESSAGES[code], strMessage);
}

/**
 * Heuristically maps an error message (and an optional error object carrying a
 * `code` property) to the most specific matching ErrorCode. Node-style codes
 * such as 'ENOENT' and 'EACCES' are recognized, as are textual hints for
 * ffmpeg/ffprobe, BMF, cancellation, probing, format, queue, player, and
 * conversion failures. Unknown messages fall back to UNKNOWN.
 * @param {string} message - The raw error message (lowercased internally for matching).
 * @param {unknown} [err] - Optional original error; its `code` property is inspected.
 * @returns {ErrorCodeType} The inferred application error code.
 */
function inferErrorCode(message: string, err?: unknown): ErrorCodeType {
  const m = message.toLowerCase();
  const errCode = err && typeof err === 'object' && 'code' in err ? (err as Record<string, unknown>).code : undefined;
  if (errCode === 'ENOENT' || m.includes('enoent') || m.includes('not found') || m.includes('no such file')) {
    if (m.includes('ffmpeg')) return ErrorCode.FFMPEG_NOT_FOUND;
    if (m.includes('ffprobe')) return ErrorCode.FFPROBE_NOT_FOUND;
    return ErrorCode.FILE_NOT_FOUND;
  }
  if (errCode === 'EACCES' || m.includes('permission denied') || m.includes('eacces')) return ErrorCode.PERMISSION_DENIED;
  if (m.includes('already exists') || m.includes('output exists')) return ErrorCode.OUTPUT_EXISTS;
  if (m.includes('bmf') && (m.includes('not available') || m.includes('not installed'))) return ErrorCode.BMF_NOT_AVAILABLE;
  if (m.includes('cancelled') || m.includes('cancel') || m.includes('killed') || m.includes('sigkill')) return ErrorCode.CANCELLED;
  if (m.includes('probe') || m.includes('could not read')) return ErrorCode.PROBE_FAILED;
  if (m.includes('queue file') || m.includes('unsupported format')) return ErrorCode.INVALID_QUEUE_FILE;
  if (m.includes('format') || m.includes('unsupported')) return ErrorCode.INVALID_FORMAT;
  if (m.includes('queue')) return ErrorCode.QUEUE_ERROR;
  if (m.includes('player') || m.includes('decoder')) return ErrorCode.PLAYER_ERROR;
  if (m.includes('conversion') || m.includes('exit code') || m.includes('failed')) return ErrorCode.CONVERSION_FAILED;
  return ErrorCode.UNKNOWN;
}
