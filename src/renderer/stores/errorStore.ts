import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { AppError, createError, formatError, ErrorCode, ErrorCodeType, ERROR_MESSAGES } from '../../shared/errors';

const log = new Logger('renderer/stores/errorStore');

interface ErrorState {
  currentError: AppError | null;
  errorHistory: AppError[];
  showError: (err: unknown) => void;
  showErrorMessage: (code: ErrorCodeType, detail?: string) => void;
  clearError: () => void;
  clearHistory: () => void;
}

export const useErrorStore = create<ErrorState>((set) => ({
  currentError: null,
  errorHistory: [],
  showError: (err: unknown) => {
    const appError = formatError(err);
    log.error('Error shown:', appError.code, appError.message, appError.detail || '');
    set((s) => ({
      currentError: appError,
      errorHistory: [...s.errorHistory.slice(-49), appError],
    }));
  },
  showErrorMessage: (code: ErrorCodeType, detail?: string) => {
    const appError = createError(code, ERROR_MESSAGES[code], detail);
    log.error('Error message shown:', code, ERROR_MESSAGES[code], detail || '');
    set((s) => ({
      currentError: appError,
      errorHistory: [...s.errorHistory.slice(-49), appError],
    }));
  },
  clearError: () => {
    log.debug('Error cleared');
    set({ currentError: null });
  },
  clearHistory: () => {
    log.debug('Error history cleared');
    set({ errorHistory: [] });
  },
}));
