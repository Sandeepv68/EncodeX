import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormErrors } from '../useFormErrors';

describe('useFormErrors', () => {
  it('starts with empty errors', () => {
    const { result } = renderHook(() => useFormErrors());
    expect(result.current.errors).toEqual({});
  });

  it('setFieldError adds an error', () => {
    const { result } = renderHook(() => useFormErrors());
    act(() => result.current.setFieldError('name', 'required'));
    expect(result.current.errors).toEqual({ name: 'required' });
  });

  it('setFieldError with the same message keeps the same errors reference', () => {
    const { result } = renderHook(() => useFormErrors());
    act(() => result.current.setFieldError('name', 'required'));
    const before = result.current.errors;
    act(() => result.current.setFieldError('name', 'required'));
    expect(result.current.errors).toBe(before);
  });

  it('setFieldError overwrites an existing message', () => {
    const { result } = renderHook(() => useFormErrors());
    act(() => result.current.setFieldError('name', 'required'));
    act(() => result.current.setFieldError('name', 'too long'));
    expect(result.current.errors).toEqual({ name: 'too long' });
  });

  it('clearFieldError removes an existing error', () => {
    const { result } = renderHook(() => useFormErrors());
    act(() => {
      result.current.setFieldError('name', 'required');
      result.current.clearFieldError('name');
    });
    expect(result.current.errors).toEqual({});
  });

  it('clearFieldError on an unknown field is a no-op', () => {
    const { result } = renderHook(() => useFormErrors());
    act(() => {
      result.current.setFieldError('name', 'required');
      result.current.clearFieldError('other');
    });
    expect(result.current.errors).toEqual({ name: 'required' });
  });

  it('setErrors replaces all errors', () => {
    const { result } = renderHook(() => useFormErrors());
    act(() => result.current.setErrors({ a: '1', b: '2' }));
    expect(result.current.errors).toEqual({ a: '1', b: '2' });
  });
});
