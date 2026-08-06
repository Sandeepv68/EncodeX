import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AudioExtract from '../AudioExtract';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';
import { useAudioExtractStore } from '../../stores/audioExtractStore';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectOutputMock = vi.mocked(window.electronAPI.selectOutput);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const getVideoPreviewMock = vi.mocked(window.electronAPI.getVideoPreview);
const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const pauseConversionMock = vi.mocked(window.electronAPI.pauseConversion);
const resumeConversionMock = vi.mocked(window.electronAPI.resumeConversion);
const cancelConversionMock = vi.mocked(window.electronAPI.cancelConversion);
const storeProgressHandler = vi.mocked(window.electronAPI.onConversionProgress).mock.calls[0]?.[0];

function resetStore(): void {
  useAudioExtractStore.setState({
    input: '',
    preview: null,
    audioStreams: [],
    output: '',
    audioCodec: 'libmp3lame',
    audioBitrate: '192k',
    isConverting: false,
    isPaused: false,
    progress: null,
  });
}

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
    resetStore();
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

  it('renders an info tooltip for each field', () => {
    renderPage();
    expect(screen.getAllByTestId('info-tooltip')).toHaveLength(4);
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

  it('displays the audio stream details alongside the file name', async () => {
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mp4',
      format: 'mp4',
      size: 1000,
      duration: 60,
      bitrate: '1000 kb/s',
      streams: [
        { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
        {
          index: 1,
          type: 'audio',
          codec: 'aac',
          profile: 'LC',
          channels: 2,
          sampleRate: 48000,
          channelLayout: 'stereo',
          bitrate: '128 kb/s',
          language: 'eng',
        },
      ],
    });
    renderPage();
    await selectVideo();
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledWith('/in/video.mp4', 'FFMPEG'));
    const info = screen.getByTestId('audio-stream-info');
    expect(info).toHaveTextContent('aac');
    expect(info).toHaveTextContent('(LC)');
    expect(info).toHaveTextContent('2 ch');
    expect(info).toHaveTextContent('48000 Hz');
    expect(info).toHaveTextContent('128 kb/s');
    expect(screen.getByTestId('selected-video')).toHaveTextContent('video.mp4');
  });

  it('restores the dropzone when the preview is removed', async () => {
    renderPage();
    await selectVideo();
    fireEvent.click(screen.getByTestId('remove-video'));
    expect(screen.queryByTestId('video-preview')).not.toBeInTheDocument();
    expect(screen.getByText('audioExtract.dropLabel')).toBeInTheDocument();
  });

  it('defaults the output extension to the default mp3 codec when typing', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio' } });
    expect(screen.getByPlaceholderText('audioExtract.placeholderOutput')).toHaveValue('/out/audio.mp3');
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio.wav' } });
    expect(screen.getByPlaceholderText('audioExtract.placeholderOutput')).toHaveValue('/out/audio.mp3');
  });

  it('rewrites a browsed output file to match the default codec extension', async () => {
    selectOutputMock.mockResolvedValue('/out/audio.wav');
    renderPage();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText('audioExtract.placeholderOutput')).toHaveValue('/out/audio.mp3');
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
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'Audio extracted successfully')).toBe(true);
    await waitFor(() => expect(useAudioExtractStore.getState().progress).toBeNull());
    expect(screen.queryByText('100.0%')).not.toBeInTheDocument();
  });

  it('shows live progress while extracting and removes it when the job completes', async () => {
    let resolveConvert: (value?: void) => void = () => {};
    convertFileMock.mockReturnValue(new Promise((resolve) => (resolveConvert = resolve)));
    renderPage();
    await selectVideo();
    fireEvent.change(screen.getByPlaceholderText('audioExtract.placeholderOutput'), { target: { value: '/out/audio.mp3' } });
    fireEvent.click(screen.getByText('audioExtract.extract'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(screen.getByText('audioExtract.extracting')).toBeInTheDocument();
    act(() => {
      storeProgressHandler?.({
        input: '/in/video.mp4',
        output: '/out/audio.mp3',
        progress: { percent: 42, time: '00:00:01', fps: 24, speed: '1.5x', eta: '5', bitrate: '100k' },
      });
    });
    expect(screen.getByText('42.0%')).toBeInTheDocument();
    await act(async () => {
      resolveConvert();
    });
    expect(useAudioExtractStore.getState().progress).toBeNull();
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
    expect(useAudioExtractStore.getState().isConverting).toBe(false);
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
