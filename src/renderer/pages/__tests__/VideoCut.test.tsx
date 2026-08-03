import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import VideoCut from '../VideoCut';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';
import type { MediaInfo } from '../../../shared/types';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectOutputMock = vi.mocked(window.electronAPI.selectOutput);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const playerOpenMock = vi.mocked(window.electronAPI.playerOpen);
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
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);
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
    const { container } = renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);
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

  it('shows an error when the cut fails', async () => {
    convertFileMock.mockRejectedValue(new Error('cut failed'));
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.click(screen.getByText('videoCut.cut'));
    await waitFor(() => expect(useErrorStore.getState().currentError).not.toBeNull());
    expect(useErrorStore.getState().currentError?.detail).toBe('cut failed');
  });

  it('updates the start time field when the start marker is dragged', async () => {
    getMediaInfoMock.mockResolvedValue(mediaInfo(60));
    renderPage();
    await selectVideo();
    const endMarker = await screen.findByLabelText('cut end marker');
    await waitFor(() => expect((endMarker as HTMLInputElement).value).toBe('60'));
    fireEvent.keyDown(screen.getByLabelText('cut start marker'), { key: 'ArrowRight' });
    expect(screen.getByPlaceholderText('videoCut.placeholderStart')).toHaveValue('00:00:01');
  });

  it('updates the end time field when the end marker is dragged', async () => {
    getMediaInfoMock.mockResolvedValue(mediaInfo(60));
    renderPage();
    await selectVideo();
    const endMarker = await screen.findByLabelText('cut end marker');
    await waitFor(() => expect((endMarker as HTMLInputElement).value).toBe('60'));
    fireEvent.keyDown(endMarker, { key: 'ArrowLeft' });
    expect(screen.getByPlaceholderText('videoCut.placeholderEnd')).toHaveValue('00:00:59');
  });

  it('does not populate the end time field when only the start marker is moved', async () => {
    getMediaInfoMock.mockResolvedValue(mediaInfo(60));
    renderPage();
    await selectVideo();
    const endMarker = await screen.findByLabelText('cut end marker');
    await waitFor(() => expect((endMarker as HTMLInputElement).value).toBe('60'));
    fireEvent.keyDown(screen.getByLabelText('cut start marker'), { key: 'ArrowRight' });
    expect(screen.getByPlaceholderText('videoCut.placeholderStart')).toHaveValue('00:00:01');
    expect(screen.getByPlaceholderText('videoCut.placeholderEnd')).toHaveValue('');
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
