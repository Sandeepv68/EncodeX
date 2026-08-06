import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaTask } from '../useMediaTask';
import { useErrorStore } from '../../stores/errorStore';
import type { ConversionProgress } from '../../../shared/types';

const onConversionProgressMock = vi.mocked(window.electronAPI.onConversionProgress);

describe('useMediaTask', () => {
  beforeEach(() => {
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    onConversionProgressMock.mockReset();
    onConversionProgressMock.mockReturnValue(vi.fn());
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

  it('applies conversion progress events while a task is running', async () => {
    let resolveTask: () => void = () => {};
    let progressCb:
      | ((data: { input: string; output: string; progress: ConversionProgress }) => void)
      | undefined;
    onConversionProgressMock.mockImplementation((cb) => {
      progressCb = cb;
      return vi.fn();
    });
    const { result } = renderHook(() => useMediaTask());
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.runTask(() => new Promise<void>((resolve) => (resolveTask = resolve)));
    });
    expect(result.current.isConverting).toBe(true);
    act(() => {
      progressCb?.({ input: 'in.png', output: 'out.jpg', progress: { percent: 42, time: '00:00:01', speed: '1.5x', eta: '5', fps: 30, bitrate: '800k' } });
    });
    expect(result.current.progress).toEqual({ percent: 42, time: '00:00:01', speed: '1.5x', eta: '5' });
    await act(async () => {
      resolveTask();
      await pending;
    });
  });

  it('ignores conversion progress events when no task is running', () => {
    let progressCb:
      | ((data: { input: string; output: string; progress: ConversionProgress }) => void)
      | undefined;
    onConversionProgressMock.mockImplementation((cb) => {
      progressCb = cb;
      return vi.fn();
    });
    const { result } = renderHook(() => useMediaTask());
    act(() => {
      progressCb?.({ input: 'in.png', output: 'out.jpg', progress: { percent: 80, time: '00:00:02', speed: '1x', eta: '1', fps: 30, bitrate: '800k' } });
    });
    expect(result.current.progress).toBeNull();
  });
});
