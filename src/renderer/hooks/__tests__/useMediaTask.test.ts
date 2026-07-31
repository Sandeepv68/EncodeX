import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaTask } from '../useMediaTask';
import { useErrorStore } from '../../stores/errorStore';

describe('useMediaTask', () => {
  beforeEach(() => {
    useErrorStore.setState({ currentError: null, errorHistory: [] });
  });

  it('starts idle', () => {
    const { result } = renderHook(() => useMediaTask());
    expect(result.current.isConverting).toBe(false);
    expect(result.current.progress).toBeNull();
  });

  it('sets completed progress and clears converting state on success', async () => {
    const { result } = renderHook(() => useMediaTask());
    await act(async () => {
      await result.current.runTask(async () => {});
    });
    expect(result.current.isConverting).toBe(false);
    expect(result.current.progress).toEqual({ percent: 100, time: 'Done', speed: '-', eta: '0' });
  });

  it('shows the error and keeps progress untouched on failure', async () => {
    const { result } = renderHook(() => useMediaTask());
    await act(async () => {
      await result.current.runTask(async () => {
        throw new Error('boom');
      });
    });
    expect(useErrorStore.getState().currentError?.detail).toBe('boom');
    expect(result.current.isConverting).toBe(false);
    expect(result.current.progress).toBeNull();
  });

  it('setProgress updates progress directly', () => {
    const { result } = renderHook(() => useMediaTask());
    act(() => {
      result.current.setProgress({ percent: 50, time: '00:00:01', speed: '1x', eta: '10' });
    });
    expect(result.current.progress).toEqual({ percent: 50, time: '00:00:01', speed: '1x', eta: '10' });
  });
});
