import { describe, it, expect, beforeEach } from 'vitest';
import { useErrorStore } from '../errorStore';
import { createError, ErrorCode } from '../../../shared/errors';

describe('errorStore', () => {
  beforeEach(() => {
    useErrorStore.setState({ currentError: null, errorHistory: [] });
  });

  it('starts with no error', () => {
    const state = useErrorStore.getState();
    expect(state.currentError).toBeNull();
    expect(state.errorHistory).toEqual([]);
  });

  it('showError sets currentError', () => {
    useErrorStore.getState().showError(new Error('test error'));
    const state = useErrorStore.getState();
    expect(state.currentError).not.toBeNull();
    expect(state.currentError!.message).toBeDefined();
  });

  it('showError with AppError preserves it', () => {
    const appErr = createError(ErrorCode.FILE_NOT_FOUND, 'custom message');
    useErrorStore.getState().showError(appErr);
    const state = useErrorStore.getState();
    expect(state.currentError!.code).toBe('FILE_NOT_FOUND');
    expect(state.currentError!.message).toBe('custom message');
  });

  it('showErrorMessage sets currentError with matching message', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.FFMPEG_NOT_FOUND, 'detail');
    const state = useErrorStore.getState();
    expect(state.currentError!.code).toBe('FFMPEG_NOT_FOUND');
  });

  it('showError adds to errorHistory', () => {
    useErrorStore.getState().showError(new Error('err1'));
    useErrorStore.getState().showError(new Error('err2'));
    const state = useErrorStore.getState();
    expect(state.errorHistory).toHaveLength(2);
  });

  it('clearError resets currentError to null', () => {
    useErrorStore.getState().showError(new Error('test'));
    useErrorStore.getState().clearError();
    expect(useErrorStore.getState().currentError).toBeNull();
  });

  it('clearHistory empties errorHistory', () => {
    useErrorStore.getState().showError(new Error('err1'));
    useErrorStore.getState().clearHistory();
    expect(useErrorStore.getState().errorHistory).toEqual([]);
  });

  it('errorHistory caps at 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      useErrorStore.getState().showError(new Error(`err${i}`));
    }
    expect(useErrorStore.getState().errorHistory).toHaveLength(50);
  });

  it('showErrorMessage creates error with correct code', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.CONVERSION_FAILED, 'conversion detail');
    const state = useErrorStore.getState();
    expect(state.currentError!.code).toBe('CONVERSION_FAILED');
    expect(state.currentError!.detail).toBe('conversion detail');
  });
});
