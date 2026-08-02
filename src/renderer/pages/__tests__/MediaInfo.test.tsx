import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MediaInfo from '../MediaInfo';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';
import type { MediaInfo as MediaInfoType } from '../../../shared/types';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);

const SAMPLE_INFO: MediaInfoType = {
  file: '/media/video.mkv',
  format: 'matroska',
  size: 1048576,
  duration: 65,
  bitrate: '1024k',
  streams: [
    { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080, pixelFormat: 'yuv420p', frameRate: '30', bitrate: '900k' },
    { index: 1, type: 'audio', codec: 'aac', sampleRate: 48000, channels: 2, bitrate: '128k' },
  ],
};

function renderPage() {
  return render(<MediaInfo />);
}

describe('MediaInfo', () => {
  beforeEach(() => {
    selectFileMock.mockReset();
    getMediaInfoMock.mockReset();
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useToastStore.setState({ toasts: [] });
  });

  it('renders the page title', () => {
    renderPage();
    expect(screen.getByText('mediaInfo.title')).toBeInTheDocument();
  });

  it('loads and displays media info when a file is selected', async () => {
    selectFileMock.mockResolvedValue('/media/video.mkv');
    getMediaInfoMock.mockResolvedValue(SAMPLE_INFO);
    renderPage();
    fireEvent.click(screen.getByText('mediaInfo.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledWith('/media/video.mkv', 'FFMPEG'));
    expect(await screen.findByText('/media/video.mkv')).toBeInTheDocument();
    expect(screen.getByText('matroska')).toBeInTheDocument();
    expect(screen.getByText('mediaInfo.streams')).toBeInTheDocument();
    expect(screen.getByTestId('stream-count-chip')).toHaveTextContent('2');
    expect(screen.getByText('VIDEO')).toBeInTheDocument();
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'toast.mediaInfoLoaded')).toBe(true);
  });

  it('does nothing when the file dialog is cancelled', async () => {
    selectFileMock.mockResolvedValue(null);
    renderPage();
    fireEvent.click(screen.getByText('mediaInfo.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalled());
    expect(getMediaInfoMock).not.toHaveBeenCalled();
  });

  it('shows an error banner when media info fails to load', async () => {
    selectFileMock.mockResolvedValue('/media/video.mkv');
    getMediaInfoMock.mockRejectedValue(new Error('probe failed'));
    renderPage();
    fireEvent.click(screen.getByText('mediaInfo.dropLabel'));
    await waitFor(() => expect(useErrorStore.getState().currentError).not.toBeNull());
    expect(useErrorStore.getState().currentError?.detail).toBe('probe failed');
  });

  it('clears the error banner via the close button', async () => {
    selectFileMock.mockResolvedValue('/media/video.mkv');
    getMediaInfoMock.mockRejectedValue(new Error('probe failed'));
    const { container } = renderPage();
    fireEvent.click(screen.getByText('mediaInfo.dropLabel'));
    await waitFor(() => expect(useErrorStore.getState().currentError).not.toBeNull());
    fireEvent.click(container.querySelector('[data-icon="xmark"]')!);
    expect(useErrorStore.getState().currentError).toBeNull();
  });
});
