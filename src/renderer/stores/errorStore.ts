/**
 * @fileoverview Zustand store for application error state.
 * Centralizes error management and error display across the app.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { AppError, createError, formatError, ErrorCode, ErrorCodeType, ERROR_MESSAGES } from '../../shared/errors';
import { ERROR_HISTORY_MAX } from '../../shared/constants';
import { LOG_ERROR_CLEARED, LOG_ERROR_HISTORY_CLEARED, LOG_ERROR_MESSAGE_SHOWN, LOG_ERROR_SHOWN } from '../../shared/log-constants';

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
    log.error(LOG_ERROR_SHOWN, appError.code, appError.message, appError.detail || '');
    set((s) => ({
      currentError: appError,
      errorHistory: [...s.errorHistory.slice(-(ERROR_HISTORY_MAX - 1)), appError],
    }));
  },
  showErrorMessage: (code: ErrorCodeType, detail?: string) => {
    const appError = createError(code, ERROR_MESSAGES[code], detail);
    log.error(LOG_ERROR_MESSAGE_SHOWN, code, ERROR_MESSAGES[code], detail || '');
    set((s) => ({
      currentError: appError,
      errorHistory: [...s.errorHistory.slice(-(ERROR_HISTORY_MAX - 1)), appError],
    }));
  },
  clearError: () => {
    log.debug(LOG_ERROR_CLEARED);
    set({ currentError: null });
  },
  clearHistory: () => {
    log.debug(LOG_ERROR_HISTORY_CLEARED);
    set({ errorHistory: [] });
  },
}));
