import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskRunControls } from '../useMediaTask';
import { useRemuxStore } from '../../stores/remuxStore';
import { useDemuxStore } from '../../stores/demuxStore';

vi.mocked(window.electronAPI.pauseConversion).mockResolvedValue(undefined);
vi.mocked(window.electronAPI.resumeConversion).mockResolvedValue(undefined);
vi.mocked(window.electronAPI.cancelConversion).mockResolvedValue(undefined);

describe('useTaskRunControls', () => {
  beforeEach(() => {
    useRemuxStore.setState({ progress: null, isConverting: false, isPaused: false });
    useDemuxStore.setState({ progress: null, isConverting: false, isPaused: false, current: null });
  });

  it('reads Remux run state from the store', () => {
    useRemuxStore.setState({ progress: { percent: 40, time: '00:00:04', speed: '1x', eta: '6' }, isConverting: true });
    const { result } = renderHook(() => useTaskRunControls(useRemuxStore));
    expect(result.current.progress?.percent).toBe(40);
    expect(result.current.isConverting).toBe(true);
    expect(result.current.current).toBeNull();
  });

  it('reads Demux run state including current sub-task', () => {
    useDemuxStore.setState({ isConverting: true, current: 'audio:2' });
    const { result } = renderHook(() => useTaskRunControls(useDemuxStore));
    expect(result.current.isConverting).toBe(true);
    expect(result.current.current).toBe('audio:2');
  });

  it('binds pause/resume/cancel to the store actions', async () => {
    const { result } = renderHook(() => useTaskRunControls(useDemuxStore));
    await act(async () => {
      await result.current.pause();
      await result.current.resume();
      await result.current.cancel();
    });
    expect(window.electronAPI.pauseConversion).toHaveBeenCalled();
    expect(window.electronAPI.resumeConversion).toHaveBeenCalled();
    expect(window.electronAPI.cancelConversion).toHaveBeenCalled();
    expect(useDemuxStore.getState().isPaused).toBe(false);
    expect(useDemuxStore.getState().isConverting).toBe(false);
  });
});
