import { useCallback } from 'react';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { ErrorCodeType } from '../../shared/errors';

const log = new Logger('renderer/hooks/useErrorHandler');

export function useErrorHandler() {
  const { currentError, showError, showErrorMessage, clearError } = useErrorStore();

  const handleError = useCallback(
    (err: unknown) => {
      log.error('handleError:', err);
      showError(err);
    },
    [showError],
  );

  const handleErrorMessage = useCallback(
    (code: ErrorCodeType, detail?: string) => {
      log.error('handleErrorMessage:', code, detail || '');
      showErrorMessage(code, detail);
    },
    [showErrorMessage],
  );

  const wrapAsync = useCallback(
    <T>(fn: () => Promise<T>, errorMessage?: string): Promise<T | undefined> => {
      log.debug('wrapAsync called');
      return fn().catch((err: unknown) => {
        log.error('wrapAsync caught:', errorMessage || err);
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
