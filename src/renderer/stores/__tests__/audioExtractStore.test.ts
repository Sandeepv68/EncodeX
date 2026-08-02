import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAudioExtractStore } from '../audioExtractStore';
import { useErrorStore } from '../errorStore';
import { useToastStore } from '../toastStore';
import { ErrorCode } from '../../../shared/errors';

const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const pauseConversionMock = vi.mocked(window.electronAPI.pauseConversion);
const resumeConversionMock = vi.mocked(window.electronAPI.resumeConversion);
const cancelConversionMock = vi.mocked(window.electronAPI.cancelConversion);
const progressHandler = vi.mocked(window.electronAPI.onConversionProgress).mock.calls[0]?.[0];

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
  useErrorStore.setState({ currentError: null, errorHistory: [] });
  useToastStore.setState({ toasts: [] });
}

function emitProgress(percent: number): void {
  progressHandler?.({
    input: 'in.mp4',
    output: 'out.mp3',
    progress: { percent, time: '00:00:01', fps: 24, speed: '1x', eta: '5', bitrate: '100k' },
  });
}

describe('audioExtractStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    convertFileMock.mockResolvedValue(undefined);
    pauseConversionMock.mockResolvedValue(undefined);
    resumeConversionMock.mockResolvedValue(undefined);
    cancelConversionMock.mockResolvedValue(undefined);
  });

  it('has default state', () => {
    const state = useAudioExtractStore.getState();
    expect(state.input).toBe('');
    expect(state.preview).toBeNull();
    expect(state.audioStreams).toEqual([]);
    expect(state.output).toBe('');
    expect(state.audioCodec).toBe('libmp3lame');
    expect(state.audioBitrate).toBe('192k');
    expect(state.isConverting).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.progress).toBeNull();
  });

  it('sets input, preview, audio streams, output, codec, and bitrate', () => {
    const s = useAudioExtractStore.getState();
    s.setInput('in.mp4');
    s.setPreview('data:image/png;base64,AQID');
    s.setAudioStreams([{ index: 1, type: 'audio', codec: 'aac' }]);
    s.setOutput('out.mp3');
    s.setAudioCodec('flac');
    s.setAudioBitrate('320k');
    const state = useAudioExtractStore.getState();
    expect(state.input).toBe('in.mp4');
    expect(state.preview).toBe('data:image/png;base64,AQID');
    expect(state.audioStreams).toEqual([{ index: 1, type: 'audio', codec: 'aac' }]);
    expect(state.output).toBe('out.mp3');
    expect(state.audioCodec).toBe('flac');
    expect(state.audioBitrate).toBe('320k');
  });

  it('clearSelection resets input, preview, streams, and output', () => {
    useAudioExtractStore.setState({
      input: 'in.mp4',
      preview: 'data:image/png;base64,AQID',
      audioStreams: [{ index: 1, type: 'audio', codec: 'aac' }],
      output: 'out.mp3',
    });
    useAudioExtractStore.getState().clearSelection();
    const state = useAudioExtractStore.getState();
    expect(state.input).toBe('');
    expect(state.preview).toBeNull();
    expect(state.audioStreams).toEqual([]);
    expect(state.output).toBe('');
  });

  it('updates progress from conversion events while extracting', () => {
    useAudioExtractStore.setState({ isConverting: true });
    emitProgress(42);
    expect(useAudioExtractStore.getState().progress).toMatchObject({ percent: 42, time: '00:00:01', speed: '1x', eta: '5' });
  });

  it('ignores progress events when no extraction is running', () => {
    emitProgress(99);
    expect(useAudioExtractStore.getState().progress).toBeNull();
  });

  it('startExtract shows INPUT_NOT_SPECIFIED without an input', async () => {
    useAudioExtractStore.setState({ input: '', output: 'out.mp3' });
    await useAudioExtractStore.getState().startExtract();
    expect(convertFileMock).not.toHaveBeenCalled();
    expect(useErrorStore.getState().currentError?.code).toBe(ErrorCode.INPUT_NOT_SPECIFIED);
    expect(useAudioExtractStore.getState().isConverting).toBe(false);
  });

  it('startExtract shows OUTPUT_NOT_SPECIFIED without an output', async () => {
    useAudioExtractStore.setState({ input: 'in.mp4', output: '' });
    await useAudioExtractStore.getState().startExtract();
    expect(convertFileMock).not.toHaveBeenCalled();
    expect(useErrorStore.getState().currentError?.code).toBe(ErrorCode.OUTPUT_NOT_SPECIFIED);
  });

  it('startExtract runs the conversion and completes successfully', async () => {
    useAudioExtractStore.setState({ input: 'in.mp4', output: 'out.mp3' });
    await useAudioExtractStore.getState().startExtract();
    expect(convertFileMock).toHaveBeenCalledWith('in.mp4', 'out.mp3', { audioCodec: 'libmp3lame', audioBitrate: '192k' }, 'FFMPEG');
    expect(useAudioExtractStore.getState().isConverting).toBe(false);
    expect(useAudioExtractStore.getState().progress).toBeNull();
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe('Audio extracted successfully');
  });

  it('startExtract shows the error when the conversion fails', async () => {
    convertFileMock.mockRejectedValue(new Error('boom'));
    useAudioExtractStore.setState({ input: 'in.mp4', output: 'out.mp3' });
    await useAudioExtractStore.getState().startExtract();
    expect(useErrorStore.getState().currentError?.detail).toBe('boom');
    expect(useAudioExtractStore.getState().isConverting).toBe(false);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('pauseExtract sets isPaused', async () => {
    await useAudioExtractStore.getState().pauseExtract();
    expect(pauseConversionMock).toHaveBeenCalledOnce();
    expect(useAudioExtractStore.getState().isPaused).toBe(true);
  });

  it('resumeExtract clears isPaused', async () => {
    useAudioExtractStore.setState({ isPaused: true });
    await useAudioExtractStore.getState().resumeExtract();
    expect(resumeConversionMock).toHaveBeenCalledOnce();
    expect(useAudioExtractStore.getState().isPaused).toBe(false);
  });

  it('cancelExtract stops the job and clears progress', async () => {
    useAudioExtractStore.setState({
      isConverting: true,
      isPaused: true,
      progress: { percent: 50, time: '00:00:10', speed: '1x', eta: '10' },
    });
    await useAudioExtractStore.getState().cancelExtract();
    expect(cancelConversionMock).toHaveBeenCalledOnce();
    expect(useAudioExtractStore.getState().isConverting).toBe(false);
    expect(useAudioExtractStore.getState().isPaused).toBe(false);
    expect(useAudioExtractStore.getState().progress).toBeNull();
  });
});
