import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VideoCut from '../VideoCut';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectOutputMock = vi.mocked(window.electronAPI.selectOutput);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);

function renderPage() {
  return render(<VideoCut />);
}

describe('VideoCut', () => {
  beforeEach(() => {
    selectFileMock.mockReset();
    selectOutputMock.mockReset();
    convertFileMock.mockReset();
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useToastStore.setState({ toasts: [] });
  });

  it('renders the title, time fields, and cut button', () => {
    renderPage();
    expect(screen.getByText('videoCut.title')).toBeInTheDocument();
    expect(screen.getByText('videoCut.videoFile')).toBeInTheDocument();
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

  it('requires a duration when duration mode is enabled', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    const { container } = renderPage();
    fireEvent.click(screen.getByText('videoCut.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);
    fireEvent.click(screen.getByText('videoCut.cut'));
    expect(screen.getByText('validation.durationRequired')).toBeInTheDocument();
    expect(convertFileMock).not.toHaveBeenCalled();
  });

  it('cuts with an end time when duration mode is off', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(screen.getByText('videoCut.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
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
    selectFileMock.mockResolvedValue('/in/video.mp4');
    convertFileMock.mockResolvedValue(undefined);
    const { container } = renderPage();
    fireEvent.click(screen.getByText('videoCut.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
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
    selectFileMock.mockResolvedValue('/in/video.mp4');
    convertFileMock.mockRejectedValue(new Error('cut failed'));
    renderPage();
    fireEvent.click(screen.getByText('videoCut.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('videoCut.placeholderOutput'), { target: { value: '/out/cut.mp4' } });
    fireEvent.click(screen.getByText('videoCut.cut'));
    await waitFor(() => expect(useErrorStore.getState().currentError).not.toBeNull());
    expect(useErrorStore.getState().currentError?.detail).toBe('cut failed');
  });
});
