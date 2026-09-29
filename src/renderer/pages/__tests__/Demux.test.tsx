import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Demux from '../Demux';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';
import { useDemuxStore } from '../../stores/demuxStore';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectDirectoryMock = vi.mocked(window.electronAPI.selectDirectory);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const pauseConversionMock = vi.mocked(window.electronAPI.pauseConversion);
const resumeConversionMock = vi.mocked(window.electronAPI.resumeConversion);
const cancelConversionMock = vi.mocked(window.electronAPI.cancelConversion);
const revealFileMock = vi.mocked(window.electronAPI.revealFile);
const progressHandlers = vi.mocked(window.electronAPI.onConversionProgress).mock.calls.map((c) => c[0]);

function resetStore(): void {
  useDemuxStore.setState({
    input: '',
    streams: [],
    selectedIndices: [],
    outputDir: '',
    targets: [],
    warnings: [],
    media: {},
    isConverting: false,
    isPaused: false,
    progress: null,
    current: null,
  });
  useErrorStore.setState({ currentError: null, errorHistory: [] });
  useToastStore.setState({ toasts: [] });
}

function renderPage() {
  return render(<Demux />);
}

describe('Demux', () => {
  beforeEach(() => {
    resetStore();
    selectFileMock.mockReset();
    selectDirectoryMock.mockReset();
    convertFileMock.mockReset();
    getMediaInfoMock.mockReset();
    pauseConversionMock.mockReset();
    resumeConversionMock.mockReset();
    cancelConversionMock.mockReset();
    revealFileMock.mockReset();
  });

  it('renders the title and input picker when idle', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'demux.title' })).toBeInTheDocument();
    expect(screen.getByText('demux.videoFile')).toBeInTheDocument();
    expect(screen.getByText('demux.dropLabel')).toBeInTheDocument();
  });

  it('selects a video and lists streams grouped by kind with suggested outputs', async () => {
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [
        { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
        { index: 1, type: 'audio', codec: 'aac', channels: 2, language: 'eng' },
        { index: 2, type: 'subtitle', codec: 'subrip', language: 'eng' },
      ],
    });
    renderPage();
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledWith('/in/video.mkv', 'FFMPEG'));

    expect(useDemuxStore.getState().selectedIndices).toEqual([0, 1, 2]);
    expect(screen.getAllByTestId('demux-stream-row')).toHaveLength(3);
    expect(screen.getByTestId('demux-stream-group-video')).toBeInTheDocument();
    expect(screen.getByTestId('demux-stream-group-audio')).toBeInTheDocument();
    expect(screen.getByTestId('demux-stream-group-subtitle')).toBeInTheDocument();
    expect(useDemuxStore.getState().outputDir).toBe('/in');

    const targets = useDemuxStore.getState().targets;
    expect(targets.map((t) => t.output)).toEqual(['/in/video.video.mp4', '/in/video.audio_0.m4a', '/in/video.subtitle_0.srt']);
    expect(screen.getByTestId('demux-output-0')).toHaveTextContent('video.video.mp4');
    expect(screen.getByTestId('demux-output-1')).toHaveTextContent('video.audio_0.m4a');
  });

  it('keeps a stream selected state in sync when removing it', async () => {
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [
        { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
        { index: 1, type: 'audio', codec: 'aac', channels: 2 },
      ],
    });
    renderPage();
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(useDemuxStore.getState().selectedIndices).toEqual([0]);
    expect(useDemuxStore.getState().targets).toHaveLength(1);
  });

  it('switches video/audio/subtitle conversion targets and regenerates the plan', async () => {
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [
        { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
        { index: 1, type: 'audio', codec: 'aac', channels: 2 },
        { index: 2, type: 'subtitle', codec: 'subrip' },
      ],
    });
    renderPage();
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    let target = screen.getAllByRole('combobox')[0];
    fireEvent.mouseDown(target);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === '.mkv') as Element);
    await waitFor(() => expect(useDemuxStore.getState().media.videoContainer).toBe('mkv'));
    expect(useDemuxStore.getState().targets[0]).toMatchObject({ copy: false, codec: 'libx264', output: '/in/video.video.mkv' });

    target = screen.getAllByRole('combobox')[1];
    fireEvent.mouseDown(target);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'mp3') as Element);
    await waitFor(() => expect(useDemuxStore.getState().media.audioCodec).toBe('mp3'));
    expect(useDemuxStore.getState().targets[1]).toMatchObject({ copy: false, codec: 'mp3', output: '/in/video.audio_0.mp3' });

    const subtitle = screen.getAllByRole('combobox')[2];
    fireEvent.mouseDown(subtitle);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'ass') as Element);
    await waitFor(() => expect(useDemuxStore.getState().media.subtitleCodec).toBe('ass'));
    expect(useDemuxStore.getState().targets[2]).toMatchObject({ copy: false, codec: 'ass', output: '/in/video.subtitle_0.ass' });

    // Selecting copy for every kind falls back to lossless extraction.
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'demux.copyOption') as Element);
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'demux.copyOption') as Element);
    fireEvent.mouseDown(screen.getAllByRole('combobox')[2]);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'demux.copyOption') as Element);
    await waitFor(() => expect(useDemuxStore.getState().targets.every((t) => t.copy)).toBe(true));
  });

  it('sets the output directory via the browse button', async () => {
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 }],
    });
    selectDirectoryMock.mockResolvedValue('/out');
    renderPage();
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'convert.browse' }));
    await waitFor(() => expect(selectDirectoryMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(useDemuxStore.getState().outputDir).toBe('/out'));
    expect(useDemuxStore.getState().targets[0].output).toBe('/out/video.video.mp4');
  });

  it('demuxes every selected stream sequentially and shows the reveal action', async () => {
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [
        { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
        { index: 1, type: 'audio', codec: 'aac', channels: 2 },
      ],
    });
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('demux.start'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledTimes(2));
    const successToast = useToastStore
      .getState()
      .toasts.find((t) => t.type === 'success' && t.message === 'Streams extracted successfully');
    expect(successToast?.action?.label).toBe('Reveal in folder');
    expect(useDemuxStore.getState().isConverting).toBe(false);
  });

  it('powers the reveal action with the first extracted output', async () => {
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [
        { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
        { index: 1, type: 'audio', codec: 'aac', channels: 2 },
      ],
    });
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('demux.start'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledTimes(2));
    const toast = useToastStore.getState().toasts.find((t) => t.action);
    act(() => toast?.action?.onClick());
    await waitFor(() => expect(revealFileMock).toHaveBeenCalledWith('/in/video.video.mp4'));
  });

  it('shows per-stream progress label while demuxing', async () => {
    convertFileMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [
        { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
        { index: 1, type: 'audio', codec: 'aac', channels: 2 },
      ],
    });
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('demux.start'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledTimes(1));
    act(() => {
      for (const handler of progressHandlers) {
        handler?.({
          input: '/in/video.mkv',
          output: '/in/video.video.mp4',
          progress: { percent: 10, time: '00:00:01', fps: 24, speed: '1x', eta: '5', bitrate: '100k' },
        });
      }
    });
    await waitFor(() => expect(screen.getByTestId('demux-current')).toBeInTheDocument());
    expect(useDemuxStore.getState().current).toBe('video:0');
  });

  it('pauses and resumes the demux', async () => {
    convertFileMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 }],
    });
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('demux.start'));
    await waitFor(() => expect(screen.getByText('demux.pause')).toBeInTheDocument());
    fireEvent.click(screen.getByText('demux.pause'));
    await waitFor(() => expect(pauseConversionMock).toHaveBeenCalledOnce());
    expect(screen.getByText('demux.resume')).toBeInTheDocument();
    fireEvent.click(screen.getByText('demux.resume'));
    await waitFor(() => expect(resumeConversionMock).toHaveBeenCalledOnce());
    expect(screen.getByText('demux.pause')).toBeInTheDocument();
  });

  it('asks for confirmation and cancels the demux', async () => {
    convertFileMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 }],
    });
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText('demux.start'));
    await waitFor(() => expect(screen.getByText('demux.cancel')).toBeInTheDocument());
    fireEvent.click(screen.getByText('demux.cancel'));
    expect(screen.getByText('demux.cancelMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByText('demux.yes'));
    await waitFor(() => expect(cancelConversionMock).toHaveBeenCalledOnce());
    expect(useDemuxStore.getState().isConverting).toBe(false);
  });

  it('demuxes with Ctrl+Enter', async () => {
    convertFileMock.mockResolvedValue(undefined);
    renderPage();
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 }],
    });
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.keyDown(window, { code: 'Enter', key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledTimes(1));
  });

  it('shows a warning and keeps bitmap subtitles as .mks copy when srt is requested', async () => {
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [
        { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
        { index: 1, type: 'subtitle', codec: 'subrip' },
        { index: 2, type: 'subtitle', codec: 'hdmv_pgs_subtitle' },
      ],
    });
    renderPage();
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    expect(screen.queryByTestId('demux-warnings')).not.toBeInTheDocument();

    const subtitle = screen.getAllByRole('combobox')[2];
    fireEvent.mouseDown(subtitle);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'srt') as Element);
    await waitFor(() => expect(useDemuxStore.getState().media.subtitleCodec).toBe('srt'));

    const bitmap = useDemuxStore.getState().targets.find((t) => t.index === 2);
    expect(bitmap).toMatchObject({ copy: true, output: '/in/video.subtitle_1.mks' });
    expect(useDemuxStore.getState().warnings).toHaveLength(1);
    expect(screen.getByTestId('demux-warnings')).toBeInTheDocument();
    expect(screen.getAllByTestId('demux-warning')).toHaveLength(1);

    fireEvent.mouseDown(screen.getAllByRole('combobox')[2]);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'demux.copyOption') as Element);
    await waitFor(() => expect(useDemuxStore.getState().warnings).toEqual([]));
    expect(screen.queryByTestId('demux-warnings')).not.toBeInTheDocument();
  });

  it('preserves native text-subtitle extensions in the output names', async () => {
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [
        { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
        { index: 1, type: 'subtitle', codec: 'ass' },
        { index: 2, type: 'subtitle', codec: 'webvtt' },
      ],
    });
    renderPage();
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    const targets = useDemuxStore.getState().targets;
    expect(targets[1]).toMatchObject({ copy: true, output: '/in/video.subtitle_0.ass' });
    expect(targets[2]).toMatchObject({ copy: true, output: '/in/video.subtitle_1.vtt' });
    expect(screen.getByTestId('demux-output-1')).toHaveTextContent('video.subtitle_0.ass');
    expect(screen.getByTestId('demux-output-2')).toHaveTextContent('video.subtitle_1.vtt');
  });

  it('hides the filters section while the video target is Copy', async () => {
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 }],
    });
    renderPage();
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    expect(useDemuxStore.getState().targets[0].copy).toBe(true);
    expect(screen.queryByText('demux.filtersTitle')).not.toBeInTheDocument();
  });

  it('shows the filters section once the video target re-encodes', async () => {
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 }],
    });
    renderPage();
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    const target = screen.getAllByRole('combobox')[0];
    fireEvent.mouseDown(target);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === '.mkv') as Element);
    await waitFor(() => expect(useDemuxStore.getState().targets[0].copy).toBe(false));

    expect(screen.getByText('demux.filtersTitle')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Add preset filter...' })).toBeInTheDocument();
  });

  it('adds a filter preset and carries it onto the re-encoding video target', async () => {
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 }],
    });
    renderPage();
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    const target = screen.getAllByRole('combobox')[0];
    fireEvent.mouseDown(target);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === '.mkv') as Element);
    await waitFor(() => expect(useDemuxStore.getState().targets[0].copy).toBe(false));

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Add preset filter...' }));
    fireEvent.click(screen.getByRole('option', { name: 'Sharpen' }));
    fireEvent.click(screen.getByTestId('filters-add-preset'));

    await waitFor(() => expect(useDemuxStore.getState().targets[0].videoFilters).toEqual(['unsharp=5:5:0.5:5:5:0']));
    expect(screen.getByTestId('filters-preview')).toHaveTextContent('-vf unsharp=5:5:0.5:5:5:0');
  });

  it('warns that filters are ignored when the video target is Copy', async () => {
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 }],
    });
    renderPage();
    fireEvent.click(screen.getByText('demux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    // Re-encode the video so the section appears, add a filter, then switch back
    // to Copy: the chain cannot survive a lossless copy, so it is reported.
    const target = screen.getAllByRole('combobox')[0];
    fireEvent.mouseDown(target);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === '.mkv') as Element);
    await waitFor(() => expect(useDemuxStore.getState().targets[0].copy).toBe(false));

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Add preset filter...' }));
    fireEvent.click(screen.getByRole('option', { name: 'Sharpen' }));
    fireEvent.click(screen.getByTestId('filters-add-preset'));
    await waitFor(() => expect(useDemuxStore.getState().media.videoFilters).toEqual(['unsharp=5:5:0.5:5:5:0']));

    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'demux.copyOption') as Element);

    await waitFor(() => expect(useDemuxStore.getState().targets[0].copy).toBe(true));
    expect(screen.getByTestId('demux-warnings')).toHaveTextContent('demux.filtersIgnoredCopy');
    expect(screen.queryByText('demux.filtersTitle')).not.toBeInTheDocument();
  });
});
