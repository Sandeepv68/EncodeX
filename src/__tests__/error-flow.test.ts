import { describe, it, expect, beforeEach } from 'vitest';
import { createError, formatError, isAppError, ErrorCode, ERROR_MESSAGES } from '../shared/errors';
import { useErrorStore } from '../renderer/stores/errorStore';

describe('Error flow integration', () => {
  beforeEach(() => {
    useErrorStore.setState({ currentError: null, errorHistory: [] });
  });

  it('creates error → formats → stores → displays', () => {
    const original = new Error('ffmpeg binary not found in PATH');
    const formatted = formatError(original);

    expect(formatted.code).toBe(ErrorCode.FFMPEG_NOT_FOUND);
    expect(formatted.message).toBe(ERROR_MESSAGES.FFMPEG_NOT_FOUND);
    expect(formatted.detail).toBe('ffmpeg binary not found in PATH');
    expect(isAppError(formatted)).toBe(true);

    useErrorStore.getState().showError(formatted);
    const state = useErrorStore.getState();

    expect(state.currentError!.code).toBe(ErrorCode.FFMPEG_NOT_FOUND);
    expect(state.currentError!.message).toBe(ERROR_MESSAGES.FFMPEG_NOT_FOUND);
  });

  it('conversion failure: Error → formatError → store → clear', () => {
    useErrorStore.getState().showError(new Error('conversion process exited with code 1'));
    let state = useErrorStore.getState();
    expect(state.currentError!.code).toBe(ErrorCode.CONVERSION_FAILED);
    expect(state.errorHistory).toHaveLength(1);

    useErrorStore.getState().clearError();
    state = useErrorStore.getState();
    expect(state.currentError).toBeNull();
    expect(state.errorHistory).toHaveLength(1);
  });

  it('cancellation: Error → formatError → store', () => {
    useErrorStore.getState().showError(new Error('user cancelled the operation'));
    const state = useErrorStore.getState();
    expect(state.currentError!.code).toBe(ErrorCode.CANCELLED);
  });

  it('multiple errors: history accumulates and clears independently', () => {
    useErrorStore.getState().showError(new Error('file not found'));
    useErrorStore.getState().showError(new Error('permission denied'));
    useErrorStore.getState().showError(new Error('unknown issue'));

    let state = useErrorStore.getState();
    expect(state.errorHistory).toHaveLength(3);
    expect(state.currentError!.code).toBe(ErrorCode.UNKNOWN);

    useErrorStore.getState().clearError();
    state = useErrorStore.getState();
    expect(state.currentError).toBeNull();
    expect(state.errorHistory).toHaveLength(3);

    useErrorStore.getState().clearHistory();
    state = useErrorStore.getState();
    expect(state.errorHistory).toEqual([]);
  });

  it('handles raw string errors', () => {
    useErrorStore.getState().showError('raw string error');
    const state = useErrorStore.getState();
    expect(isAppError(state.currentError)).toBe(true);
    expect(state.currentError!.detail).toBe('raw string error');
  });

  it('handles null/undefined gracefully', () => {
    useErrorStore.getState().showError(null);
    expect(useErrorStore.getState().currentError).not.toBeNull();
    useErrorStore.getState().clearError();
    useErrorStore.getState().showError(undefined);
    expect(useErrorStore.getState().currentError).not.toBeNull();
  });

  it('preserves AppError through formatError', () => {
    const appErr = createError(ErrorCode.QUEUE_ERROR, 'custom queue message', 'detail');
    const formatted = formatError(appErr);
    expect(formatted).toBe(appErr);
    expect(formatted.code).toBe(ErrorCode.QUEUE_ERROR);
  });
});
