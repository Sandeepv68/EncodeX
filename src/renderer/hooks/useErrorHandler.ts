import { useCallback } from 'react';
import { useErrorStore } from '../stores/errorStore';
import { ErrorCodeType } from '../../shared/errors';

export function useErrorHandler() {
  const { currentError, showError, showErrorMessage, clearError } = useErrorStore();

  const handleError = useCallback((err: unknown) => {
    showError(err);
  }, [showError]);

  const handleErrorMessage = useCallback((code: ErrorCodeType, detail?: string) => {
    showErrorMessage(code, detail);
  }, [showErrorMessage]);

  const wrapAsync = useCallback(<T>(fn: () => Promise<T>, errorMessage?: string): Promise<T | undefined> => {
    return fn().catch((err: unknown) => {
      if (errorMessage) {
        showErrorMessage('UNKNOWN' as ErrorCodeType, errorMessage);
      } else {
        showError(err);
      }
      return undefined;
    });
  }, [showError, showErrorMessage]);

  return { currentError, handleError, handleErrorMessage, clearError, wrapAsync };
}
