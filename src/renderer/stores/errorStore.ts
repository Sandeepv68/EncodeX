/**
 * @fileoverview Zustand store for application error state.
 * Centralizes error management and error display across the app.
 *
 * State held:
 *  - currentError: the error currently displayed, or null when none
 *  - errorHistory: recent errors in chronological order, capped at
 *    ERROR_HISTORY_MAX (50) entries
 *
 * Behavior notes:
 *  - showError normalizes an arbitrary thrown value into an AppError via
 *    formatError before storing it; showErrorMessage builds an AppError from an
 *    ErrorCode using the canonical ERROR_MESSAGES text.
 *  - Each new error is pushed onto the history while the oldest entry is
 *    trimmed, keeping the history bounded.
 *
 * Consumers:
 *  - The global error dialog / notification UI (renderer)
 *  - Stores and hooks that surface failures, e.g. audioExtractStore,
 *    conversionStore, and useMediaTask
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { createError, formatError, ErrorCode, ERROR_MESSAGES } from '../../shared/errors';
import type { AppError, ErrorCodeType } from '../../shared/types';
import type { ErrorState } from './types';
import { ERROR_HISTORY_MAX } from '../../shared/constants';
import { LOG_ERROR_CLEARED, LOG_ERROR_HISTORY_CLEARED, LOG_ERROR_MESSAGE_SHOWN, LOG_ERROR_SHOWN } from '../../shared/log-constants';

/**
 * Per-store logger for the error store.
 * @const {Logger} log
 */
const log = new Logger('renderer/stores/errorStore');

/**
 * Zustand store for application error state.
 * Holds the currently displayed error (`currentError`) and a bounded history of
 * recent errors (`errorHistory`, capped at ERROR_HISTORY_MAX = 50). Implemented
 * as a module-level singleton so any renderer module can surface an error via
 * useErrorStore.getState().showError(...) / showErrorMessage(...).
 * @const {UseBoundStore<StoreApi<ErrorState>>} useErrorStore
 */
export const useErrorStore = create<ErrorState>((set) => ({
  currentError: null,
  errorHistory: [],
  /**
   * Normalizes an unknown thrown value into an AppError via formatError and
   * sets it as currentError, also pushing it onto the bounded error history.
   * @param {unknown} err - The raw thrown value (Error, string, AppError, etc.).
   */
  showError: (err: unknown) => {
    const appError = formatError(err);
    log.error(LOG_ERROR_SHOWN, appError.code, appError.message, appError.detail || '');
    set((s) => ({
      currentError: appError,
      errorHistory: [...s.errorHistory.slice(-(ERROR_HISTORY_MAX - 1)), appError],
    }));
  },
  /**
   * Builds an AppError from an error code (using the canonical message from
   * ERROR_MESSAGES) and sets it as currentError, also pushing it onto the
   * bounded error history.
   * @param {ErrorCodeType} code - The error code identifying the message.
   * @param {string} [detail] - Optional additional detail shown to the user.
   */
  showErrorMessage: (code: ErrorCodeType, detail?: string) => {
    const appError = createError(code, ERROR_MESSAGES[code], detail);
    log.error(LOG_ERROR_MESSAGE_SHOWN, code, ERROR_MESSAGES[code], detail || '');
    set((s) => ({
      currentError: appError,
      errorHistory: [...s.errorHistory.slice(-(ERROR_HISTORY_MAX - 1)), appError],
    }));
  },
  /**
   * Clears the currently displayed error.
   */
  clearError: () => {
    log.debug(LOG_ERROR_CLEARED);
    set({ currentError: null });
  },
  /**
   * Empties the entire error history.
   */
  clearHistory: () => {
    log.debug(LOG_ERROR_HISTORY_CLEARED);
    set({ errorHistory: [] });
  },
}));
