/**
 * @fileoverview Custom error types and error handling for the application.
 * Defines error codes, error interfaces, and utility functions for error management.
 */

import type { ErrorCodeType, AppError } from './types';

/**
 * Application error codes for different failure scenarios.
 * @const {Object} ErrorCode
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
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNKNOWN: 'UNKNOWN',
} as const;

export class AppErrorImpl extends Error {
  code: ErrorCodeType;
  detail?: string;
  timestamp: number;

  constructor(code: ErrorCodeType, message: string, detail?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
    this.timestamp = Date.now();
  }
}

export function createError(code: ErrorCodeType, message: string, detail?: string): AppError {
  return new AppErrorImpl(code, message, detail);
}

export function cancelledError(detail?: string): AppError {
  return createError(ErrorCode.CANCELLED, ERROR_MESSAGES[ErrorCode.CANCELLED], detail);
}

export function isAppError(err: unknown): err is AppError {
  if (!err || typeof err !== 'object') return false;
  const obj = err as Record<string, unknown>;
  return typeof obj.code === 'string' && typeof obj.message === 'string' && typeof obj.timestamp === 'number';
}

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
  PERMISSION_DENIED: 'Permission denied. The application may not have access to the selected file or directory.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function formatError(err: unknown): AppError {
  if (isAppError(err)) return err;
  if (err && typeof err === 'object') {
    const msg = 'message' in err ? (err as Record<string, unknown>).message : undefined;
    const message = typeof msg === 'string' ? msg : 'Unknown error';
    const code = inferErrorCode(message, err);
    return createError(code, ERROR_MESSAGES[code], message);
  }
  const strMessage = String(err);
  const code = inferErrorCode(strMessage);
  return createError(code, ERROR_MESSAGES[code], strMessage);
}

function inferErrorCode(message: string, err?: unknown): ErrorCodeType {
  const m = message.toLowerCase();
  const errCode = err && typeof err === 'object' && 'code' in err ? (err as Record<string, unknown>).code : undefined;
  if (errCode === 'ENOENT' || m.includes('enoent') || m.includes('not found') || m.includes('no such file')) {
    if (m.includes('ffmpeg')) return ErrorCode.FFMPEG_NOT_FOUND;
    if (m.includes('ffprobe')) return ErrorCode.FFPROBE_NOT_FOUND;
    return ErrorCode.FILE_NOT_FOUND;
  }
  if (errCode === 'EACCES' || m.includes('permission denied') || m.includes('eacces')) return ErrorCode.PERMISSION_DENIED;
  if (m.includes('bmf') && (m.includes('not available') || m.includes('not installed'))) return ErrorCode.BMF_NOT_AVAILABLE;
  if (m.includes('cancelled') || m.includes('cancel') || m.includes('killed') || m.includes('sigkill')) return ErrorCode.CANCELLED;
  if (m.includes('probe') || m.includes('could not read')) return ErrorCode.PROBE_FAILED;
  if (m.includes('format') || m.includes('unsupported')) return ErrorCode.INVALID_FORMAT;
  if (m.includes('queue')) return ErrorCode.QUEUE_ERROR;
  if (m.includes('player') || m.includes('decoder')) return ErrorCode.PLAYER_ERROR;
  if (m.includes('conversion') || m.includes('exit code') || m.includes('failed')) return ErrorCode.CONVERSION_FAILED;
  return ErrorCode.UNKNOWN;
}
