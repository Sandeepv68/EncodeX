import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConversion } from '../useConversion';
import { useConversionStore } from '../../stores/conversionStore';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';
import { ErrorCode } from '../../../shared/errors';
import { COMPLETED_PROGRESS } from '../../../shared/transcoder-constants';
import type { ConversionProgress } from '../../../shared/types';

const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const onConversionProgressMock = vi.mocked(window.electronAPI.onConversionProgress);
const pauseConversionMock = vi.mocked(window.electronAPI.pauseConversion);
const resumeConversionMock = vi.mocked(window.electronAPI.resumeConversion);
const cancelConversionMock = vi.mocked(window.electronAPI.cancelConversion);
const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectOutputMock = vi.mocked(window.electronAPI.selectOutput);

function resetStores(): void {
  useConversionStore.setState({
    inputFile: null,
    outputFile: null,
    outputUserSet: false,
    videoCodec: 'libx264',
    audioCodec: 'aac',
    videoBitrate: '2000k',
    audioBitrate: '192k',
    qscale: 23,
    scale: '1920x1080',
    pixelFormat: 'yuv420p',
    copyMode: false,
    transcoder: 'FFMPEG',
    isConverting: false,
    isPaused: false,
    isDirty: false,
    progress: null,
  });
  useErrorStore.setState({ currentError: null, errorHistory: [] });
  useToastStore.setState({ toasts: [] });
}

describe('useConversion', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    convertFileMock.mockResolvedValue(undefined);
    pauseConversionMock.mockResolvedValue(undefined);
    resumeConversionMock.mockResolvedValue(undefined);
    cancelConversionMock.mockResolvedValue(undefined);
    onConversionProgressMock.mockReturnValue(vi.fn());
  });

  it('subscribes to conversion progress and updates the store', () => {
    let progressCb: ((data: { input: string; output: string; progress: ConversionProgress }) => void) | undefined;
    onConversionProgressMock.mockImplementation((cb) => {
      progressCb = cb;
      return vi.fn();
    });
    renderHook(() => useConversion());
    expect(onConversionProgressMock).toHaveBeenCalledOnce();
    act(() => {
      progressCb?.({
        input: 'a',
        output: 'b',
        progress: { percent: 42, time: '00:00:01', fps: 24, speed: '1x', eta: '5', bitrate: '1000k' },
      });
    });
    expect(useConversionStore.getState().progress).toMatchObject({ percent: 42 });
  });

  it('unsubscribes from conversion progress on unmount', () => {
    const cleanup = vi.fn();
    onConversionProgressMock.mockReturnValue(cleanup);
    const { unmount } = renderHook(() => useConversion());
    unmount();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('shows an error when no input file is selected', async () => {
    useConversionStore.setState({ inputFile: null, outputFile: 'out.mp4' });
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.startConversion();
    });
    expect(convertFileMock).not.toHaveBeenCalled();
    expect(useErrorStore.getState().currentError?.code).toBe(ErrorCode.INPUT_NOT_SPECIFIED);
  });

  it('shows an error when no output file is selected', async () => {
    useConversionStore.setState({ inputFile: 'in.mp4', outputFile: null, outputUserSet: true });
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.startConversion();
    });
    expect(convertFileMock).not.toHaveBeenCalled();
    expect(useErrorStore.getState().currentError?.code).toBe(ErrorCode.OUTPUT_NOT_SPECIFIED);
  });

  it('auto-suggests an output file when none is user-set', () => {
    useConversionStore.setState({ inputFile: 'in.mp4', outputFile: null, outputUserSet: false });
    renderHook(() => useConversion());
    expect(useConversionStore.getState().outputFile).toBe('in_converted.mp4');
  });

  it('auto-suggests an output file preserving the input extension in copy mode', () => {
    useConversionStore.setState({ inputFile: 'video.webm', outputFile: null, outputUserSet: false, copyMode: true });
    renderHook(() => useConversion());
    expect(useConversionStore.getState().outputFile).toBe('video_converted.webm');
  });

  it('does not override an output file the user set', () => {
    useConversionStore.setState({ inputFile: 'in.mp4', outputFile: 'out.mkv', outputUserSet: true });
    renderHook(() => useConversion());
    expect(useConversionStore.getState().outputFile).toBe('out.mkv');
  });

  it('starts a conversion with codec options and completes', async () => {
    useConversionStore.setState({ inputFile: 'in.mp4', outputFile: 'out.mp4', outputUserSet: true, transcoder: 'FFMPEG' });
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.startConversion();
    });
    expect(convertFileMock).toHaveBeenCalledWith(
      'in.mp4',
      'out.mp4',
      {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        videoBitrate: '2000k',
        audioBitrate: '192k',
        qscale: 23,
        scale: '1920x1080',
        pixelFormat: 'yuv420p',
        copy: false,
        hardwareAcceleration: true,
        hwaccelMode: 'auto',
      },
      'FFMPEG',
    );
    expect(useConversionStore.getState().progress).toEqual(COMPLETED_PROGRESS);
    expect(useConversionStore.getState().isConverting).toBe(false);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('omits codec options in copy mode', async () => {
    useConversionStore.setState({ inputFile: 'in.mp4', outputFile: 'out.mp4', outputUserSet: true, copyMode: true });
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.startConversion();
    });
    expect(convertFileMock).toHaveBeenCalledWith(
      'in.mp4',
      'out.mp4',
      expect.objectContaining({ videoCodec: undefined, audioCodec: undefined, copy: true }),
      'FFMPEG',
    );
  });

  it('shows the error when the conversion fails', async () => {
    useConversionStore.setState({ inputFile: 'in.mp4', outputFile: 'out.mp4' });
    convertFileMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.startConversion();
    });
    expect(useErrorStore.getState().currentError?.detail).toBe('boom');
    expect(useConversionStore.getState().isConverting).toBe(false);
  });

  it('pauseConversion sets isPaused', async () => {
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.pauseConversion();
    });
    expect(pauseConversionMock).toHaveBeenCalledOnce();
    expect(useConversionStore.getState().isPaused).toBe(true);
  });

  it('resumeConversion clears isPaused', async () => {
    useConversionStore.setState({ isPaused: true });
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.resumeConversion();
    });
    expect(resumeConversionMock).toHaveBeenCalledOnce();
    expect(useConversionStore.getState().isPaused).toBe(false);
  });

  it('cancelConversion clears isConverting', async () => {
    useConversionStore.setState({ isConverting: true });
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.cancelConversion();
    });
    expect(cancelConversionMock).toHaveBeenCalledOnce();
    expect(useConversionStore.getState().isConverting).toBe(false);
  });

  it('selectInput sets the input file', async () => {
    selectFileMock.mockResolvedValue('in.mp4');
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.selectInput();
    });
    expect(useConversionStore.getState().inputFile).toBe('in.mp4');
    expect(useConversionStore.getState().isDirty).toBe(true);
  });

  it('selectInput ignores a cancelled dialog', async () => {
    selectFileMock.mockResolvedValue(null);
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.selectInput();
    });
    expect(useConversionStore.getState().inputFile).toBeNull();
  });

  it('selectInput shows an error when the dialog fails', async () => {
    selectFileMock.mockRejectedValue(new Error('dialog boom'));
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.selectInput();
    });
    expect(useErrorStore.getState().currentError?.detail).toBe('dialog boom');
  });

  it('selectOutput sets the output file', async () => {
    selectOutputMock.mockResolvedValue('out.mp4');
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.selectOutput();
    });
    expect(useConversionStore.getState().outputFile).toBe('out.mp4');
  });

  it('selectOutput shows an error when the dialog fails', async () => {
    selectOutputMock.mockRejectedValue(new Error('output boom'));
    const { result } = renderHook(() => useConversion());
    await act(async () => {
      await result.current.selectOutput();
    });
    expect(useErrorStore.getState().currentError?.detail).toBe('output boom');
  });
});
