import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImageCompress from '../ImageCompress';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectOutputMock = vi.mocked(window.electronAPI.selectOutput);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);

function renderPage() {
  return render(<ImageCompress />);
}

describe('ImageCompress', () => {
  beforeEach(() => {
    selectFileMock.mockReset();
    selectOutputMock.mockReset();
    convertFileMock.mockReset();
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useToastStore.setState({ toasts: [] });
  });

  it('renders the title, fields, and compress button', () => {
    renderPage();
    expect(screen.getByText('imageCompress.title')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.inputImage')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.outputFormat')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.quality')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.scale')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.compress')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.dropLabel')).toBeInTheDocument();
  });

  it('shows a validation error when the output field is blurred empty', () => {
    renderPage();
    fireEvent.blur(screen.getByPlaceholderText('imageCompress.placeholderOutput'));
    expect(screen.getByText('validation.outputRequired')).toBeInTheDocument();
    expect(convertFileMock).not.toHaveBeenCalled();
  });

  it('shows a validation error for an out-of-range quality value', () => {
    renderPage();
    const quality = screen.getByRole('spinbutton');
    fireEvent.change(quality, { target: { value: '999' } });
    fireEvent.blur(quality);
    expect(screen.getByText('validation.qualityRange')).toBeInTheDocument();
  });

  it('shows a validation error for an invalid scale value', () => {
    renderPage();
    const scale = screen.getByPlaceholderText('imageCompress.placeholderScale');
    fireEvent.change(scale, { target: { value: 'not-a-scale' } });
    fireEvent.blur(scale);
    expect(screen.getByText('validation.invalidScale')).toBeInTheDocument();
  });

  it('shows the selected image after choosing one via the dropzone', async () => {
    selectFileMock.mockResolvedValue('/in/photo.png');
    renderPage();
    expect(screen.queryByTestId('selected-image')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    expect(screen.getByText('Selected image: photo.png')).toBeInTheDocument();
  });

  it('picks an output file via the browse button', async () => {
    selectOutputMock.mockResolvedValue('/out/photo.jpg');
    renderPage();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText('imageCompress.placeholderOutput')).toHaveValue('/out/photo.jpg');
  });

  it('compresses an image with the default JPEG format', async () => {
    selectFileMock.mockResolvedValue('/in/photo.png');
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('imageCompress.placeholderOutput'), { target: { value: '/out/photo.jpg' } });
    fireEvent.click(screen.getByText('imageCompress.compress'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/photo.png',
      '/out/photo.jpg',
      { videoCodec: 'mjpeg', qscale: 23, scale: undefined, pixelFormat: 'yuv420p' },
      'FFMPEG',
    );
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'toast.imageCompressed')).toBe(true);
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('uses the selected output format codec', async () => {
    selectFileMock.mockResolvedValue('/in/photo.jpg');
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('PNG'));
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('imageCompress.placeholderOutput'), { target: { value: '/out/photo.png' } });
    fireEvent.click(screen.getByText('imageCompress.compress'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/photo.jpg',
      '/out/photo.png',
      { videoCodec: 'png', qscale: 23, scale: undefined, pixelFormat: 'yuv420p' },
      'FFMPEG',
    );
  });

  it('shows an error when the conversion fails', async () => {
    selectFileMock.mockResolvedValue('/in/photo.png');
    convertFileMock.mockRejectedValue(new Error('compression failed'));
    renderPage();
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('imageCompress.placeholderOutput'), { target: { value: '/out/photo.jpg' } });
    fireEvent.click(screen.getByText('imageCompress.compress'));
    await waitFor(() => expect(useErrorStore.getState().currentError).not.toBeNull());
    expect(useErrorStore.getState().currentError?.detail).toBe('compression failed');
  });
});
