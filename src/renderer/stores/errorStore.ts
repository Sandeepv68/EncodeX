import { create } from 'zustand';
import { AppError, createError, formatError, ErrorCode, ErrorCodeType } from '../../shared/errors';

interface ErrorState {
  currentError: AppError | null;
  errorHistory: AppError[];
  showError: (err: any) => void;
  showErrorMessage: (code: ErrorCodeType, detail?: string) => void;
  clearError: () => void;
  clearHistory: () => void;
}

export const useErrorStore = create<ErrorState>((set) => ({
  currentError: null,
  errorHistory: [],
  showError: (err: any) => {
    const appError = formatError(err);
    set((s) => ({
      currentError: appError,
      errorHistory: [...s.errorHistory.slice(-49), appError],
    }));
  },
  showErrorMessage: (code: ErrorCodeType, detail?: string) => {
    const appError = createError(code, ERROR_MESSAGES[code], detail);
    set((s) => ({
      currentError: appError,
      errorHistory: [...s.errorHistory.slice(-49), appError],
    }));
  },
  clearError: () => set({ currentError: null }),
  clearHistory: () => set({ errorHistory: [] }),
}));
