import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AudioExtract from '../AudioExtract';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectOutputMock = vi.mocked(window.electronAPI.selectOutput);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const getVideoPreviewMock = vi.mocked(window.electronAPI.getVideoPreview);
const pauseConversionMock = vi.mocked(window.electronAPI.pauseConversion);
const resumeConversionMock = vi.mocked(window.electronAPI.resumeConversion);
const cancelConversionMock = vi.mocked(window.electronAPI.cancelConversion);

function renderPage() {
  return render(<AudioExtract />);
}

async function selectVideo() {
  selectFileMock.mockResolvedValue('/in/video.mp4');
  getVideoPreviewMock.mockResolvedValue('data:image/png;base64,AQID');
  fireEvent.click(screen.getByText('audioExtract.dropLabel'));
  await waitFor(() => expect(screen.getByTestId('video-preview')).toBeInTheDocument());
}

describe('AudioExtract', () => {
  beforeEach(() => {
    selectFileMock.mockReset();
    selectOutputMock.mockReset();
    convertFileMock.mockReset();
    getVideoPreviewMock.mockReset();
    pauseConversionMock.mockReset();
    resumeConversionMock.mockReset();
    cancelConversionMock.mockReset();
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useToastStore.setState({ toasts: [] });
  });

  it('renders the title, fields, and extract button', () => {
    renderPage();
    expect(screen.getByText('audioExtract.title')).toBeInTheDocument();
    expect(screen.getByText('audioExtract.videoFile')).toBeInTheDocument();
    expect(screen.getByText('audioExtract.audioCodec')).toBeInTheDocument();
    expect(screen.getByText('audioExtract.bitrate')).toBeInTheDocument();
    expect(screen.getByText('audioExtract.extract')).toBeInTheDocument();
    expect(screen.getByText('audioExtract.dropLabel')).toBeInTheDocument();
  });

  it('shows a validation error when the output field is blurred empty', () => {
    renderPage();
    fireEvent.blur(screen.getByPlaceholderText('audioExtract.placeholderOutput'));
    expect(screen.getByText('validation.outputRequired')).toBeInTheDocument();
    expect(convertFileMock).not.toHaveBeenCalled();
  });

  it('keeps the extract button disabled until an input and output are provided', async () => {
    renderPage();
    const button = screen.getByText('audioExtract.extract');
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio.mp3' } });
    expect(screen.getByText('audioExtract.extract')).toBeDisabled();
    await selectVideo();
    expect(screen.getByText('audioExtract.extract')).toBeEnabled();
  });

  it('shows a video preview with the file name and hides the dropzone once selected', async () => {
    renderPage();
    await selectVideo();
    expect(screen.queryByText('audioExtract.dropLabel')).not.toBeInTheDocument();
    expect(screen.getByText(/video\.mp4/)).toBeInTheDocument();
    expect(screen.getByTestId('selected-video')).toHaveTextContent('video.mp4');
    expect(getVideoPreviewMock).toHaveBeenCalledWith('/in/video.mp4');
  });

  it('restores the dropzone when the preview is removed', async () => {
    renderPage();
    await selectVideo();
    fireEvent.click(screen.getByTestId('remove-video'));
    expect(screen.queryByTestId('video-preview')).not.toBeInTheDocument();
    expect(screen.getByText('audioExtract.dropLabel')).toBeInTheDocument();
  });

  it('rewrites the output extension to match the selected audio codec', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio.mp3' } });
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('FLAC (lossless)'));
    expect(screen.getByPlaceholderText('audioExtract.placeholderOutput')).toHaveValue('/out/audio.flac');
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('Opus (libopus)'));
    expect(screen.getByPlaceholderText('audioExtract.placeholderOutput')).toHaveValue('/out/audio.opus');
  });

  it('picks an output file via the browse button', async () => {
    selectOutputMock.mockResolvedValue('/out/audio.mp3');
    renderPage();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText('audioExtract.placeholderOutput')).toHaveValue('/out/audio.mp3');
  });

  it('extracts audio when both input and output are provided and hides the progress bar on completion', async () => {
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio.mp3' } });
    fireEvent.click(screen.getByText('audioExtract.extract'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/video.mp4',
      '/out/audio.mp3',
      { audioCodec: 'libmp3lame', audioBitrate: '192k' },
      'FFMPEG',
    );
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'toast.audioExtracted')).toBe(true);
    await waitFor(() => expect(screen.queryByText('100.0%')).not.toBeInTheDocument());
  });

  it('shows live progress while extracting and removes it when the job completes', async () => {
    let resolveConvert: (value?: unknown) => void = () => {};
    let progressCb:
      | ((data: { input: string; output: string; progress: { percent: number; time: string; speed: string; eta: string } }) => void)
      | undefined;
    vi.mocked(window.electronAPI.onConversionProgress).mockImplementation((cb) => {
      progressCb = cb;
      return vi.fn();
    });
    convertFileMock.mockReturnValue(new Promise((resolve) => (resolveConvert = resolve)));
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio.mp3' } });
    fireEvent.click(screen.getByText('audioExtract.extract'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(screen.getByText('audioExtract.extracting')).toBeInTheDocument();
    act(() => {
      progressCb?.({
        input: '/in/video.mp4',
        output: '/out/audio.mp3',
        progress: { percent: 42, time: '00:00:01', speed: '1.5x', eta: '5' },
      });
    });
    expect(screen.getByText('42.0%')).toBeInTheDocument();
    await act(async () => {
      resolveConvert();
    });
    expect(screen.queryByText('42.0%')).not.toBeInTheDocument();
  });

  it('pauses and resumes the extraction', async () => {
    convertFileMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio.mp3' } });
    fireEvent.click(screen.getByText('audioExtract.extract'));
    await waitFor(() => expect(screen.getByText('audioExtract.pause')).toBeInTheDocument());
    fireEvent.click(screen.getByText('audioExtract.pause'));
    await waitFor(() => expect(pauseConversionMock).toHaveBeenCalledOnce());
    expect(screen.getByText('audioExtract.resume')).toBeInTheDocument();
    fireEvent.click(screen.getByText('audioExtract.resume'));
    await waitFor(() => expect(resumeConversionMock).toHaveBeenCalledOnce());
    expect(screen.getByText('audioExtract.pause')).toBeInTheDocument();
  });

  it('asks for confirmation and cancels the extraction', async () => {
    convertFileMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio.mp3' } });
    fireEvent.click(screen.getByText('audioExtract.extract'));
    await waitFor(() => expect(screen.getByText('audioExtract.cancel')).toBeInTheDocument());
    fireEvent.click(screen.getByText('audioExtract.cancel'));
    expect(screen.getByText('audioExtract.cancelMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByText('audioExtract.yes'));
    await waitFor(() => expect(cancelConversionMock).toHaveBeenCalledOnce());
  });

  it('does not cancel when the confirmation is dismissed', async () => {
    convertFileMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio.mp3' } });
    fireEvent.click(screen.getByText('audioExtract.extract'));
    await waitFor(() => expect(screen.getByText('audioExtract.cancel')).toBeInTheDocument());
    fireEvent.click(screen.getByText('audioExtract.cancel'));
    fireEvent.click(screen.getByText('audioExtract.no'));
    expect(cancelConversionMock).not.toHaveBeenCalled();
    expect(screen.getByText('audioExtract.extracting')).toBeInTheDocument();
  });

  it('shows an error when the conversion fails', async () => {
    convertFileMock.mockRejectedValue(new Error('encoder crashed'));
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio.mp3' } });
    fireEvent.click(screen.getByText('audioExtract.extract'));
    await waitFor(() => expect(useErrorStore.getState().currentError).not.toBeNull());
    expect(useErrorStore.getState().currentError?.detail).toBe('encoder crashed');
  });
});
