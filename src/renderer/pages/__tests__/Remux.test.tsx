import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import Remux from '../Remux';
import { useErrorStore } from '../../stores/errorStore';
import { useToastStore } from '../../stores/toastStore';
import { useRemuxStore } from '../../stores/remuxStore';
import { clearPreviewCache } from '../../utils/preview-cache';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const selectFilesMock = vi.mocked(window.electronAPI.selectFiles);
const selectOutputMock = vi.mocked(window.electronAPI.selectOutput);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const getVideoPreviewMock = vi.mocked(window.electronAPI.getVideoPreview);
const pauseConversionMock = vi.mocked(window.electronAPI.pauseConversion);
const resumeConversionMock = vi.mocked(window.electronAPI.resumeConversion);
const cancelConversionMock = vi.mocked(window.electronAPI.cancelConversion);
const storeProgressHandler = vi.mocked(window.electronAPI.onConversionProgress).mock.calls[0]?.[0];

function resetStore(): void {
  useRemuxStore.setState({
    input: '',
    container: 'mkv',
    streams: [],
    selectedMaps: [],
    addedSubtitles: [],
    addedAudio: [],
    addedAudioInfo: [],
    thumbnail: null,
    chaptersFile: null,
    copyChapters: true,
    audioSyncSeconds: null,
    videoFilters: [],
    output: '',
    warnings: [],
    isDirty: false,
    isConverting: false,
    isPaused: false,
    progress: null,
  });
  useErrorStore.setState({ currentError: null, errorHistory: [] });
  useToastStore.setState({ toasts: [] });
}

function renderPage() {
  return render(<Remux />);
}

describe('Remux', () => {
  beforeEach(() => {
    resetStore();
    clearPreviewCache();
    selectFileMock.mockReset();
    selectFilesMock.mockReset();
    selectOutputMock.mockReset();
    convertFileMock.mockReset();
    getMediaInfoMock.mockReset();
    getVideoPreviewMock.mockReset();
    getVideoPreviewMock.mockResolvedValue(null);
    pauseConversionMock.mockReset();
    resumeConversionMock.mockReset();
    cancelConversionMock.mockReset();
  });

  it('renders the title, fields, and start button', () => {
    renderPage();
    expect(screen.getByText('remux.title')).toBeInTheDocument();
    expect(screen.getByText('remux.videoFile')).toBeInTheDocument();
    expect(screen.getByText('remux.dropLabel')).toBeInTheDocument();
    expect(screen.getByText('remux.container')).toBeInTheDocument();
    expect(screen.getByText('remux.outputFile')).toBeInTheDocument();
    expect(screen.getByText('remux.start')).toBeInTheDocument();
  });

  it('keeps the start button disabled until an input and output are provided', async () => {
    renderPage();
    const button = screen.getByText('remux.start');
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('remux.placeholderOutput'), { target: { value: '/out/out.mkv' } });
    expect(screen.getByText('remux.start')).toBeDisabled();

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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledWith('/in/video.mkv', 'FFMPEG'));
    expect(screen.getByText('remux.start')).toBeEnabled();
  });

  it('selects a video and lists its source streams with checkboxes bound to the selection', async () => {
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
        {
          index: 2,
          type: 'subtitle',
          codec: 'subrip',
          language: 'eng',
        },
      ],
    });
    renderPage();
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalled());
    expect(screen.getAllByTestId('remux-stream-row')).toHaveLength(3);
    expect(useRemuxStore.getState().selectedMaps).toEqual(['0:v:0', '0:a:0', '0:s:0']);
    expect(screen.getByText('h264')).toBeInTheDocument();
    expect(screen.getByText('aac')).toBeInTheDocument();
    expect(screen.getByText('subrip')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(useRemuxStore.getState().selectedMaps).toEqual(['0:v:0', '0:s:0']);
  });

  it('keeps all or none of the source streams via the shortcut buttons', async () => {
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalled());
    fireEvent.click(screen.getByText('remux.selectNone'));
    expect(useRemuxStore.getState().selectedMaps).toEqual([]);
    fireEvent.click(screen.getByText('remux.selectAll'));
    expect(useRemuxStore.getState().selectedMaps).toEqual(['0:v:0', '0:a:0', '0:s:0']);
  });

  it('shows a validation error when the output field is blurred empty', () => {
    renderPage();
    fireEvent.blur(screen.getByPlaceholderText('remux.placeholderOutput'));
    expect(screen.getByText('validation.outputRequired')).toBeInTheDocument();
    expect(convertFileMock).not.toHaveBeenCalled();
  });

  it('shows the audio sync control after a video with audio is selected and binds the delay', async () => {
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
    expect(screen.queryByTestId('remux-audio-sync')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalled());
    const sync = screen.getByTestId('remux-audio-sync');
    fireEvent.change(sync, { target: { value: '-0.5' } });
    expect(useRemuxStore.getState().audioSyncSeconds).toBe(-0.5);
    fireEvent.change(sync, { target: { value: '' } });
    expect(useRemuxStore.getState().audioSyncSeconds).toBeNull();
    expect(screen.getByText('remux.audioSyncLossless')).toBeInTheDocument();
  });

  it('remuxes when both input and output are provided', async () => {
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('remux.placeholderOutput'), { target: { value: '/out/out.mkv' } });
    fireEvent.click(screen.getByText('remux.start'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(convertFileMock).toHaveBeenCalledWith('/in/video.mkv', '/out/out.mkv', expect.objectContaining({}), 'FFMPEG');
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'Remux complete')).toBe(true);
    await waitFor(() => expect(useRemuxStore.getState().progress).toBeNull());
    expect(screen.queryByText('42.0%')).not.toBeInTheDocument();
  });

  it('shows live progress while remuxing and removes it when the job completes', async () => {
    let resolveConvert: (value?: void) => void = () => {};
    convertFileMock.mockReturnValue(new Promise((resolve) => (resolveConvert = resolve)));
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('remux.placeholderOutput'), { target: { value: '/out/out.mkv' } });
    fireEvent.click(screen.getByText('remux.start'));
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
    expect(screen.getByText('remux.remuxing')).toBeInTheDocument();
    act(() => {
      storeProgressHandler?.({
        input: '/in/video.mkv',
        output: '/out/out.mkv',
        progress: { percent: 42, time: '00:00:01', fps: 24, speed: '1x', eta: '5', bitrate: '100k' },
      });
    });
    expect(screen.getByText('42.0%')).toBeInTheDocument();
    await act(async () => {
      resolveConvert();
    });
    expect(useRemuxStore.getState().progress).toBeNull();
    expect(screen.queryByText('42.0%')).not.toBeInTheDocument();
  });

  it('pauses and resumes the remux', async () => {
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('remux.placeholderOutput'), { target: { value: '/out/out.mkv' } });
    fireEvent.click(screen.getByText('remux.start'));
    await waitFor(() => expect(screen.getByText('remux.pause')).toBeInTheDocument());
    fireEvent.click(screen.getByText('remux.pause'));
    await waitFor(() => expect(pauseConversionMock).toHaveBeenCalledOnce());
    expect(screen.getByText('remux.resume')).toBeInTheDocument();
    fireEvent.click(screen.getByText('remux.resume'));
    await waitFor(() => expect(resumeConversionMock).toHaveBeenCalledOnce());
    expect(screen.getByText('remux.pause')).toBeInTheDocument();
  });

  it('asks for confirmation and cancels the remux', async () => {
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('remux.placeholderOutput'), { target: { value: '/out/out.mkv' } });
    fireEvent.click(screen.getByText('remux.start'));
    await waitFor(() => expect(screen.getByText('remux.cancel')).toBeInTheDocument());
    fireEvent.click(screen.getByText('remux.cancel'));
    expect(screen.getByText('remux.cancelMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByText('remux.yes'));
    await waitFor(() => expect(cancelConversionMock).toHaveBeenCalledOnce());
    expect(useRemuxStore.getState().isConverting).toBe(false);
  });

  it('remuxes with Ctrl+Enter', async () => {
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText('remux.placeholderOutput'), { target: { value: '/out/out.mkv' } });
    fireEvent.keyDown(window, { code: 'Enter', key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(convertFileMock).toHaveBeenCalledOnce());
  });

  it('opens the file picker with Ctrl+O', async () => {
    renderPage();
    fireEvent.keyDown(window, { code: 'KeyO', key: 'o', ctrlKey: true });
    await waitFor(() => expect(selectFileMock).toHaveBeenCalledOnce());
  });

  it('adds subtitle files, picks a target codec, and removes an entry', async () => {
    selectFileMock.mockResolvedValue('/in/video.mkv');
    selectFilesMock.mockResolvedValue(['/in/en.srt', '/in/jp.ass']);
    getMediaInfoMock.mockResolvedValue({
      file: '/in/video.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '1000k',
      streams: [{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 }],
    });
    renderPage();
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByTestId('remux-add-subtitle'));
    await waitFor(() => expect(selectFilesMock).toHaveBeenCalledOnce());
    const state = useRemuxStore.getState();
    expect(state.addedSubtitles).toEqual([
      { path: '/in/en.srt', map: ['1:0'], codec: 'subrip' },
      { path: '/in/jp.ass', map: ['2:0'], codec: 'subrip' },
    ]);
    expect(screen.getAllByTestId('remux-added-subtitle')).toHaveLength(2);

    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    const options = screen.getAllByRole('option');
    expect(options.some((o) => o.textContent === 'ass')).toBe(true);
    expect(options.some((o) => o.textContent === 'copy')).toBe(true);
    fireEvent.click(options.find((o) => o.textContent === 'ass') as Element);
    await waitFor(() => expect(useRemuxStore.getState().addedSubtitles[0].codec).toBe('ass'));

    fireEvent.click(screen.getByTestId('remux-remove-subtitle-0'));
    await waitFor(() => expect(useRemuxStore.getState().addedSubtitles).toHaveLength(1));
    expect(useRemuxStore.getState().addedSubtitles[0].path).toBe('/in/jp.ass');
  });

  it('adds audio tracks with probed info, binds delay, and removes entries', async () => {
    const getMediaInfoMockLocal = getMediaInfoMock;
    selectFileMock.mockResolvedValue('/in/video.mkv');
    getMediaInfoMockLocal.mockImplementation(async (file: string) => {
      if (file === '/in/a.m4a') {
        return {
          file,
          format: 'm4a',
          size: 1,
          duration: 60,
          bitrate: '128k',
          streams: [{ index: 0, type: 'audio', codec: 'aac', channels: 2, language: 'eng' }],
        };
      }
      return {
        file,
        format: 'matroska',
        size: 1024,
        duration: 60,
        bitrate: '1000k',
        streams: [{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 }],
      };
    });
    selectFilesMock.mockResolvedValue(['/in/a.m4a']);
    renderPage();
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledWith('/in/video.mkv', 'FFMPEG'));

    fireEvent.click(screen.getByTestId('remux-add-audio'));
    await waitFor(() => expect(useRemuxStore.getState().addedAudio).toHaveLength(1));
    const state = useRemuxStore.getState();
    expect(state.addedAudio[0]).toEqual({ path: '/in/a.m4a', map: ['1:0'], codec: 'copy' });
    expect(state.addedAudioInfo[0]).toMatchObject({ codec: 'aac', channels: 2, language: 'eng' });
    expect(screen.getByText(/aac.*2ch/)).toBeInTheDocument();

    const delay = screen.getByTestId('remux-audio-delay-0');
    fireEvent.change(delay, { target: { value: '1.5' } });
    expect(useRemuxStore.getState().addedAudio[0].syncOffsetSeconds).toBe(1.5);
    fireEvent.change(delay, { target: { value: '' } });
    expect(useRemuxStore.getState().addedAudio[0].syncOffsetSeconds).toBe(0);

    fireEvent.click(screen.getByTestId('remux-remove-audio-0'));
    await waitFor(() => expect(useRemuxStore.getState().addedAudio).toHaveLength(0));
    expect(useRemuxStore.getState().addedAudioInfo).toHaveLength(0);
  });

  it('adds an MKV/WebM thumbnail as an attached picture and removes it', async () => {
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    selectFileMock.mockResolvedValueOnce('/in/cover.jpg');
    fireEvent.click(screen.getByTestId('remux-add-thumbnail'));
    await waitFor(() => expect(useRemuxStore.getState().thumbnail?.attachment).toBe(true));
    expect(useRemuxStore.getState().thumbnail?.map).toEqual([]);
    expect(screen.getByText('cover.jpg')).toBeInTheDocument();
    expect(screen.getByText('Embedded as attached picture')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('remux-remove-thumbnail'));
    await waitFor(() => expect(useRemuxStore.getState().thumbnail).toBeNull());
    expect(screen.queryByTestId('remux-thumbnail')).not.toBeInTheDocument();
  });

  it('composes an MP4/MOV thumbnail as a mapped attached_pic stream and warns for unsupported containers', async () => {
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    act(() => useRemuxStore.getState().setContainer('mp4'));
    selectFileMock.mockResolvedValueOnce('/in/cover.png');
    fireEvent.click(screen.getByTestId('remux-add-thumbnail'));
    await waitFor(() => expect(useRemuxStore.getState().thumbnail?.disposition).toBe('attached_pic'));
    expect(useRemuxStore.getState().thumbnail?.map).toEqual(['1:0']);

    act(() => useRemuxStore.getState().setContainer('avi'));
    expect(screen.getByTestId('remux-add-thumbnail')).toBeDisabled();
    expect(screen.getByTestId('remux-thumbnail-unsupported')).toHaveTextContent('avi');
  });

  it('copies source chapters by default and imports/removes a chapters file', async () => {
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    expect(useRemuxStore.getState().copyChapters).toBe(true);

    selectFileMock.mockResolvedValueOnce('/in/chapters.txt');
    fireEvent.click(screen.getByTestId('remux-add-chapters'));
    await waitFor(() => expect(useRemuxStore.getState().chaptersFile).toBe('/in/chapters.txt'));
    expect(useRemuxStore.getState().copyChapters).toBe(true);
    expect(screen.getByTestId('remux-copy-chapters')).toBeDisabled();
    expect(screen.getByText('chapters.txt')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('remux-remove-chapters'));
    await waitFor(() => expect(useRemuxStore.getState().chaptersFile).toBeNull());
    expect(screen.getByTestId('remux-copy-chapters')).toBeEnabled();

    fireEvent.click(screen.getByTestId('remux-copy-chapters'));
    expect(useRemuxStore.getState().copyChapters).toBe(false);
  });

  it('disables the chapters import and warns for containers without chapters', async () => {
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    act(() => useRemuxStore.getState().setContainer('avi'));
    expect(screen.getByTestId('remux-add-chapters')).toBeDisabled();
    expect(screen.getByTestId('remux-chapters-unsupported')).toHaveTextContent('avi');
  });

  it('shows the filters section and no re-encode warning for a plain lossless remux', () => {
    renderPage();
    expect(screen.getByText('remux.filtersTitle')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Add preset filter...' })).toBeInTheDocument();
    expect(screen.queryByTestId('remux-filters-reencode')).not.toBeInTheDocument();
  });

  it('warns that the remux is re-encoded once a filter is added', () => {
    renderPage();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Add preset filter...' }));
    fireEvent.click(screen.getByRole('option', { name: 'Sharpen' }));
    fireEvent.click(screen.getByTestId('filters-add-preset'));

    expect(useRemuxStore.getState().videoFilters).toEqual(['unsharp=5:5:0.5:5:5:0']);
    expect(screen.getByTestId('remux-filters-reencode')).toBeInTheDocument();
    expect(screen.getByTestId('filters-preview')).toHaveTextContent('-vf unsharp=5:5:0.5:5:5:0');
  });

  it('removes the re-encode warning again when the last filter is removed', () => {
    useRemuxStore.setState({ videoFilters: ['unsharp=5:5:0.5:5:5:0'] });
    renderPage();
    expect(screen.getByTestId('remux-filters-reencode')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('filters-remove-0'));
    expect(useRemuxStore.getState().videoFilters).toEqual([]);
    expect(screen.queryByTestId('remux-filters-reencode')).not.toBeInTheDocument();
  });

  it('remuxes as a re-encode with the filter chain when filters are set', async () => {
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    act(() => useRemuxStore.getState().setVideoFilters(['fps=30']));
    await act(async () => {
      await useRemuxStore.getState().startRemux();
    });

    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/video.mkv',
      expect.any(String),
      expect.objectContaining({ copy: false, videoFilters: ['fps=30'] }),
      'FFMPEG',
    );
  });

  it('previews a still frame of the selected video', async () => {
    getVideoPreviewMock.mockResolvedValue('data:image/png;base64,PREVIEW');
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    const preview = within(screen.getByTestId('remux-video'));
    expect(await preview.findByRole('img')).toHaveAttribute('src', 'data:image/png;base64,PREVIEW');
  });

  it('drops the video preview when the input is cleared', async () => {
    getVideoPreviewMock.mockResolvedValue('data:image/png;base64,PREVIEW');
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
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());
    await within(screen.getByTestId('remux-video')).findByRole('img');

    fireEvent.click(screen.getByTestId('remove-remux-video'));
    expect(screen.queryByTestId('remux-video')).not.toBeInTheDocument();
    expect(screen.getByText('remux.dropLabel')).toBeInTheDocument();
  });

  it('lists the source streams as a table of codec, video, audio, and disposition details', async () => {
    selectFileMock.mockResolvedValue('/in/movie.mkv');
    getMediaInfoMock.mockResolvedValue({
      file: '/in/movie.mkv',
      format: 'matroska',
      size: 1024,
      duration: 60,
      bitrate: '6500k',
      streams: [
        {
          index: 0,
          type: 'video',
          codec: 'h264',
          width: 1920,
          height: 1080,
          frameRate: '24/1',
          bitrate: '5000000',
          title: 'Main video',
          disposition: ['default'],
        },
        {
          index: 1,
          type: 'audio',
          codec: 'eac3',
          sampleRate: 48000,
          channels: 6,
          channelLayout: '5.1',
          language: 'eng',
          bitrate: '1500000',
        },
        { index: 2, type: 'subtitle', codec: 'subrip', language: 'eng' },
      ],
    });
    renderPage();
    fireEvent.click(screen.getByText('remux.dropLabel'));
    await waitFor(() => expect(getMediaInfoMock).toHaveBeenCalledOnce());

    const table = within(screen.getByRole('table', { name: 'remux.streams' }));
    expect(table.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      '',
      'remux.streamIndex',
      'remux.kind',
      'mediaInfo.codec',
      'mediaInfo.resolution',
      'mediaInfo.frameRate',
      'mediaInfo.bitrate',
      'mediaInfo.language',
      'mediaInfo.sampleRate',
      'mediaInfo.channels',
      'mediaInfo.streamTitle',
      'mediaInfo.disposition',
    ]);

    const [video, audio, subtitle] = table.getAllByTestId('remux-stream-row');

    expect(within(video).getByText('1920×1080')).toBeInTheDocument();
    expect(within(video).getByText('24/1 fps')).toBeInTheDocument();
    expect(within(video).getByText('5.0 Mbps')).toBeInTheDocument();
    expect(within(video).getByText('Main video')).toBeInTheDocument();
    expect(within(video).getByText('Default')).toBeInTheDocument();
    expect(within(video).getAllByText('—').length).toBe(3);

    expect(within(audio).getByText('48 kHz')).toBeInTheDocument();
    expect(within(audio).getByText('6 (5.1)')).toBeInTheDocument();
    expect(within(audio).getByText('1.5 Mbps')).toBeInTheDocument();
    expect(within(audio).getByText('eng')).toBeInTheDocument();

    // A subtitle stream declares none of the video/audio properties.
    expect(within(subtitle).getAllByText('—').length).toBe(7);
  });
});
