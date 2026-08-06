import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import VideoCut from '../VideoCut';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';
import type { MediaInfo, ConversionProgress } from '../../../shared/types';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectOutputMock = vi.mocked(window.electronAPI.selectOutput);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const playerOpenMock = vi.mocked(window.electronAPI.playerOpen);
const playerSeekMock = vi.mocked(window.electronAPI.playerSeek);
const extractWaveformMock = vi.mocked(window.electronAPI.extractWaveform);
const extractThumbnailsMock = vi.mocked(window.electronAPI.extractThumbnails);
const pauseConversionMock = vi.mocked(window.electronAPI.pauseConversion);
const resumeConversionMock = vi.mocked(window.electronAPI.resumeConversion);
const cancelConversionMock = vi.mocked(window.electronAPI.cancelConversion);

function mediaInfo(duration: number): MediaInfo {
  return { file: 'v.mp4', format: 'mp4', size: 0, duration, bitrate: '', streams: [] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mockRect(el: HTMLElement, left: number, width: number) {
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      left,
      top: 0,
      right: left + width,
      bottom: 0,
      width,
      height: 0,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

function renderPage() {
  return render(<VideoCut />);
}

async function selectVideo() {
  selectFileMock.mockResolvedValue('/in/video.mp4');
  fireEvent.click(screen.getByText('videoCut.dropLabel'));
  await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
}

describe('VideoCut', () => {
  beforeEach(() => {
    selectFileMock.mockReset();
    selectOutputMock.mockReset();
    convertFileMock.mockReset();
    playerOpenMock.mockClear();
    playerSeekMock.mockClear();
    extractWaveformMock.mockClear();
    extractThumbnailsMock.mockClear();
    pauseConversionMock.mockClear();
    resumeConversionMock.mockClear();
    cancelConversionMock.mockClear();
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useToastStore.setState({ toasts: [] });
  });

  it('renders the title, fields, dropzone, and cut button', () => {
    renderPage();
    expect(screen.getByText('videoCut.title')).toBeInTheDocument();
    expect(screen.getByText('videoCut.videoFile')).toBeInTheDocument();
    expect(screen.getByText('videoCut.dropLabel')).toBeInTheDocument();
    expect(screen.getByText('videoCut.outputFile')).toBeInTheDocument();
    expect(screen.getByText('videoCut.startTime')).toBeInTheDocument();
    expect(screen.getByText('videoCut.endTime')).toBeInTheDocument();
    expect(screen.getByText('videoCut.useDuration')).toBeInTheDocument();
    expect(screen.getByText('videoCut.cut')).toBeInTheDocument();
  });

  it('shows a validation error when the output field is blurred empty', () => {
    renderPage();
    fireEvent.blur(screen.getByPlaceholderText('videoCut.placeholderOutput'));
    expect(screen.getByText('validation.outputRequired')).toBeInTheDocument();
  });

  it('shows a validation error for an invalid start time', () => {
    renderPage();
    const start = screen.getByPlaceholderText('videoCut.placeholderStart');
    fireEvent.change(start, { target: { value: '99:99' } });
    fireEvent.blur(start);
    expect(screen.getByText('validation.invalidTime')).toBeInTheDocument();
  });

  it('swaps the end time field for a duration field when the toggle is on', () => {
    const { container } = renderPage();
    expect(screen.getByPlaceholderText('videoCut.placeholderEnd')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('videoCut.placeholderDuration')).not.toBeInTheDocument();
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);
    expect(screen.queryByPlaceholderText('videoCut.placeholderEnd')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('videoCut.placeholderDuration')).toBeInTheDocument();
  });

  it('shows the video player without autoplay once a file is selected', async () => {
    const { container } = renderPage();
    await selectVideo();
    await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument());
    expect(playerOpenMock).not.toHaveBeenCalled();
    expect(screen.queryByText('videoCut.dropLabel')).not.toBeInTheDocument();
    expect(screen.getByText('videoCut.changeFile')).toBeInTheDocument();
  });

  it('shows the video title above the preview once a file is selected', async () => {
    const { container } = renderPage();
    expect(screen.queryByText('video.mp4')).not.toBeInTheDocument();
    await selectVideo();
    await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument());
    expect(screen.getByText('video.mp4')).toBeInTheDocument();
  });

  it('separates the preview section from the details section', async () => {
    const { container } = renderPage();
    expect(screen.queryByText('videoCut.preview')).not.toBeInTheDocument();
    expect(screen.getByText('videoCut.details')).toBeInTheDocument();
    await selectVideo();
    await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument());
    expect(screen.getByText('videoCut.preview')).toBeInTheDocument();
    expect(screen.getByText('videoCut.details')).toBeInTheDocument();
  });

  it('shows the cancel job button when a video is selected and clears the form on confirm', async () => {
    const { container } = renderPage();
    expect(screen.queryByText('videoCut.cancelJob')).not.toBeInTheDocument();
    await selectVideo();
    await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument());
    expect(screen.getByText('videoCut.cancelJob')).toBeInTheDocument();
    fireEvent.click(screen.getByText('videoCut.cancelJob'));
    expect(screen.getByText('videoCut.jobCancelTitle')).toBeInTheDocument();
    expect(screen.getByText('videoCut.jobCancelMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByText('videoCut.yes'));
    await waitFor(() => expect(screen.getByText('videoCut.dropLabel')).toBeInTheDocument());
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
    expect(screen.queryByText('videoCut.cancelJob')).not.toBeInTheDocument();
  });

  it('shows the cancel job button when the form is modified without a video', () => {
    renderPage();
    expect(screen.queryByText('videoCut.cancelJob')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/x.mp4' } });
    expect(screen.getByText('videoCut.cancelJob')).toBeInTheDocument();
  });

  it('clears the form when the preview close button is clicked', async () => {
    const { container } = renderPage();
    await selectVideo();
    await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('videoCut.closePreview'));
    expect(screen.getByText('videoCut.jobCancelTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByText('videoCut.yes'));
    await waitFor(() => expect(screen.getByText('videoCut.dropLabel')).toBeInTheDocument());
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
    expect(screen.queryByText('videoCut.closePreview')).not.toBeInTheDocument();
  });

  it('replaces the player when a different file is chosen via the change button', async () => {
    selectFileMock.mockResolvedValueOnce('/in/first.mp4').mockResolvedValueOnce('/in/second.mp4');
    const { container } = renderPage();
    await selectVideo();
    await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument());
    fireEvent.click(screen.getByText('videoCut.changeFile'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText('videoCut.changeFile')).toBeInTheDocument();
    expect(screen.queryByText('videoCut.dropLabel')).not.toBeInTheDocument();
  });

  it('requires a duration when duration mode is enabled', async () => {
    const { container } = renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.click(screen.getByRole('switch', { name: 'videoCut.useDuration' }));
    fireEvent.click(screen.getByText('videoCut.cut'));
    expect(screen.getByText('validation.durationRequired')).toBeInTheDocument();
    expect(convertFileMock).not.toHaveBeenCalled();
  });

  it('cuts with an end time when duration mode is off', async () => {
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderEnd'), { target: { value: '00:01:30' } });
    fireEvent.click(screen.getByText('videoCut.cut'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/video.mp4',
      '/out/cut.mp4',
      { copy: true, startTime: '00:00:00', endTime: '00:01:30' },
      'FFMPEG',
    );
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'toast.videoCut')).toBe(true);
  });

  it('cuts with a duration when duration mode is on', async () => {
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.click(screen.getByRole('switch', { name: 'videoCut.useDuration' }));
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderDuration'), { target: { value: '00:00:45' } });
    fireEvent.click(screen.getByText('videoCut.cut'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/video.mp4',
      '/out/cut.mp4',
      { copy: true, startTime: '00:00:00', duration: '00:00:45' },
      'FFMPEG',
    );
  });

  it('omits the audio stream when the timeline audio checkbox is unchecked', async () => {
    convertFileMock.mockResolvedValue(undefined);
    getMediaInfoMock.mockResolvedValue(mediaInfo(60));
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderEnd'), { target: { value: '00:01:30' } });
    fireEvent.click(await screen.findByTestId('timeline-audio-enabled'));
    fireEvent.click(screen.getByText('videoCut.cut'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/video.mp4',
      '/out/cut.mp4',
      { copy: true, startTime: '00:00:00', endTime: '00:01:30', audio: false },
      'FFMPEG',
    );
  });

  it('shows an error when the cut fails', async () => {
    convertFileMock.mockRejectedValue(new Error('cut failed'));
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.click(screen.getByText('videoCut.cut'));
    await waitFor(() => expect(useErrorStore.getState().currentError).not.toBeNull());
    expect(useErrorStore.getState().currentError?.detail).toBe('cut failed');
  });

  it('seeks the player when the timeline is clicked', async () => {
    getMediaInfoMock.mockResolvedValue(mediaInfo(60));
    renderPage();
    await selectVideo();
    const scroller = await screen.findByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    fireEvent.pointerDown(scroller, { clientX: 300 });
    await waitFor(() => expect(playerSeekMock).toHaveBeenCalledWith('00:00:30.000'));
  });

  it('updates the start time field when the start handle is dragged', async () => {
    getMediaInfoMock.mockResolvedValue(mediaInfo(60));
    renderPage();
    await selectVideo();
    const scroller = await screen.findByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    const handle = screen.getByTestId('timeline-start-handle');
    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(window, { clientX: 10 });
    fireEvent.pointerUp(window);
    expect(screen.getByPlaceholderText('videoCut.placeholderStart')).toHaveValue('00:00:01');
  });

  it('updates the end time field when the end handle is dragged', async () => {
    getMediaInfoMock.mockResolvedValue(mediaInfo(60));
    renderPage();
    await selectVideo();
    const scroller = await screen.findByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    const handle = screen.getByTestId('timeline-end-handle');
    fireEvent.pointerDown(handle, { clientX: 600 });
    fireEvent.pointerMove(window, { clientX: 590 });
    fireEvent.pointerUp(window);
    expect(screen.getByPlaceholderText('videoCut.placeholderEnd')).toHaveValue('00:00:59');
  });

  it('does not populate the end time field when only the start handle is moved', async () => {
    getMediaInfoMock.mockResolvedValue(mediaInfo(60));
    renderPage();
    await selectVideo();
    const scroller = await screen.findByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    const handle = screen.getByTestId('timeline-start-handle');
    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(window, { clientX: 10 });
    fireEvent.pointerUp(window);
    expect(screen.getByPlaceholderText('videoCut.placeholderStart')).toHaveValue('00:00:01');
    expect(screen.getByPlaceholderText('videoCut.placeholderEnd')).toHaveValue('');
  });

  it('extracts timeline media and renders waveform and thumbnails tracks', async () => {
    extractWaveformMock.mockResolvedValue({
      sampleRate: 8000,
      samplesPerBucket: 1000,
      buckets: [
        { min: -1, max: 1 },
        { min: -0.5, max: 0.5 },
      ],
    });
    extractThumbnailsMock.mockResolvedValue({
      dataUrl: 'data:image/png;base64,AAAA',
      cols: 2,
      rows: 2,
      thumbWidth: 160,
      thumbHeight: 90,
      interval: 7.5,
      count: 3,
    });
    getMediaInfoMock.mockResolvedValue(mediaInfo(60));
    renderPage();
    await selectVideo();
    await waitFor(() => expect(extractWaveformMock).toHaveBeenCalledWith('/in/video.mp4', 60));
    await waitFor(() => expect(extractThumbnailsMock).toHaveBeenCalledWith('/in/video.mp4', 60));
    await waitFor(() => expect(screen.getAllByTestId('timeline-thumb')).toHaveLength(3));
    expect(screen.getAllByTestId('timeline-waveform-bar')).toHaveLength(2);
    expect(screen.getByTestId('timeline-video-track')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-audio-track')).toBeInTheDocument();
  });

  it('shows loading skeletons while the preview is being generated and hides them after', async () => {
    const waveform = deferred<{ sampleRate: number; samplesPerBucket: number; buckets: { min: number; max: number }[] }>();
    const thumbnails = deferred<{
      dataUrl: string;
      cols: number;
      rows: number;
      thumbWidth: number;
      thumbHeight: number;
      interval: number;
      count: number;
    }>();
    extractWaveformMock.mockReturnValue(waveform.promise);
    extractThumbnailsMock.mockReturnValue(thumbnails.promise);
    getMediaInfoMock.mockResolvedValue(mediaInfo(60));
    renderPage();
    await selectVideo();
    await waitFor(() => expect(screen.getByTestId('timeline-generating')).toBeInTheDocument());
    expect(screen.getByTestId('timeline-thumb-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-waveform-skeleton')).toBeInTheDocument();
    await act(async () => {
      waveform.resolve({
        sampleRate: 8000,
        samplesPerBucket: 1000,
        buckets: [
          { min: -1, max: 1 },
          { min: -0.5, max: 0.5 },
        ],
      });
      thumbnails.resolve({
        dataUrl: 'data:image/png;base64,AAAA',
        cols: 2,
        rows: 2,
        thumbWidth: 160,
        thumbHeight: 90,
        interval: 7.5,
        count: 2,
      });
    });
    await waitFor(() => expect(screen.queryByTestId('timeline-generating')).not.toBeInTheDocument());
    expect(screen.queryByTestId('timeline-thumb-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timeline-waveform-skeleton')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-thumb')).toHaveLength(2);
  });

  it('shows stream details in the timeline tooltip when hovering a track', async () => {
    getMediaInfoMock.mockResolvedValue({
      file: 'v.mp4',
      format: 'mp4',
      size: 0,
      duration: 60,
      bitrate: '5000000',
      streams: [
        { index: 0, type: 'video', codec: 'h264', title: 'Main', width: 1920, height: 1080, bitrate: '4500000' },
        { index: 1, type: 'audio', codec: 'aac', channelLayout: 'stereo', sampleRate: 48000, bitrate: '128000' },
      ],
    });
    renderPage();
    await selectVideo();
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledWith('/in/video.mp4', 'FFMPEG'));
    expect(screen.getByTestId('timeline-video-tooltip')).toHaveTextContent('Main · h264 · 1920×1080 · 4.5 Mbps');
    expect(screen.getByTestId('timeline-audio-tooltip')).toHaveTextContent('aac · stereo · 48 kHz · 128 kbps');
  });

  it('shows live progress while cutting and hides it when the job completes', async () => {
    let resolveConvert: (value?: void) => void = () => {};
    let progressCb:
      | ((data: { input: string; output: string; progress: ConversionProgress }) => void)
      | undefined;
    vi.mocked(window.electronAPI.onConversionProgress).mockImplementation((cb) => {
      progressCb = cb;
      return vi.fn();
    });
    convertFileMock.mockReturnValue(new Promise((resolve) => (resolveConvert = resolve)));
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.click(screen.getByText('videoCut.cut'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(screen.getByText('videoCut.cutting')).toBeInTheDocument();
    act(() => {
      progressCb?.({
        input: '/in/video.mp4',
        output: '/out/cut.mp4',
        progress: { percent: 42, time: '00:00:01', speed: '1.5x', eta: '5', fps: 30, bitrate: '800k' },
      });
    });
    expect(screen.getByText('42.0%')).toBeInTheDocument();
    await act(async () => {
      resolveConvert();
    });
    expect(screen.queryByText('42.0%')).not.toBeInTheDocument();
    expect(screen.queryByText('100.0%')).not.toBeInTheDocument();
  });

  it('hides the progress bar when the cut is cancelled', async () => {
    let resolveConvert: (value?: void) => void = () => {};
    let progressCb:
      | ((data: { input: string; output: string; progress: ConversionProgress }) => void)
      | undefined;
    vi.mocked(window.electronAPI.onConversionProgress).mockImplementation((cb) => {
      progressCb = cb;
      return vi.fn();
    });
    convertFileMock.mockReturnValue(new Promise((resolve) => (resolveConvert = resolve)));
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.click(screen.getByText('videoCut.cut'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    act(() => {
      progressCb?.({
        input: '/in/video.mp4',
        output: '/out/cut.mp4',
        progress: { percent: 60, time: '00:00:02', speed: '1x', eta: '2', fps: 30, bitrate: '800k' },
      });
    });
    expect(screen.getByText('60.0%')).toBeInTheDocument();
    fireEvent.click(screen.getByText('videoCut.cancel'));
    fireEvent.click(screen.getByText('videoCut.yes'));
    await waitFor(() => expect(cancelConversionMock).toHaveBeenCalledOnce());
    await act(async () => {
      resolveConvert();
    });
    expect(screen.queryByText('60.0%')).not.toBeInTheDocument();
    expect(screen.queryByText('100.0%')).not.toBeInTheDocument();
  });

  it('shows pause and cancel buttons while cutting and supports pausing', async () => {
    const convert = deferred<undefined>();
    convertFileMock.mockReturnValue(convert.promise);
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.click(screen.getByText('videoCut.cut'));
    expect(screen.getByText('videoCut.cutting')).toBeInTheDocument();
    expect(screen.getByText('videoCut.pause')).toBeInTheDocument();
    expect(screen.getByText('videoCut.cancel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('videoCut.pause'));
    await waitFor(() => expect(pauseConversionMock).toHaveBeenCalledOnce());
    expect(screen.getByText('videoCut.resume')).toBeInTheDocument();
    fireEvent.click(screen.getByText('videoCut.resume'));
    await waitFor(() => expect(resumeConversionMock).toHaveBeenCalledOnce());
    await act(async () => {
      convert.resolve(undefined);
    });
  });

  it('confirms before cancelling and clears the form after cancel', async () => {
    const convert = deferred<undefined>();
    convertFileMock.mockReturnValue(convert.promise);
    const { container } = renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.click(screen.getByText('videoCut.cut'));
    fireEvent.click(screen.getByText('videoCut.cancel'));
    expect(screen.getByText('videoCut.cancelTitle')).toBeInTheDocument();
    expect(screen.getByText('videoCut.cancelMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByText('videoCut.yes'));
    await waitFor(() => expect(cancelConversionMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByPlaceholderText('videoCut.placeholderOutput')).toHaveValue(''));
    expect(screen.getByPlaceholderText('videoCut.placeholderStart')).toHaveValue('00:00:00');
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
    expect(screen.getByText('videoCut.dropLabel')).toBeInTheDocument();
    await act(async () => {
      convert.resolve(undefined);
    });
  });
});
