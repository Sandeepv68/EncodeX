import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AudioExtract from '../AudioExtract';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectOutputMock = vi.mocked(window.electronAPI.selectOutput);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);

function renderPage() {
  return render(<AudioExtract />);
}

describe('AudioExtract', () => {
  beforeEach(() => {
    selectFileMock.mockReset();
    selectOutputMock.mockReset();
    convertFileMock.mockReset();
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
    selectFileMock.mockResolvedValue('/in/video.mp4');
    fireEvent.click(screen.getByText('audioExtract.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    expect(screen.getByText('audioExtract.extract')).toBeEnabled();
  });

  it('picks an output file via the browse button', async () => {
    selectOutputMock.mockResolvedValue('/out/audio.mp3');
    renderPage();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText('audioExtract.placeholderOutput')).toHaveValue('/out/audio.mp3');
  });

  it('extracts audio when both input and output are provided', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(screen.getByText('audioExtract.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
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
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('shows an error when the conversion fails', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    convertFileMock.mockRejectedValue(new Error('encoder crashed'));
    renderPage();
    fireEvent.click(screen.getByText('audioExtract.dropLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio.mp3' } });
    fireEvent.click(screen.getByText('audioExtract.extract'));
    await waitFor(() => expect(useErrorStore.getState().currentError).not.toBeNull());
    expect(useErrorStore.getState().currentError?.detail).toBe('encoder crashed');
  });
});
