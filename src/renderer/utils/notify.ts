/**
 * @fileoverview Single authoring API for in-app toast notifications.
 *
 * Every toast in the renderer is created through this facade: callers pass an
 * i18n key and a semantic variant, never a resolved English string or a raw
 * error message. The facade derives the variant from ErrorCode for failures
 * and forwards the translation key, interpolation values, duration, and action
 * to the toast store. The viewport resolves copy at render time so a language
 * change is reflected in toasts that are still on screen.
 *
 * Toast delivery (queue capping, one-at-a-time display) remains the store's
 * responsibility; this module owns keys, variants, durations, and actions.
 */

import { ErrorCode, formatError, isAppError } from '../../shared/errors';
import { TOAST_DEFAULT_DURATION_MS, TOAST_LONG_DURATION_MS, TOAST_UPDATE_READY_DURATION_MS } from '../../shared/constants';
import type { AppError, ErrorCodeType } from '../../shared/types';
import { useToastStore } from '../stores/toastStore';
import type { ToastType } from '../stores/types';
import type { NotifyOptions } from './notify.types';

/** Display durations for toast notifications, in milliseconds. */
export const TOAST_DURATION = {
  default: TOAST_DEFAULT_DURATION_MS,
  long: TOAST_LONG_DURATION_MS,
  updateReady: TOAST_UPDATE_READY_DURATION_MS,
} as const;

export type { NotifyOptions, ToastValues } from './notify.types';

/**
 * Maps an application error code to a toast variant.
 * @param {ErrorCodeType} code - Error code carried by an AppError.
 * @returns {ToastType} The severity used by the unified toast viewport.
 */
export function errorToastVariant(code: ErrorCodeType): ToastType {
  switch (code) {
    case ErrorCode.FFPROBE_NOT_FOUND:
    case ErrorCode.INVALID_FORMAT:
    case ErrorCode.PROBE_FAILED:
    case ErrorCode.BMF_NOT_AVAILABLE:
      return 'warning';
    case ErrorCode.CANCELLED:
    case ErrorCode.OUTPUT_NOT_SPECIFIED:
    case ErrorCode.INPUT_NOT_SPECIFIED:
      return 'info';
    default:
      return 'error';
  }
}

/**
 * Returns the canonical catalog key for an application error code.
 * @param {ErrorCodeType} code - Error code carried by an AppError.
 * @returns {string} The `toast.error.<CODE>` translation key.
 */
export function errorToastKey(code: ErrorCodeType): string {
  return `toast.error.${code}`;
}

/**
 * Pushes a fully resolved toast into the backing store.
 * @param {ToastType} type - Semantic variant.
 * @param {string} key - Translation key for the headline.
 * @param {NotifyOptions} [options] - Detail, duration, and action options.
 * @returns {void}
 */
function emit(type: ToastType, key: string, options: NotifyOptions = {}): void {
  const detail = options.detailKey ?? options.detail;
  const action = options.action
    ? { label: options.action.labelKey, labelKey: options.action.labelKey, onClick: options.action.onClick }
    : undefined;
  useToastStore.getState().addToast(type, key, detail, options.duration, action, options.values, options.detailValues);
}

/**
 * Pushes a success toast.
 * @param {string} key - Translation key for the headline.
 * @param {NotifyOptions} [options] - Detail, duration, and action options.
 * @returns {void}
 */
function success(key: string, options?: NotifyOptions): void {
  emit('success', key, options);
}

/**
 * Pushes an error toast.
 * @param {string} key - Translation key for the headline.
 * @param {NotifyOptions} [options] - Detail, duration, and action options.
 * @returns {void}
 */
function error(key: string, options?: NotifyOptions): void {
  emit('error', key, options);
}

/**
 * Pushes a warning toast.
 * @param {string} key - Translation key for the headline.
 * @param {NotifyOptions} [options] - Detail, duration, and action options.
 * @returns {void}
 */
function warning(key: string, options?: NotifyOptions): void {
  emit('warning', key, options);
}

/**
 * Pushes an informational toast.
 * @param {string} key - Translation key for the headline.
 * @param {NotifyOptions} [options] - Detail, duration, and action options.
 * @returns {void}
 */
function info(key: string, options?: NotifyOptions): void {
  emit('info', key, options);
}

/**
 * Pushes a toast for an application failure, mapping the error code to its
 * canonical catalog message and variant while preserving technical detail.
 * @param {unknown} err - AppError or any thrown value to normalize.
 * @param {Omit<NotifyOptions, 'values'>} [options] - Optional action/duration override.
 * @returns {void}
 */
function fromError(err: unknown, options: Omit<NotifyOptions, 'values'> = {}): void {
  const appError: AppError = isAppError(err) ? err : formatError(err);
  const code = appError.code ?? ErrorCode.UNKNOWN;
  emit(errorToastVariant(code), errorToastKey(code), {
    ...options,
    detail: appError.detail,
  });
}

/** Unified toast authoring API. */
export const notify = { success, error, warning, info, fromError };
