import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOnlineStatus } from '../useOnlineStatus';

describe('useOnlineStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns navigator.onLine as the initial value', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
    spy.mockRestore();
  });

  it('defaults to online when navigator is unavailable', () => {
    vi.stubGlobal('navigator', undefined);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    vi.unstubAllGlobals();
  });

  it('updates when the window emits online and offline events', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
    spy.mockRestore();
  });
});
