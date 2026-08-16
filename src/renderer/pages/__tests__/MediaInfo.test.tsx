import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MediaInfo from '../MediaInfo';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';
import type { MediaInfo as MediaInfoType } from '../../../shared/types';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const getImageInfoMock = vi.mocked(window.electronAPI.getImageInfo);

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
    getImageInfoMock.mockReset();
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

  it('loads EXIF data and renders the ExifSection for image files', async () => {
    selectFileMock.mockResolvedValue('/media/photo.jpg');
    getMediaInfoMock.mockResolvedValue({
      ...SAMPLE_INFO,
      file: '/media/photo.jpg',
      format: 'jpeg',
      duration: 0,
      bitrate: '',
      streams: [],
    });
    getImageInfoMock.mockResolvedValue({
      file: '/media/photo.jpg',
      exif: { Make: 'Canon' },
      histogram: {
        r: new Array(256).fill(0),
        g: new Array(256).fill(0),
        b: new Array(256).fill(0),
        luma: new Array(256).fill(0),
      },
    });
    renderPage();
    fireEvent.click(screen.getByText('mediaInfo.dropLabel'));
    await waitFor(() => expect(getImageInfoMock).toHaveBeenCalledWith('/media/photo.jpg'));
    expect(await screen.findByText('EXIF Data')).toBeInTheDocument();
    expect(screen.getByText('Make')).toBeInTheDocument();
    expect(screen.getByTestId('histogram-r')).toBeInTheDocument();
  });

  it('does not request image info for non-image files', async () => {
    selectFileMock.mockResolvedValue('/media/video.mkv');
    getMediaInfoMock.mockResolvedValue(SAMPLE_INFO);
    renderPage();
    fireEvent.click(screen.getByText('mediaInfo.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledWith('/media/video.mkv', 'FFMPEG'));
    expect(getImageInfoMock).not.toHaveBeenCalled();
  });

  it('records an error in the error store when media info fails to load', async () => {
    selectFileMock.mockResolvedValue('/media/video.mkv');
    getMediaInfoMock.mockRejectedValue(new Error('probe failed'));
    renderPage();
    fireEvent.click(screen.getByText('mediaInfo.dropLabel'));
    await waitFor(() => expect(useErrorStore.getState().currentError).not.toBeNull());
    expect(useErrorStore.getState().currentError?.detail).toBe('probe failed');
  });

  it('opens the file picker with Ctrl+O', async () => {
    selectFileMock.mockResolvedValue('/media/video.mkv');
    getMediaInfoMock.mockResolvedValue(SAMPLE_INFO);
    renderPage();
    fireEvent.keyDown(window, { code: 'KeyO', key: 'o', ctrlKey: true });
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledWith('/media/video.mkv', 'FFMPEG'));
    expect(await screen.findByText('/media/video.mkv')).toBeInTheDocument();
  });

  it('does nothing on Ctrl+O when the file dialog is cancelled', async () => {
    selectFileMock.mockResolvedValue(null);
    renderPage();
    fireEvent.keyDown(window, { code: 'KeyO', key: 'o', ctrlKey: true });
    await waitFor(() => expect(selectFileMock).toHaveBeenCalled());
    expect(getMediaInfoMock).not.toHaveBeenCalled();
  });
});
