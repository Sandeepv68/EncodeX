import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ImageCompress from '../ImageCompress';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectOutputMock = vi.mocked(window.electronAPI.selectOutput);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const getImagePreviewMock = vi.mocked(window.electronAPI.getImagePreview);
const getImageFileInfoMock = vi.mocked(window.electronAPI.getImageFileInfo);

function renderPage() {
  return render(<ImageCompress />);
}

describe('ImageCompress', () => {
  beforeEach(() => {
    selectFileMock.mockReset();
    selectOutputMock.mockReset();
    convertFileMock.mockReset();
    getImagePreviewMock.mockReset();
    getImageFileInfoMock.mockReset();
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
    expect(screen.getByText('imageCompress.keepAspectRatio')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.compress')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.dropLabel')).toBeInTheDocument();
  });

  it('shows a tooltip for each field', () => {
    renderPage();
    expect(screen.getAllByTestId('info-tooltip')).toHaveLength(6);
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

  it('lets the user pick a standard scale and compress', async () => {
    selectFileMock.mockResolvedValue('/in/photo.png');
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    expect(screen.getByText('imageCompress.noScale')).toBeInTheDocument();
    fireEvent.click(screen.getByText('1920x1080'));
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('imageCompress.placeholderOutput'), { target: { value: '/out/photo.jpg' } });
    fireEvent.click(screen.getByText('imageCompress.compress'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/photo.png',
      '/out/photo.jpg',
      { videoCodec: 'mjpeg', qscale: 23, scale: '1920x1080', pixelFormat: 'yuv420p', keepAspectRatio: true },
      'FFMPEG',
    );
  });

  it('passes keepAspectRatio: false when the toggle is switched off', async () => {
    selectFileMock.mockResolvedValue('/in/photo.png');
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('imageCompress.placeholderOutput'), { target: { value: '/out/photo.jpg' } });
    fireEvent.click(screen.getByText('imageCompress.compress'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/photo.png',
      '/out/photo.jpg',
      { videoCodec: 'mjpeg', qscale: 23, scale: undefined, pixelFormat: 'yuv420p', keepAspectRatio: false },
      'FFMPEG',
    );
  });

  it('shows the selected image after choosing one via the dropzone', async () => {
    selectFileMock.mockResolvedValue('/in/photo.png');
    renderPage();
    expect(screen.queryByTestId('selected-image')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    expect(screen.getByText('photo.png')).toBeInTheDocument();
  });

  it('shows an image preview with the file name when an image is selected', async () => {
    selectFileMock.mockResolvedValue('/in/photo.png');
    getImagePreviewMock.mockResolvedValue('data:image/png;base64,AQID');
    renderPage();
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(getImagePreviewMock).toHaveBeenCalledWith('/in/photo.png'));
    const preview = screen.getByTestId('image-preview');
    expect(preview).toBeInTheDocument();
    expect(preview.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,AQID');
    expect(preview.querySelector('img')).toHaveAttribute('alt', 'photo.png');
    expect(screen.getByText('photo.png')).toBeInTheDocument();
  });

  it('shows the resolution and file size next to the selected file name', async () => {
    selectFileMock.mockResolvedValue('/in/photo.png');
    getImageFileInfoMock.mockResolvedValue({ width: 3000, height: 2000, size: 2621440 });
    renderPage();
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(getImageFileInfoMock).toHaveBeenCalledWith('/in/photo.png'));
    expect(screen.getByTestId('image-file-info')).toHaveTextContent('3000 × 2000 · 2.5 MB');
  });

  it('shows only the file size when dimensions are unavailable', async () => {
    selectFileMock.mockResolvedValue('/in/photo.png');
    getImageFileInfoMock.mockResolvedValue({ width: null, height: null, size: 1024 });
    renderPage();
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(getImageFileInfoMock).toHaveBeenCalledWith('/in/photo.png'));
    expect(screen.getByTestId('image-file-info')).toHaveTextContent('1.0 KB');
  });

  it('hides the dropzone when an image is selected', async () => {
    selectFileMock.mockResolvedValue('/in/photo.png');
    renderPage();
    expect(screen.getByText('imageCompress.dropLabel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(screen.getByTestId('image-preview')).toBeInTheDocument());
    expect(screen.queryByText('imageCompress.dropLabel')).not.toBeInTheDocument();
  });

  it('removes the selection via the close button and restores the dropzone', async () => {
    selectFileMock.mockResolvedValue('/in/photo.png');
    getImagePreviewMock.mockResolvedValue('data:image/png;base64,AQID');
    renderPage();
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(screen.getByTestId('image-preview')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('remove-image'));
    expect(screen.queryByTestId('image-preview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('selected-image')).not.toBeInTheDocument();
    expect(screen.getByText('imageCompress.dropLabel')).toBeInTheDocument();
  });

  it('rewrites the typed output extension to match the selected format', async () => {
    renderPage();
    const outputField = screen.getByPlaceholderText('imageCompress.placeholderOutput');
    fireEvent.change(outputField, { target: { value: '/out/photo.jpg' } });
    expect(outputField).toHaveValue('/out/photo.jpg');
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('PNG'));
    expect(outputField).toHaveValue('/out/photo.png');
  });

  it('rewrites the browsed output extension to match the selected format', async () => {
    selectOutputMock.mockResolvedValue('/out/photo.jpg');
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('WebP'));
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText('imageCompress.placeholderOutput')).toHaveValue('/out/photo.webp');
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
      { videoCodec: 'mjpeg', qscale: 23, scale: undefined, pixelFormat: 'yuv420p', keepAspectRatio: true },
      'FFMPEG',
    );
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'toast.imageCompressed')).toBe(true);
    expect(screen.queryByText('100.0%')).not.toBeInTheDocument();
  });

  it('shows live progress while compressing and removes it when the job completes', async () => {
    let resolveConvert: (value?: unknown) => void = () => {};
    let progressCb:
      | ((data: { input: string; output: string; progress: { percent: number; time: string; speed: string; eta: string } }) => void)
      | undefined;
    vi.mocked(window.electronAPI.onConversionProgress).mockImplementation((cb) => {
      progressCb = cb;
      return vi.fn();
    });
    selectFileMock.mockResolvedValue('/in/photo.png');
    convertFileMock.mockReturnValue(new Promise((resolve) => (resolveConvert = resolve)));
    renderPage();
    fireEvent.click(screen.getByText('imageCompress.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('imageCompress.placeholderOutput'), { target: { value: '/out/photo.jpg' } });
    fireEvent.click(screen.getByText('imageCompress.compress'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(screen.getByText('imageCompress.compressing')).toBeInTheDocument();
    act(() => {
      progressCb?.({
        input: '/in/photo.png',
        output: '/out/photo.jpg',
        progress: { percent: 42, time: '00:00:01', speed: '1.5x', eta: '5' },
      });
    });
    expect(screen.getByText('42.0%')).toBeInTheDocument();
    await act(async () => {
      resolveConvert();
    });
    expect(screen.queryByText('42.0%')).not.toBeInTheDocument();
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
      { videoCodec: 'png', qscale: 23, scale: undefined, pixelFormat: 'yuv420p', keepAspectRatio: true },
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
