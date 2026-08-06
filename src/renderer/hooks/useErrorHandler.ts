/**
 * @fileoverview Hook for centralized error handling and display.
 * Exposes helpers that log errors and surface them through the global error
 * store (useErrorStore), plus a generic wrapper for turning rejected async
 * functions into user-facing errors. Manages error toasts and notifications
 * across the application.
 */

import { useCallback } from 'react';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import type { ErrorCodeType } from '../../shared/types';
import { LOG_HANDLE_ERROR, LOG_HANDLE_ERROR_MESSAGE, LOG_WRAP_ASYNC_CALLED, LOG_WRAP_ASYNC_CAUGHT } from '../../shared/log-constants';

/**
 * Logger instance scoped to the useErrorHandler module.
 * @type {Logger}
 */
const log = new Logger('renderer/hooks/useErrorHandler');

/**
 * React hook exposing shared error-handling helpers for the app.
 *
 * All helpers route through {@link useErrorStore} so any error shown here is
 * also recorded in the error history and surfaced by the global ErrorBanner /
 * ErrorSnackbar components.
 *
 * @returns {Object} An object with the current error state and helpers:
 * @property {ErrorDetails | null} currentError - The active error, or null.
 * @property {(err: unknown) => void} handleError - Logs and displays a raw error.
 * @property {(code: ErrorCodeType, detail?: string) => void} handleErrorMessage -
 *   Logs and displays a typed AppError message.
 * @property {() => void} clearError - Clears the current error.
 * @property {(fn: () => Promise<T>, errorMessage?: string) => Promise<T | undefined>} wrapAsync -
 *   Runs a promise, catches failures, and surfaces them as errors.
 */
export function useErrorHandler() {
  const { currentError, showError, showErrorMessage, clearError } = useErrorStore();

  /**
   * Logs an error at ERROR level and forwards it to the error store for display.
   * @param {unknown} err - The error to report (Error instance or raw value).
   * @returns {void}
   */
  const handleError = useCallback(
    (err: unknown) => {
      log.error(LOG_HANDLE_ERROR, err);
      showError(err);
    },
    [showError],
  );

  /**
   * Logs and displays an error identified by a typed error code.
   * @param {ErrorCodeType} code - The typed error code (see shared/errors.ts).
   * @param {string} [detail] - Optional human-readable detail message.
   * @returns {void}
   */
  const handleErrorMessage = useCallback(
    (code: ErrorCodeType, detail?: string) => {
      log.error(LOG_HANDLE_ERROR_MESSAGE, code, detail || '');
      showErrorMessage(code, detail);
    },
    [showErrorMessage],
  );

  /**
   * Wraps a promise-returning function so rejections become user-facing errors.
   *
   * When `errorMessage` is supplied, a generic UNKNOWN error with that message
   * is shown; otherwise the raw rejection is passed to {@link handleError}.
   * Failures resolve to `undefined` so callers do not need to handle
   * rejections themselves.
   * @param {() => Promise<T>} fn - The async operation to run.
   * @param {string} [errorMessage] - Optional fallback message shown on failure.
   * @returns {Promise<T | undefined>} The operation result, or undefined on failure.
   */
  const wrapAsync = useCallback(
    <T>(fn: () => Promise<T>, errorMessage?: string): Promise<T | undefined> => {
      log.debug(LOG_WRAP_ASYNC_CALLED);
      return fn().catch((err: unknown) => {
        log.error(LOG_WRAP_ASYNC_CAUGHT, errorMessage || err);
        if (errorMessage) {
          showErrorMessage('UNKNOWN' as ErrorCodeType, errorMessage);
        } else {
          showError(err);
        }
        return undefined;
      });
    },
    [showError, showErrorMessage],
  );

  return { currentError, handleError, handleErrorMessage, clearError, wrapAsync };
}
