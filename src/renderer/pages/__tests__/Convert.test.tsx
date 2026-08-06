import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Convert from '../Convert';
import { useConversionStore } from '../../stores/conversionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectOutputMock = vi.mocked(window.electronAPI.selectOutput);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const pauseConversionMock = vi.mocked(window.electronAPI.pauseConversion);
const resumeConversionMock = vi.mocked(window.electronAPI.resumeConversion);
const cancelConversionMock = vi.mocked(window.electronAPI.cancelConversion);

function renderPage() {
  return render(<Convert />);
}

function toggleCopy(container: HTMLElement) {
  fireEvent.click(container.querySelector('input[type="checkbox"]')!);
}

describe('Convert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConversionStore.setState({
      inputFile: null,
      outputFile: null,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '2000k',
      audioBitrate: '192k',
      qscale: 23,
      scale: '1920x1080',
      pixelFormat: 'yuv420p',
      copyMode: false,
      transcoder: 'FFMPEG',
      encoderType: 'auto',
      isConverting: false,
      isPaused: false,
      isDirty: false,
      progress: null,
    });
    useSettingsStore.setState({ hardwareAcceleration: true, hwaccelMode: 'auto', encoderType: 'auto' });
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useToastStore.setState({ toasts: [] });
  });

  it('renders the title, fields, and start button', () => {
    renderPage();
    expect(screen.getByText('convert.title')).toBeInTheDocument();
    expect(screen.getByText('convert.inputFile')).toBeInTheDocument();
    expect(screen.getByText('convert.outputFile')).toBeInTheDocument();
    expect(screen.getByText('convert.videoCodec')).toBeInTheDocument();
    expect(screen.getByText('convert.audioCodec')).toBeInTheDocument();
    expect(screen.getByText('convert.qscale')).toBeInTheDocument();
    expect(screen.getByText('convert.scale')).toBeInTheDocument();
    expect(screen.getByText('convert.pixelFormat')).toBeInTheDocument();
    expect(screen.getByText('convert.transcoderCore')).toBeInTheDocument();
    expect(screen.getByText('convert.startConversion')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(23);
  });

  it('selects an input file and renders the media player', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    renderPage();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText('convert.noFile')).toHaveValue('/in/video.mp4');
    expect(useConversionStore.getState().isDirty).toBe(true);
  });

  it('toggles the preview panel with the close and show buttons', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    renderPage();
    expect(screen.queryByText('convert.preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    expect(screen.getByText('convert.preview')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('convert.closePreview'));
    expect(screen.queryByText('convert.preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('convert.showPreview'));
    expect(screen.getByText('convert.preview')).toBeInTheDocument();
  });

  it('selects an output file via save as', async () => {
    selectOutputMock.mockResolvedValue('/out/video.mkv');
    renderPage();
    fireEvent.click(screen.getByText('convert.saveAs'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText('convert.noOutput')).toHaveValue('/out/video.mkv');
  });

  it('starts a conversion with the selected codecs and bitrates', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    selectOutputMock.mockResolvedValue('/out/video.mkv');
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.saveAs'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.startConversion'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/video.mp4',
      '/out/video.mkv',
      {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        videoBitrate: '2000k',
        audioBitrate: '192k',
        qscale: 23,
        scale: '1920x1080',
        pixelFormat: 'yuv420p',
        copy: false,
        hardwareAcceleration: true,
        hwaccelMode: 'auto',
      },
      'FFMPEG',
    );
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'Conversion complete')).toBe(true);
    expect(screen.queryByText('100.0%')).not.toBeInTheDocument();
  });

  it('hides the codec fields and passes copy mode when lossless copy is enabled', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    selectOutputMock.mockResolvedValue('/out/video.mkv');
    convertFileMock.mockResolvedValue(undefined);
    const { container } = renderPage();
    expect(screen.getByText('convert.videoCodec')).toBeInTheDocument();
    toggleCopy(container);
    expect(screen.queryByText('convert.videoCodec')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.saveAs'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.startConversion'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/video.mp4',
      '/out/video.mkv',
      {
        videoCodec: undefined,
        audioCodec: undefined,
        videoBitrate: '2000k',
        audioBitrate: '192k',
        qscale: 23,
        scale: '1920x1080',
        pixelFormat: 'yuv420p',
        copy: true,
        hardwareAcceleration: true,
        hwaccelMode: 'auto',
      },
      'FFMPEG',
    );
  });

  it('shows a qscale validation error and refuses to start', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    selectOutputMock.mockResolvedValue('/out/video.mkv');
    renderPage();
    const qscale = screen.getByRole('spinbutton');
    fireEvent.change(qscale, { target: { value: '999' } });
    fireEvent.blur(qscale);
    expect(screen.getByText('validation.qscaleRange')).toBeInTheDocument();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.saveAs'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.startConversion'));
    expect(convertFileMock).not.toHaveBeenCalled();
  });

  it('pauses, resumes, and cancels an in-flight conversion', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    selectOutputMock.mockResolvedValue('/out/video.mkv');
    convertFileMock.mockReturnValue(new Promise(() => {}));
    pauseConversionMock.mockResolvedValue(undefined);
    resumeConversionMock.mockResolvedValue(undefined);
    cancelConversionMock.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.saveAs'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.startConversion'));
    await waitFor(() => expect(screen.getByText('convert.pause')).toBeInTheDocument());
    fireEvent.click(screen.getByText('convert.pause'));
    await waitFor(() => expect(screen.getByText('convert.resume')).toBeInTheDocument());
    expect(pauseConversionMock).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('convert.resume'));
    await waitFor(() => expect(screen.getByText('convert.pause')).toBeInTheDocument());
    expect(resumeConversionMock).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('convert.cancel'));
    expect(screen.getByText('convert.cancelTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByText('convert.yes'));
    await waitFor(() => expect(cancelConversionMock).toHaveBeenCalledOnce());
    expect(useConversionStore.getState().isConverting).toBe(false);
  }, 20000);

  it('resets the form when the job cancel confirmation is accepted', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    selectOutputMock.mockResolvedValue('/out/video.mkv');
    renderPage();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.saveAs'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.cancelJob'));
    expect(screen.getByText('convert.jobCancelTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByText('convert.yes'));
    expect(useConversionStore.getState().inputFile).toBeNull();
    expect(useConversionStore.getState().isDirty).toBe(false);
  });

  it('shows an error when the conversion fails', async () => {
    selectFileMock.mockResolvedValue('/in/video.mp4');
    selectOutputMock.mockResolvedValue('/out/video.mkv');
    convertFileMock.mockRejectedValue(new Error('encode failed'));
    renderPage();
    fireEvent.click(screen.getByText('convert.browse'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.saveAs'));
    await waitFor(() => expect(selectOutputMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('convert.startConversion'));
    await waitFor(() => expect(useErrorStore.getState().currentError).not.toBeNull());
    expect(useErrorStore.getState().currentError?.detail).toBe('encode failed');
  });

  it('shows the encoder type dropdown when hardware acceleration is enabled', () => {
    renderPage();
    expect(screen.getByText('settings.encoderType')).toBeInTheDocument();
  });

  it('hides the encoder type dropdown when hardware acceleration is disabled', () => {
    useSettingsStore.setState({ hardwareAcceleration: false });
    renderPage();
    expect(screen.queryByText('settings.encoderType')).not.toBeInTheDocument();
  });

  it('applies the global encoder type to the video codec list', async () => {
    useSettingsStore.setState({ encoderType: 'software' });
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    expect(await screen.findByRole('option', { name: 'H.264 (libx264)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'H.264 (NVENC)' })).not.toBeInTheDocument();
  });

  it('lets the per-conversion encoder type override the global default', async () => {
    useSettingsStore.setState({ encoderType: 'software' });
    useConversionStore.setState({ encoderType: 'hardware' });
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    expect(await screen.findByRole('option', { name: 'H.264 (NVENC)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'H.264 (libx264)' })).not.toBeInTheDocument();
  });

  it('does not filter the codec list when hardware acceleration is disabled', async () => {
    useSettingsStore.setState({ hardwareAcceleration: false, encoderType: 'software' });
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    expect(await screen.findByRole('option', { name: 'H.264 (libx264)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'H.264 (NVENC)' })).toBeInTheDocument();
  });

  it('selecting an encoder type updates the per-conversion override', () => {
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'settings.encoderTypeHardware' }));
    expect(useConversionStore.getState().encoderType).toBe('hardware');
  });

  it('shows an info tooltip explaining the encoder type dropdown', async () => {
    renderPage();
    fireEvent.mouseEnter(screen.getAllByTestId('info-tooltip')[3]);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('convert.encoderTypeHint');
  });

  it('shows an info tooltip explaining every form field', async () => {
    renderPage();
    const triggers = screen.getAllByTestId('info-tooltip');
    const expected = new Set([
      'convert.inputFileHint',
      'convert.outputFileHint',
      'convert.losslessCopyHint',
      'convert.encoderTypeHint',
      'convert.videoCodecHint',
      'convert.audioCodecHint',
      'convert.videoBitrateHint',
      'convert.audioBitrateHint',
      'convert.qscaleHint',
      'convert.scaleHint',
      'convert.pixelFormatHint',
      'convert.transcoderCoreHint',
    ]);
    const seen = new Set<string>();
    for (let i = 0; i < triggers.length; i += 1) {
      fireEvent.mouseEnter(triggers[i]);
      const tooltip = await screen.findByRole('tooltip');
      seen.add(tooltip.textContent as string);
      fireEvent.mouseLeave(triggers[i]);
      await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    }
    expect(seen).toEqual(expected);
  }, 20000);

  it('does not show the encoder type info tooltip when hardware acceleration is disabled', () => {
    useSettingsStore.setState({ hardwareAcceleration: false });
    renderPage();
    expect(screen.getAllByTestId('info-tooltip')).toHaveLength(11);
  });

  it('shows a hardware acceleration alert above the encoder type field', () => {
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('convert.hardwareAccelAlert');
  });

  it('does not show the hardware acceleration alert when hardware acceleration is disabled', () => {
    useSettingsStore.setState({ hardwareAcceleration: false });
    renderPage();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show the hardware acceleration alert in lossless copy mode', () => {
    useConversionStore.setState({ copyMode: true });
    renderPage();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
