/**
 * @fileoverview Hook for centralized error handling and display.
 * Manages error toasts and notifications across the application.
 */

import { useCallback } from 'react';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { ErrorCodeType } from '../../shared/errors';
import { LOG_HANDLE_ERROR, LOG_HANDLE_ERROR_MESSAGE, LOG_WRAP_ASYNC_CALLED, LOG_WRAP_ASYNC_CAUGHT } from '../../shared/log-constants';

const log = new Logger('renderer/hooks/useErrorHandler');

export function useErrorHandler() {
  const { currentError, showError, showErrorMessage, clearError } = useErrorStore();

  const handleError = useCallback(
    (err: unknown) => {
      log.error(LOG_HANDLE_ERROR, err);
      showError(err);
    },
    [showError],
  );

  const handleErrorMessage = useCallback(
    (code: ErrorCodeType, detail?: string) => {
      log.error(LOG_HANDLE_ERROR_MESSAGE, code, detail || '');
      showErrorMessage(code, detail);
    },
    [showErrorMessage],
  );

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
