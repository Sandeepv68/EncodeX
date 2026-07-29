import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '../useErrorHandler';
import { useErrorStore } from '../../stores/errorStore';

describe('useErrorHandler', () => {
  beforeEach(() => {
    useErrorStore.setState({ currentError: null, errorHistory: [] });
  });

  it('returns currentError from store', () => {
    const { result } = renderHook(() => useErrorHandler());
    expect(result.current.currentError).toBeNull();
  });

  it('handleError calls showError', () => {
    const { result } = renderHook(() => useErrorHandler());
    act(() => {
      result.current.handleError(new Error('test error'));
    });
    expect(result.current.currentError).not.toBeNull();
    expect(result.current.currentError!.detail).toBe('test error');
  });

  it('handleErrorMessage creates error with given code', () => {
    const { result } = renderHook(() => useErrorHandler());
    act(() => {
      result.current.handleErrorMessage('FILE_NOT_FOUND' as never, 'detail message');
    });
    expect(result.current.currentError!.code).toBe('FILE_NOT_FOUND');
  });

  it('wrapAsync catches error and calls showError', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const failingFn = () => Promise.reject(new Error('async error'));
    await act(async () => {
      await result.current.wrapAsync(failingFn);
    });
    expect(result.current.currentError).not.toBeNull();
    expect(result.current.currentError!.detail).toBe('async error');
  });

  it('wrapAsync returns undefined on error', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const failingFn = () => Promise.reject(new Error('fail'));
    const val = await result.current.wrapAsync(failingFn);
    expect(val).toBeUndefined();
  });

  it('wrapAsync returns value on success', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const successFn = () => Promise.resolve(42);
    const val = await result.current.wrapAsync(successFn);
    expect(val).toBe(42);
  });

  it('clearError resets currentError', () => {
    const { result } = renderHook(() => useErrorHandler());
    act(() => {
      result.current.handleError(new Error('test'));
    });
    expect(result.current.currentError).not.toBeNull();
    act(() => {
      result.current.clearError();
    });
    expect(result.current.currentError).toBeNull();
  });
});
